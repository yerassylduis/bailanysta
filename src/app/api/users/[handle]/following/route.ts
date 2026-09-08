import { handler, ok, type RouteCtx } from "@/lib/http";
import { currentUser } from "@/lib/auth";
import { listFollowList } from "@/lib/repo";

/** GET /api/users/:handle/following — список с флагом «я подписан». */
export const GET = handler<RouteCtx<{ handle: string }>>(async (_req, { params }) => {
  const { handle } = await params;
  const viewer = await currentUser();
  return ok({ items: await listFollowList(handle, "following", viewer?.id ?? null) });
});
