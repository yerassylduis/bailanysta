import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { createPost, undoRepost } from "@/lib/repo";
import { POST_MAX } from "@/lib/text";

type Ctx = RouteCtx<{ id: string }>;

/** POST /api/posts/:id/repost { text? } — репост (без текста) или цитата (с текстом). */
export const POST = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { text } = await parseBody(req, z.object({ text: z.string().trim().max(POST_MAX).optional() }));
  return ok(await createPost(user, { text: text ?? "", mood: null, mediaIds: [], repostOfId: id }), { status: 201 });
});

/** DELETE /api/posts/:id/repost — убрать свой чистый репост. */
export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  return ok(await undoRepost(user, id));
});
