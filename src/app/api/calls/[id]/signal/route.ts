import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { pushSignal } from "@/lib/repo-calls";

const Body = z.object({
  type: z.enum(["offer", "answer", "ice", "chat", "state"]),
  to: z.string().nullable().optional(),
  payload: z.unknown(),
});

/** POST /api/calls/:id/signal — передать сигнал WebRTC или сообщение чата звонка. */
export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { type, to, payload } = await parseBody(req, Body);
  return ok(await pushSignal(user, id, type, to ?? null, payload), { status: 201 });
});
