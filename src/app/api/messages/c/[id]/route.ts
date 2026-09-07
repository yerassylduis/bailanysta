import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { listGroupMessages, sendGroupMessage } from "@/lib/repo-messages";
import { COMMENT_MAX } from "@/lib/text";

type Ctx = RouteCtx<{ id: string }>;

/** GET /api/messages/c/:id — тред группы (участники + сообщения); отмечает прочитанным. */
export const GET = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const after = new URL(req.url).searchParams.get("after") ?? undefined;
  return ok(await listGroupMessages(user, id, after));
});

const Body = z.object({ text: z.string().trim().max(COMMENT_MAX * 3).optional(), mediaId: z.string().optional() })
  .refine((b) => (b.text && b.text.length > 0) || b.mediaId, { message: "Сообщение пустое" });

export const POST = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const body = await parseBody(req, Body);
  return ok(await sendGroupMessage(user, id, body.text ?? "", body.mediaId ?? null), { status: 201 });
});
