import { and, desc, eq, inArray, like, lt, or, sql, count, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { HttpError } from "./auth";
import { newId, nowIso } from "./ids";
import { extractMentions, extractTags, hueFromHandle } from "./text";
import type { CommentDto, GraphDto, NotificationDto, Page, PostDto, TrendingTag, UserDto, UserProfileDto } from "./types";
import type { User } from "@/db/schema";

/**
 * Репозиторий — единственное место, где живёт SQL.
 * Route handlers только валидируют вход и вызывают функции отсюда.
 */

const { users, posts, postTags, likes, comments, follows, notifications } = schema;

export const toUserDto = (u: User): UserDto => ({
  id: u.id, handle: u.handle, name: u.name, bio: u.bio, hue: u.hue, createdAt: u.createdAt,
});

/* ----------------------------- users / auth ----------------------------- */

export async function findUserByHandle(handle: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.handle, handle)).limit(1);
  return u ?? null;
}

export async function loginOrRegister(handle: string, name?: string) {
  const db = await getDb();
  const existing = await findUserByHandle(handle);
  if (existing) return { user: existing, created: false };
  const user: User = {
    id: newId(), handle, name: name?.trim() || `@${handle}`, bio: "", hue: hueFromHandle(handle), createdAt: nowIso(),
  };
  await db.insert(users).values(user);
  return { user, created: true };
}

export async function updateProfile(userId: string, patch: { name?: string; bio?: string }) {
  const db = await getDb();
  await db.update(users).set(patch).where(eq(users.id, userId));
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  return u;
}

export async function getProfile(handle: string, viewerId: string | null): Promise<UserProfileDto> {
  const db = await getDb();
  const u = await findUserByHandle(handle);
  if (!u) throw new HttpError(404, "Пользователь не найден");
  const [[p], [fr], [fg], [lk], vf] = await Promise.all([
    db.select({ n: count() }).from(posts).where(eq(posts.authorId, u.id)),
    db.select({ n: count() }).from(follows).where(eq(follows.followeeId, u.id)),
    db.select({ n: count() }).from(follows).where(eq(follows.followerId, u.id)),
    db.select({ n: count() }).from(likes).innerJoin(posts, eq(likes.postId, posts.id)).where(eq(posts.authorId, u.id)),
    viewerId
      ? db.select({ x: follows.followerId }).from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, u.id))).limit(1)
      : Promise.resolve([]),
  ]);
  return {
    ...toUserDto(u),
    stats: { posts: p.n, followers: fr.n, following: fg.n, likesReceived: lk.n },
    viewerFollows: vf.length > 0,
    isViewer: viewerId === u.id,
  };
}

export async function searchUsers(q: string, limit = 8): Promise<UserDto[]> {
  const db = await getDb();
  const pattern = `%${q.toLowerCase()}%`;
  const rows = await db.select().from(users)
    .where(or(like(users.handle, pattern), like(sql`lower(${users.name})`, pattern)))
    .limit(limit);
  return rows.map(toUserDto);
}

export async function suggestedUsers(viewerId: string | null, limit = 4): Promise<Array<UserDto & { followers: number }>> {
  const db = await getDb();
  const rows = await db
    .select({ u: users, followers: sql<number>`(select count(*) from follows f where f.followee_id = ${users.id})` })
    .from(users)
    .where(viewerId
      ? and(sql`${users.id} != ${viewerId}`, sql`${users.id} not in (select followee_id from follows where follower_id = ${viewerId})`)
      : undefined)
    .orderBy(desc(sql`(select count(*) from follows f where f.followee_id = ${users.id})`))
    .limit(limit);
  return rows.map((r) => ({ ...toUserDto(r.u), followers: Number(r.followers) }));
}

/* -------------------------------- posts --------------------------------- */

export type PostFilter = {
  scope?: "all" | "following";
  authorHandle?: string;
  q?: string;
  tag?: string;
  mood?: string;
  cursor?: string | null;
  limit?: number;
};

/** Курсор пагинации — `createdAt|id`, монотонный и устойчивый к вставкам. */
const encodeCursor = (p: { createdAt: string; id: string }) => `${p.createdAt}|${p.id}`;
const decodeCursor = (c?: string | null) => {
  if (!c) return null;
  const i = c.lastIndexOf("|");
  return i > 0 ? { createdAt: c.slice(0, i), id: c.slice(i + 1) } : null;
};

export async function listPosts(f: PostFilter, viewerId: string | null): Promise<Page<PostDto>> {
  const db = await getDb();
  const limit = Math.min(Math.max(f.limit ?? 10, 1), 50);
  const conds = [];

  if (f.scope === "following" && viewerId) {
    conds.push(or(
      eq(posts.authorId, viewerId),
      inArray(posts.authorId, db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, viewerId))),
    ));
  }
  if (f.authorHandle) {
    conds.push(inArray(posts.authorId, db.select({ id: users.id }).from(users).where(eq(users.handle, f.authorHandle))));
  }
  if (f.tag) {
    conds.push(inArray(posts.id, db.select({ id: postTags.postId }).from(postTags).where(eq(postTags.tag, f.tag.toLowerCase()))));
  }
  if (f.mood) conds.push(eq(posts.mood, f.mood));
  if (f.q) {
    const q = f.q.trim();
    if (q.startsWith("#")) {
      conds.push(inArray(posts.id, db.select({ id: postTags.postId }).from(postTags).where(like(postTags.tag, `${q.slice(1).toLowerCase()}%`))));
    } else {
      conds.push(like(sql`lower(${posts.text})`, `%${q.toLowerCase()}%`));
    }
  }
  const cur = decodeCursor(f.cursor);
  if (cur) conds.push(or(lt(posts.createdAt, cur.createdAt), and(eq(posts.createdAt, cur.createdAt), lt(posts.id, cur.id))));

  const rows = await db.select().from(posts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = await hydratePosts(page, viewerId);
  return { items, nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null };
}

/** Догружает автора, теги и счётчики для набора постов (батчем, без N+1). */
async function hydratePosts(rows: (typeof posts.$inferSelect)[], viewerId: string | null): Promise<PostDto[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.authorId))];

  const [authors, tags, likeCounts, commentCounts, viewerLikes] = await Promise.all([
    db.select().from(users).where(inArray(users.id, authorIds)),
    db.select().from(postTags).where(inArray(postTags.postId, ids)),
    db.select({ postId: likes.postId, n: count() }).from(likes).where(inArray(likes.postId, ids)).groupBy(likes.postId),
    db.select({ postId: comments.postId, n: count() }).from(comments).where(inArray(comments.postId, ids)).groupBy(comments.postId),
    viewerId ? db.select({ postId: likes.postId }).from(likes).where(and(eq(likes.userId, viewerId), inArray(likes.postId, ids))) : Promise.resolve([]),
  ]);

  const authorMap = new Map(authors.map((a) => [a.id, toUserDto(a)]));
  const tagMap = new Map<string, string[]>();
  for (const t of tags) tagMap.set(t.postId, [...(tagMap.get(t.postId) ?? []), t.tag]);
  const lc = new Map(likeCounts.map((x) => [x.postId, x.n]));
  const cc = new Map(commentCounts.map((x) => [x.postId, x.n]));
  const liked = new Set(viewerLikes.map((x) => x.postId));

  return rows.map((r) => ({
    id: r.id, text: r.text, mood: r.mood, createdAt: r.createdAt, editedAt: r.editedAt,
    author: authorMap.get(r.authorId)!, tags: tagMap.get(r.id) ?? [],
    likeCount: lc.get(r.id) ?? 0, commentCount: cc.get(r.id) ?? 0, likedByViewer: liked.has(r.id),
  }));
}

export async function getPost(id: string, viewerId: string | null): Promise<PostDto> {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Пост не найден");
  const [dto] = await hydratePosts([row], viewerId);
  return dto;
}

async function syncTags(postId: string, text: string) {
  const db = await getDb();
  await db.delete(postTags).where(eq(postTags.postId, postId));
  const tags = extractTags(text);
  if (tags.length) await db.insert(postTags).values(tags.map((tag) => ({ postId, tag })));
}

async function notifyMentions(actor: User, postId: string, text: string, skipUserId?: string) {
  const handles = extractMentions(text).filter((h) => h !== actor.handle);
  if (!handles.length) return;
  const db = await getDb();
  const targets = await db.select().from(users).where(inArray(users.handle, handles));
  // skipUserId — автор поста, который уже получил уведомление о комментарии; не дублируем.
  for (const t of targets) if (t.id !== skipUserId) await pushNotification({ userId: t.id, actorId: actor.id, type: "mention", postId });
}

export async function createPost(author: User, text: string, mood: string | null): Promise<PostDto> {
  const db = await getDb();
  const id = newId();
  await db.insert(posts).values({ id, authorId: author.id, text, mood, createdAt: nowIso() });
  await syncTags(id, text);
  await notifyMentions(author, id, text);
  return getPost(id, author.id);
}

export async function updatePost(author: User, id: string, patch: { text?: string; mood?: string | null }): Promise<PostDto> {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Пост не найден");
  if (row.authorId !== author.id) throw new HttpError(403, "Можно редактировать только свои посты");
  await db.update(posts).set({ ...patch, editedAt: nowIso() }).where(eq(posts.id, id));
  if (patch.text !== undefined) await syncTags(id, patch.text);
  return getPost(id, author.id);
}

export async function deletePost(author: User, id: string) {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Пост не найден");
  if (row.authorId !== author.id) throw new HttpError(403, "Можно удалять только свои посты");
  // Явно чистим зависимые строки: на Turso PRAGMA foreign_keys может быть выключен.
  await db.delete(notifications).where(eq(notifications.postId, id));
  await db.delete(comments).where(eq(comments.postId, id));
  await db.delete(likes).where(eq(likes.postId, id));
  await db.delete(postTags).where(eq(postTags.postId, id));
  await db.delete(posts).where(eq(posts.id, id));
}

/* -------------------------------- likes --------------------------------- */

export async function setLike(viewer: User, postId: string, liked: boolean) {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!row) throw new HttpError(404, "Пост не найден");
  if (liked) {
    const res = await db.insert(likes).values({ userId: viewer.id, postId, createdAt: nowIso() }).onConflictDoNothing().returning();
    if (res.length && row.authorId !== viewer.id) await pushNotification({ userId: row.authorId, actorId: viewer.id, type: "like", postId });
  } else {
    await db.delete(likes).where(and(eq(likes.userId, viewer.id), eq(likes.postId, postId)));
  }
  const [{ n }] = await db.select({ n: count() }).from(likes).where(eq(likes.postId, postId));
  return { likeCount: n, likedByViewer: liked };
}

/* ------------------------------ comments -------------------------------- */

export async function listComments(postId: string): Promise<CommentDto[]> {
  const db = await getDb();
  const rows = await db.select({ c: comments, u: users }).from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt);
  return rows.map(({ c, u }) => ({ id: c.id, text: c.text, createdAt: c.createdAt, author: toUserDto(u) }));
}

export async function addComment(author: User, postId: string, text: string): Promise<CommentDto> {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!row) throw new HttpError(404, "Пост не найден");
  const id = newId();
  const createdAt = nowIso();
  await db.insert(comments).values({ id, postId, authorId: author.id, text, createdAt });
  if (row.authorId !== author.id) await pushNotification({ userId: row.authorId, actorId: author.id, type: "comment", postId });
  await notifyMentions(author, postId, text, row.authorId);
  return { id, text, createdAt, author: toUserDto(author) };
}

/* ------------------------------- follows -------------------------------- */

export async function setFollow(viewer: User, handle: string, follow: boolean) {
  const db = await getDb();
  const target = await findUserByHandle(handle);
  if (!target) throw new HttpError(404, "Пользователь не найден");
  if (target.id === viewer.id) throw new HttpError(400, "Нельзя подписаться на себя");
  if (follow) {
    const res = await db.insert(follows).values({ followerId: viewer.id, followeeId: target.id, createdAt: nowIso() }).onConflictDoNothing().returning();
    if (res.length) await pushNotification({ userId: target.id, actorId: viewer.id, type: "follow", postId: null });
  } else {
    await db.delete(follows).where(and(eq(follows.followerId, viewer.id), eq(follows.followeeId, target.id)));
  }
  const [{ n }] = await db.select({ n: count() }).from(follows).where(eq(follows.followeeId, target.id));
  return { followers: n, viewerFollows: follow };
}

/* ---------------------------- notifications ----------------------------- */

async function pushNotification(n: { userId: string; actorId: string; type: NotificationDto["type"]; postId: string | null }) {
  const db = await getDb();
  await db.insert(notifications).values({ id: newId(), ...n, read: 0, createdAt: nowIso() });
}

export async function listNotifications(userId: string, limit = 30): Promise<{ items: NotificationDto[]; unread: number }> {
  const db = await getDb();
  const rows = await db.select({ n: notifications, actor: users, postText: posts.text })
    .from(notifications)
    .innerJoin(users, eq(notifications.actorId, users.id))
    .leftJoin(posts, eq(notifications.postId, posts.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  const [{ unread }] = await db.select({ unread: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));
  return {
    unread,
    items: rows.map(({ n, actor, postText }) => ({
      id: n.id, type: n.type as NotificationDto["type"], read: n.read === 1, createdAt: n.createdAt, actor: toUserDto(actor),
      post: n.postId ? { id: n.postId, excerpt: (postText ?? "").slice(0, 80) } : null,
    })),
  };
}

export async function unreadCount(userId: string) {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));
  return n;
}

export async function markAllRead(userId: string) {
  const db = await getDb();
  await db.update(notifications).set({ read: 1 }).where(eq(notifications.userId, userId));
}

/* ------------------------------ discovery ------------------------------- */

export async function trendingTags(limit = 8): Promise<TrendingTag[]> {
  const db = await getDb();
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const rows = await db.select({ tag: postTags.tag, n: count() }).from(postTags)
    .innerJoin(posts, eq(postTags.postId, posts.id))
    .where(gt(posts.createdAt, since))
    .groupBy(postTags.tag)
    .orderBy(desc(count()), postTags.tag)
    .limit(limit);
  return rows.map((r) => ({ tag: r.tag, count: r.n }));
}

export async function socialGraph(): Promise<GraphDto> {
  const db = await getDb();
  const [us, fs, pc, fc] = await Promise.all([
    db.select().from(users),
    db.select().from(follows),
    db.select({ id: posts.authorId, n: count() }).from(posts).groupBy(posts.authorId),
    db.select({ id: follows.followeeId, n: count() }).from(follows).groupBy(follows.followeeId),
  ]);
  const pcm = new Map(pc.map((x) => [x.id, x.n]));
  const fcm = new Map(fc.map((x) => [x.id, x.n]));
  return {
    nodes: us.map((u) => ({ ...toUserDto(u), posts: pcm.get(u.id) ?? 0, followers: fcm.get(u.id) ?? 0 })),
    links: fs.map((f) => ({ source: f.followerId, target: f.followeeId })),
  };
}
