import { currentUser } from "@/lib/auth";
import { notificationsSince, unreadCount } from "@/lib/repo";
import { incomingMessagesSince, unreadMessagesCount } from "@/lib/repo-messages";

/**
 * GET /api/events — realtime-поток Server-Sent Events.
 * Сервер раз в 2 секунды проверяет базу и присылает только изменения:
 *   event: notifications  { items, unread, unreadMessages }
 *   event: messages       { items, unreadMessages }
 *   event: counts         { unread, unreadMessages }   (при изменении счётчиков)
 * Поток живёт ~55 с (лимит serverless-функции), затем закрывается; EventSource
 * переподключается сам и передаёт Last-Event-ID — ничего не теряется.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TICK_MS = 2000;
const LIFETIME_MS = 55_000;

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Курсор: с какого момента слушаем. Last-Event-ID приходит при переподключении.
  const url = new URL(req.url);
  let since = req.headers.get("last-event-id") || url.searchParams.get("since") || new Date().toISOString();
  let lastUnread = -1, lastUnreadMsgs = -1;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown, id?: string) => {
        controller.enqueue(enc.encode(`${id ? `id: ${id}\n` : ""}event: ${event}\nretry: 1500\ndata: ${JSON.stringify(data)}\n\n`));
      };
      let closed = false;
      const onAbort = () => { closed = true; };
      req.signal.addEventListener("abort", onAbort);
      controller.enqueue(enc.encode(`: connected ${since}\n\n`));
      const startedAt = Date.now();

      while (!closed && Date.now() - startedAt < LIFETIME_MS) {
        try {
          const [notes, msgs, unread, unreadMessages] = await Promise.all([
            notificationsSince(user.id, since), incomingMessagesSince(user.id, since), unreadCount(user.id), unreadMessagesCount(user.id),
          ]);
          const newest = [...notes.map((n) => n.createdAt), ...msgs.map((m) => m.createdAt)].sort().pop();
          if (newest) since = newest;
          if (notes.length) send("notifications", { items: notes, unread, unreadMessages }, since);
          if (msgs.length) send("messages", { items: msgs, unreadMessages }, since);
          if (!notes.length && !msgs.length && (unread !== lastUnread || unreadMessages !== lastUnreadMsgs)) send("counts", { unread, unreadMessages });
          lastUnread = unread; lastUnreadMsgs = unreadMessages;
          if (!notes.length && !msgs.length) controller.enqueue(enc.encode(`: ping\n\n`));
        } catch (e) {
          console.error("[events]", e instanceof Error ? e.message : e);
        }
        await new Promise((r) => setTimeout(r, TICK_MS));
      }
      req.signal.removeEventListener("abort", onAbort);
      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
