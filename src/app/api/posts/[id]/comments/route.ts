import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { currentUser, requireUser } from "@/lib/auth";
import { addComment, listComments } from "@/lib/repo";
import { COMMENT_MAX } from "@/lib/text";

type Ctx = RouteCtx<{ id: string }>;

export const GET = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const viewer = await currentUser();
  return ok({ items: await listComments(id, viewer?.id ?? null) });
});

export const POST = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { text, parentId } = await parseBody(req, z.object({ text: z.string().trim().min(1).max(COMMENT_MAX), parentId: z.string().optional() }));
  return ok(await addComment(user, id, text, parentId ?? null), { status: 201 });
});
