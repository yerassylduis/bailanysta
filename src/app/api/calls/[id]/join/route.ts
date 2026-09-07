import { handler, ok, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { joinCall } from "@/lib/repo-calls";

export const POST = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  return ok(await joinCall(user, id));
});
