import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { setCommentLike } from "@/lib/repo";

/** PUT /api/comments/:id/like { liked: boolean } — идемпотентно. */
export const PUT = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { liked } = await parseBody(req, z.object({ liked: z.boolean() }));
  return ok(await setCommentLike(user, id, liked));
});
