import { currentUser } from "@/lib/auth";
import { getCall, heartbeat, signalsSince } from "@/lib/repo-calls";

/**
 * GET /api/calls/:id/events — быстрый SSE-канал сигналинга (тик 400 мс, жизнь 55 с).
 *   event: signal        SignalDto (offer/answer/ice/join/leave/chat/state)
 *   event: participants  CallDto.participants (при изменении)
 * Заодно обновляет last_seen участника — это и есть heartbeat.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TICK_MS = 300;
const LIFETIME_MS = 55_000;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  // Стартовая метка — ТОЛЬКО серверные часы (часы клиента могут спешить, и сигналы потерялись бы).
  // При переподключении EventSource присылает Last-Event-ID — это тоже серверная метка.
  let since = req.headers.get("last-event-id") || new Date(Date.now() - 3000).toISOString();
  let lastParts = "";
  let ticks = 0;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown, evId?: string) =>
        controller.enqueue(enc.encode(`${evId ? `id: ${evId}\n` : ""}event: ${event}\nretry: 800\ndata: ${JSON.stringify(data)}\n\n`));
      let closed = false;
      const onAbort = () => { closed = true; };
      req.signal.addEventListener("abort", onAbort);
      controller.enqueue(enc.encode(`: connected\n\n`));
      const startedAt = Date.now();
      while (!closed && Date.now() - startedAt < LIFETIME_MS) {
        // Каждая часть — в своём try: ошибка одной не должна останавливать остальные
        let got = 0;
        try {
          const signals = await signalsSince(user.id, id, since);
          got = signals.length;
          for (const s of signals) { since = s.createdAt; send("signal", s, s.createdAt); }
        } catch (e) { console.error("[call-events] signals", e instanceof Error ? e.message : e); }
        if (ticks % 5 === 0) { // раз в 2 с — участники и heartbeat
          try {
            await heartbeat(user, id);
            const call = await getCall(id);
            const key = JSON.stringify(call.participants.map((p) => [p.id, p.online]));
            if (key !== lastParts) { lastParts = key; send("participants", call.participants); }
          } catch (e) { console.error("[call-events] participants", e instanceof Error ? e.message : e); }
        }
        if (!got && ticks % 10 === 0) { try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch { closed = true; } }
        ticks++;
        await new Promise((r) => setTimeout(r, TICK_MS));
      }
      req.signal.removeEventListener("abort", onAbort);
      try { controller.close(); } catch {}
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}
