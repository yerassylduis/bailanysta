import { handler, ok, type RouteCtx } from "@/lib/http";
import { currentUser } from "@/lib/auth";
import { getProfile } from "@/lib/repo";

export const GET = handler<RouteCtx<{ handle: string }>>(async (_req, { params }) => {
  const { handle } = await params;
  const viewer = await currentUser();
  return ok(await getProfile(handle.toLowerCase(), viewer?.id ?? null));
});
