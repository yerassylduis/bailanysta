import { handler, ok, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { callChatHistory, getCall } from "@/lib/repo-calls";

export const GET = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  const { id } = await params;
  await requireUser();
  const [call, chat] = await Promise.all([getCall(id), callChatHistory(id)]);
  return ok({ call, chat });
});
