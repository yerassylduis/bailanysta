import { handler, ok, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { leaveGroup } from "@/lib/repo-messages";

export const POST = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  return ok(await leaveGroup(user, id));
});
