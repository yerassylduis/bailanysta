import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { currentUser, requireUser } from "@/lib/auth";
import { deletePost, getPost, updatePost } from "@/lib/repo";
import { MOOD_IDS, POST_MAX } from "@/lib/text";

type Ctx = RouteCtx<{ id: string }>;

export const GET = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const viewer = await currentUser();
  return ok(await getPost(id, viewer?.id ?? null));
});

const Patch = z.object({
  text: z.string().trim().max(POST_MAX).optional(),
  mood: z.enum(MOOD_IDS).nullable().optional(),
  mediaIds: z.array(z.string()).max(4).optional(),
});

export const PATCH = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const patch = await parseBody(req, Patch);
  return ok(await updatePost(user, id, patch));
});

export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  await deletePost(user, id);
  return ok({ ok: true });
});
