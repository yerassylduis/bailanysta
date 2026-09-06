import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { ensureWelcome, listMessages, sendMessage } from "@/lib/repo-messages";
import { COMMENT_MAX } from "@/lib/text";

type Ctx = RouteCtx<{ handle: string }>;

/** GET /api/messages/:handle?after=<iso> — сообщения с собеседником; отмечает диалог прочитанным. */
export const GET = handler<Ctx>(async (req, { params }) => {
  const { handle } = await params;
  const user = await requireUser();
  const after = new URL(req.url).searchParams.get("after") ?? undefined;
  await ensureWelcome(user);
  return ok(await listMessages(user, handle.toLowerCase(), after));
});

const Body = z.object({
  text: z.string().trim().max(COMMENT_MAX * 3).optional(),
  mediaId: z.string().optional(),
}).refine((b) => (b.text && b.text.length > 0) || b.mediaId, { message: "Сообщение пустое" });

export const POST = handler<Ctx>(async (req, { params }) => {
  const { handle } = await params;
  const user = await requireUser();
  const body = await parseBody(req, Body);
  return ok(await sendMessage(user, handle.toLowerCase(), body.text ?? "", body.mediaId ?? null), { status: 201 });
});
