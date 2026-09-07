import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { addGroupMember } from "@/lib/repo-messages";

/** POST /api/messages/c/:id/members { handle } — добавить участника. */
export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { handle } = await parseBody(req, z.object({ handle: z.string().trim().toLowerCase().min(2) }));
  return ok(await addGroupMember(user, id, handle));
});
