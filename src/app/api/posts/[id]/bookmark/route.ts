import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { setBookmark } from "@/lib/repo";

/** PUT /api/posts/:id/bookmark { bookmarked: boolean } */
export const PUT = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { bookmarked } = await parseBody(req, z.object({ bookmarked: z.boolean() }));
  return ok(await setBookmark(user, id, bookmarked));
});
