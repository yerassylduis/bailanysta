import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { currentUser, requireUser } from "@/lib/auth";
import { createPost, listPosts } from "@/lib/repo";
import { MOOD_IDS, POST_MAX } from "@/lib/text";

/**
 * GET /api/posts?scope=all|following&author=&q=&tag=&mood=&cursor=&limit=
 * Лента с курсорной пагинацией и фильтрами.
 */
export const GET = handler(async (req) => {
  const viewer = await currentUser();
  const p = new URL(req.url).searchParams;
  const sc = p.get("scope");
  const scope = sc === "following" || sc === "bookmarks" || sc === "hot" ? sc : "all";
  const page = await listPosts({
    scope, authorHandle: p.get("author") ?? undefined, q: p.get("q") ?? undefined,
    tag: p.get("tag") ?? undefined, mood: p.get("mood") ?? undefined,
    cursor: p.get("cursor"), limit: Number(p.get("limit") ?? 10) || 10,
  }, viewer?.id ?? null);
  return ok(page);
});

const Body = z.object({
  text: z.string().trim().max(POST_MAX).default(""),
  mood: z.enum(MOOD_IDS).nullable().optional(),
  /** До 4 фото или 1 видео — проверяется на сервере. */
  mediaIds: z.array(z.string()).max(4).default([]),
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { text, mood, mediaIds } = await parseBody(req, Body);
  return ok(await createPost(user, { text, mood: mood ?? null, mediaIds }), { status: 201 });
});
