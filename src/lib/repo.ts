import { and, desc, eq, inArray, like, lt, or, sql, count, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { HttpError } from "./auth";
import { newId, nowIso } from "./ids";
import { extractMentions, extractTags, hueFromHandle } from "./text";
import type { CommentDto, GraphDto, MediaDto, NotificationDto, Page, PostDto, TrendingTag, UserDto, UserProfileDto } from "./types";
import type { Media, User } from "@/db/schema";
import { BOT_HANDLE } from "./bot";

/**
 * Репозиторий — единственное место, где живёт SQL.
 * Route handlers только валидируют вход и вызывают функции отсюда.
 */

const { users, posts, postTags, likes, comments, commentLikes, follows, notifications, media, postMedia, bookmarks } = schema;

export const toUserDto = (u: User): UserDto => ({
  id: u.id, handle: u.handle, name: u.name, bio: u.bio, hue: u.hue, avatarUrl: u.avatarUrl ?? null, cover: u.cover ?? null, createdAt: u.createdAt,
});

export const COVER_PRESETS = 6;

export const toMediaDto = (m: Media): MediaDto => ({
  id: m.id, kind: m.kind as MediaDto["kind"], mime: m.mime, url: m.url, width: m.width, height: m.height,
});

/* -------------------------------- media --------------------------------- */

export async function createMedia(m: Omit<Media, "createdAt">): Promise<MediaDto> {
  const db = await getDb();
  const row: Media = { ...m, createdAt: nowIso() };
  await db.insert(media).values(row);
  return toMediaDto(row);
}

/** Проверяет, что все медиа существуют и принадлежат автору. */
async function ownedMedia(ownerId: string, ids: string[]) {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db.select().from(media).where(and(inArray(media.id, ids), eq(media.ownerId, ownerId)));
  if (rows.length !== ids.length) throw new HttpError(400, "Некоторые файлы не найдены или принадлежат другому пользователю");
  return rows;
}

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
    id: newId(), handle, name: name?.trim() || `@${handle}`, bio: "", hue: hueFromHandle(handle), avatarUrl: null, cover: null, createdAt: nowIso(),
  };
  await db.insert(users).values(user);
  return { user, created: true };
}

export async function updateProfile(userId: string, patch: { name?: string; bio?: string; avatarMediaId?: string | null; coverMediaId?: string | null; coverPreset?: number | null }) {
  const db = await getDb();
  const set: Partial<User> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.bio !== undefined) set.bio = patch.bio;
  // Аватар: null — убрать, id — взять URL загруженного пользователем изображения.
  if (patch.avatarMediaId !== undefined) {
    if (patch.avatarMediaId === null) set.avatarUrl = null;
    else {
      const [m] = await ownedMedia(userId, [patch.avatarMediaId]);
      if (m.kind !== "image") throw new HttpError(400, "Аватар должен быть изображением");
      set.avatarUrl = m.url;
    }
  }
  if (patch.coverMediaId !== undefined && patch.coverMediaId !== null) {
    const [m] = await ownedMedia(userId, [patch.coverMediaId]);
    if (m.kind !== "image") throw new HttpError(400, "Обложка должна быть изображением");
    set.cover = m.url;
  } else if (patch.coverPreset !== undefined && patch.coverPreset !== null) {
    if (patch.coverPreset < 0 || patch.coverPreset >= COVER_PRESETS) throw new HttpError(400, "Нет такого фона");
    set.cover = `preset:${patch.coverPreset}`;
  } else if (patch.coverMediaId === null || patch.coverPreset === null) {
    set.cover = null;
  }
  if (Object.keys(set).length) await db.update(users).set(set).where(eq(users.id, userId));
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
    .where(and(
      sql`${users.handle} != ${BOT_HANDLE}`,
      viewerId ? and(sql`${users.id} != ${viewerId}`, sql`${users.id} not in (select followee_id from follows where follower_id = ${viewerId})`) : undefined,
    ))
    .orderBy(desc(sql`(select count(*) from follows f where f.followee_id = ${users.id})`))
    .limit(limit);
  return rows.map((r) => ({ ...toUserDto(r.u), followers: Number(r.followers) }));
}

/* -------------------------------- posts --------------------------------- */

export type PostFilter = {
  scope?: "all" | "following" | "bookmarks" | "hot";
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
  if (f.scope === "bookmarks") {
    if (!viewerId) return { items: [], nextCursor: null };
    conds.push(inArray(posts.id, db.select({ id: bookmarks.postId }).from(bookmarks).where(eq(bookmarks.userId, viewerId))));
  }
  if (f.scope === "hot") {
    // «Горячее»: вовлечённость с затуханием по времени (как у Hacker News). Без курсора — топ-30.
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    conds.push(gt(posts.createdAt, since), sql`${posts.repostOfId} IS NULL OR length(${posts.text}) > 0`);
    const score = sql`(
      (select count(*) from likes l where l.post_id = ${posts.id}) * 2 +
      (select count(*) from comments c where c.post_id = ${posts.id}) * 3 +
      (select count(*) from posts r where r.repost_of_id = ${posts.id}) * 4 + 1.0
    ) / power((julianday('now') - julianday(${posts.createdAt})) * 24 + 2, 1.4)`;
    const rows = await db.select().from(posts).where(and(...conds)).orderBy(desc(score)).limit(30);
    return { items: await hydratePosts(rows, viewerId), nextCursor: null };
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

/** Догружает автора, теги, медиа, исходник репоста и счётчики для набора постов (батчем, без N+1). */
async function hydratePosts(rows: (typeof posts.$inferSelect)[], viewerId: string | null, depth = 0): Promise<PostDto[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const repostIds = [...new Set(rows.map((r) => r.repostOfId).filter((x): x is string => !!x))];

  const [authors, tags, med, likeCounts, commentCounts, repostCounts, viewerLikes, viewerReposts, viewerBookmarks, originals] = await Promise.all([
    db.select().from(users).where(inArray(users.id, authorIds)),
    db.select().from(postTags).where(inArray(postTags.postId, ids)),
    db.select({ pm: postMedia, m: media }).from(postMedia).innerJoin(media, eq(postMedia.mediaId, media.id)).where(inArray(postMedia.postId, ids)).orderBy(postMedia.position),
    db.select({ postId: likes.postId, n: count() }).from(likes).where(inArray(likes.postId, ids)).groupBy(likes.postId),
    db.select({ postId: comments.postId, n: count() }).from(comments).where(inArray(comments.postId, ids)).groupBy(comments.postId),
    db.select({ postId: posts.repostOfId, n: count() }).from(posts).where(inArray(posts.repostOfId, ids)).groupBy(posts.repostOfId),
    viewerId ? db.select({ postId: likes.postId }).from(likes).where(and(eq(likes.userId, viewerId), inArray(likes.postId, ids))) : Promise.resolve([]),
    viewerId ? db.select({ postId: posts.repostOfId }).from(posts).where(and(eq(posts.authorId, viewerId), inArray(posts.repostOfId, ids), eq(posts.text, ""))) : Promise.resolve([]),
    viewerId ? db.select({ postId: bookmarks.postId }).from(bookmarks).where(and(eq(bookmarks.userId, viewerId), inArray(bookmarks.postId, ids))) : Promise.resolve([]),
    repostIds.length && depth === 0 ? db.select().from(posts).where(inArray(posts.id, repostIds)) : Promise.resolve([]),
  ]);

  const authorMap = new Map(authors.map((a) => [a.id, toUserDto(a)]));
  const tagMap = new Map<string, string[]>();
  for (const t of tags) tagMap.set(t.postId, [...(tagMap.get(t.postId) ?? []), t.tag]);
  const mediaMap = new Map<string, MediaDto[]>();
  for (const { pm, m } of med) mediaMap.set(pm.postId, [...(mediaMap.get(pm.postId) ?? []), toMediaDto(m)]);
  const lc = new Map(likeCounts.map((x) => [x.postId, x.n]));
  const cc = new Map(commentCounts.map((x) => [x.postId, x.n]));
  const rc = new Map(repostCounts.map((x) => [x.postId as string, x.n]));
  const liked = new Set(viewerLikes.map((x) => x.postId));
  const reposted = new Set(viewerReposts.map((x) => x.postId));
  const marked = new Set(viewerBookmarks.map((x) => x.postId));
  const origDtos = await hydratePosts(originals, viewerId, depth + 1);
  const origMap = new Map(origDtos.map((o) => [o.id, o]));

  return rows.map((r) => ({
    id: r.id, text: r.text, mood: r.mood, createdAt: r.createdAt, editedAt: r.editedAt,
    author: authorMap.get(r.authorId)!, tags: tagMap.get(r.id) ?? [], media: mediaMap.get(r.id) ?? [],
    repostOf: r.repostOfId ? origMap.get(r.repostOfId) ?? null : null,
    isRepost: !!r.repostOfId && r.text === "",
    likeCount: lc.get(r.id) ?? 0, commentCount: cc.get(r.id) ?? 0, repostCount: rc.get(r.id) ?? 0,
    likedByViewer: liked.has(r.id), repostedByViewer: reposted.has(r.id), bookmarkedByViewer: marked.has(r.id),
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

export type NewPost = { text: string; mood: string | null; mediaIds: string[]; repostOfId?: string | null };

export async function createPost(author: User, input: NewPost): Promise<PostDto> {
  const db = await getDb();
  const text = input.text.trim();
  if (!text && !input.mediaIds.length && !input.repostOfId) throw new HttpError(400, "Пост не может быть пустым");
  let original: typeof posts.$inferSelect | null = null;
  if (input.repostOfId) {
    const [o] = await db.select().from(posts).where(eq(posts.id, input.repostOfId)).limit(1);
    if (!o) throw new HttpError(404, "Исходный пост не найден");
    // Репостим исходник, а не репост репоста.
    original = o.repostOfId && o.text === "" ? (await db.select().from(posts).where(eq(posts.id, o.repostOfId)).limit(1))[0] ?? o : o;
    if (!text) {
      const [dup] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.authorId, author.id), eq(posts.repostOfId, original.id), eq(posts.text, ""))).limit(1);
      if (dup) throw new HttpError(409, "Вы уже репостнули этот пост");
    }
  }
  const files = await ownedMedia(author.id, input.mediaIds);
  const id = newId();
  await db.insert(posts).values({ id, authorId: author.id, text, mood: input.mood, repostOfId: original?.id ?? null, createdAt: nowIso() });
  if (files.length) await db.insert(postMedia).values(input.mediaIds.map((mediaId, position) => ({ postId: id, mediaId, position })));
  await syncTags(id, text);
  await notifyMentions(author, id, text);
  if (original && original.authorId !== author.id) {
    await pushNotification({ userId: original.authorId, actorId: author.id, type: text ? "quote" : "repost", postId: id });
  }
  return getPost(id, author.id);
}

export async function undoRepost(author: User, originalId: string) {
  const db = await getDb();
  const mine = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.authorId, author.id), eq(posts.repostOfId, originalId), eq(posts.text, "")));
  for (const r of mine) await deletePost(author, r.id);
  const [{ n }] = await db.select({ n: count() }).from(posts).where(eq(posts.repostOfId, originalId));
  return { repostCount: n, repostedByViewer: false };
}

export async function updatePost(author: User, id: string, patch: { text?: string; mood?: string | null; mediaIds?: string[] }): Promise<PostDto> {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Пост не найден");
  if (row.authorId !== author.id) throw new HttpError(403, "Можно редактировать только свои посты");
  const { mediaIds, ...rest } = patch;
  if (mediaIds) {
    await ownedMedia(author.id, mediaIds);
    await db.delete(postMedia).where(eq(postMedia.postId, id));
    if (mediaIds.length) await db.insert(postMedia).values(mediaIds.map((mediaId, position) => ({ postId: id, mediaId, position })));
  }
  const nextText = rest.text !== undefined ? rest.text.trim() : row.text;
  const nextMediaCount = mediaIds ? mediaIds.length : (await db.select({ n: count() }).from(postMedia).where(eq(postMedia.postId, id)))[0].n;
  if (!nextText && !nextMediaCount && !row.repostOfId) throw new HttpError(400, "Пост не может быть пустым");
  await db.update(posts).set({ ...rest, text: nextText, editedAt: nowIso() }).where(eq(posts.id, id));
  await syncTags(id, nextText);
  return getPost(id, author.id);
}

export async function deletePost(author: User, id: string) {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Пост не найден");
  if (row.authorId !== author.id) throw new HttpError(403, "Можно удалять только свои посты");
  // Явно чистим зависимые строки: на Turso PRAGMA foreign_keys может быть выключен.
  await db.delete(notifications).where(eq(notifications.postId, id));
  await db.delete(commentLikes).where(inArray(commentLikes.commentId, db.select({ id: comments.id }).from(comments).where(eq(comments.postId, id))));
  await db.delete(comments).where(eq(comments.postId, id));
  await db.delete(likes).where(eq(likes.postId, id));
  await db.delete(bookmarks).where(eq(bookmarks.postId, id));
  await db.delete(postTags).where(eq(postTags.postId, id));
  await db.delete(postMedia).where(eq(postMedia.postId, id));
  // Чистые репосты удалённого поста исчезают; цитаты остаются (исходник покажется как «удалён»).
  const pure = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.repostOfId, id), eq(posts.text, "")));
  for (const r of pure) { await db.delete(notifications).where(eq(notifications.postId, r.id)); await db.delete(posts).where(eq(posts.id, r.id)); }
  await db.update(posts).set({ repostOfId: null }).where(eq(posts.repostOfId, id));
  await db.delete(posts).where(eq(posts.id, id));
}

/* ------------------------------ bookmarks ------------------------------- */

export async function setBookmark(viewer: User, postId: string, on: boolean) {
  const db = await getDb();
  const [row] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!row) throw new HttpError(404, "Пост не найден");
  if (on) await db.insert(bookmarks).values({ userId: viewer.id, postId, createdAt: nowIso() }).onConflictDoNothing();
  else await db.delete(bookmarks).where(and(eq(bookmarks.userId, viewer.id), eq(bookmarks.postId, postId)));
  return { bookmarkedByViewer: on };
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

export async function listComments(postId: string, viewerId: string | null): Promise<CommentDto[]> {
  const db = await getDb();
  const rows = await db.select({ c: comments, u: users }).from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.c.id);
  const [lc, mine] = await Promise.all([
    db.select({ id: commentLikes.commentId, n: count() }).from(commentLikes).where(inArray(commentLikes.commentId, ids)).groupBy(commentLikes.commentId),
    viewerId ? db.select({ id: commentLikes.commentId }).from(commentLikes).where(and(eq(commentLikes.userId, viewerId), inArray(commentLikes.commentId, ids))) : Promise.resolve([]),
  ]);
  const lcm = new Map(lc.map((x) => [x.id, x.n]));
  const liked = new Set(mine.map((x) => x.id));
  return rows.map(({ c, u }) => ({
    id: c.id, text: c.text, createdAt: c.createdAt, author: toUserDto(u), parentId: c.parentId ?? null,
    likeCount: lcm.get(c.id) ?? 0, likedByViewer: liked.has(c.id),
  }));
}

export async function addComment(author: User, postId: string, text: string, parentId: string | null = null): Promise<CommentDto> {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!row) throw new HttpError(404, "Пост не найден");
  let parent: typeof comments.$inferSelect | null = null;
  if (parentId) {
    [parent] = await db.select().from(comments).where(and(eq(comments.id, parentId), eq(comments.postId, postId))).limit(1);
    if (!parent) throw new HttpError(404, "Комментарий, на который вы отвечаете, не найден");
  }
  const id = newId();
  const createdAt = nowIso();
  await db.insert(comments).values({ id, postId, authorId: author.id, text, parentId: parent?.id ?? null, createdAt });
  if (parent && parent.authorId !== author.id) await pushNotification({ userId: parent.authorId, actorId: author.id, type: "reply", postId });
  if (row.authorId !== author.id && row.authorId !== parent?.authorId) await pushNotification({ userId: row.authorId, actorId: author.id, type: "comment", postId });
  await notifyMentions(author, postId, text, row.authorId);
  return { id, text, createdAt, author: toUserDto(author), parentId: parent?.id ?? null, likeCount: 0, likedByViewer: false };
}

export async function setCommentLike(viewer: User, commentId: string, liked: boolean) {
  const db = await getDb();
  const [c] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!c) throw new HttpError(404, "Комментарий не найден");
  if (liked) {
    const res = await db.insert(commentLikes).values({ userId: viewer.id, commentId, createdAt: nowIso() }).onConflictDoNothing().returning();
    if (res.length && c.authorId !== viewer.id) await pushNotification({ userId: c.authorId, actorId: viewer.id, type: "comment_like", postId: c.postId });
  } else {
    await db.delete(commentLikes).where(and(eq(commentLikes.userId, viewer.id), eq(commentLikes.commentId, commentId)));
  }
  const [{ n }] = await db.select({ n: count() }).from(commentLikes).where(eq(commentLikes.commentId, commentId));
  return { likeCount: n, likedByViewer: liked };
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

export async function pushNotification(n: { userId: string; actorId: string; type: NotificationDto["type"]; postId: string | null; link?: string | null }) {
  const db = await getDb();
  await db.insert(notifications).values({ id: newId(), userId: n.userId, actorId: n.actorId, type: n.type, postId: n.postId, link: n.link ?? null, read: 0, createdAt: nowIso() });
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
      post: n.postId ? { id: n.postId, excerpt: (postText ?? "").slice(0, 80) } : null, link: n.link ?? null,
    })),
  };
}

/** Новые посты (всей сети) после `sinceIso` — для живой ленты. */
export async function postsSince(sinceIso: string, viewerId: string | null, limit = 20): Promise<PostDto[]> {
  const db = await getDb();
  const rows = await db.select().from(posts).where(gt(posts.createdAt, sinceIso)).orderBy(desc(posts.createdAt), desc(posts.id)).limit(limit);
  return hydratePosts(rows, viewerId);
}

/** Посты, у которых после `sinceIso` изменились лайки/комментарии/репосты — клиент перечитает их счётчики. */
export async function activitySince(sinceIso: string, limit = 30): Promise<string[]> {
  const db = await getDb();
  const [l, c, r, cl] = await Promise.all([
    db.select({ id: likes.postId }).from(likes).where(gt(likes.createdAt, sinceIso)).limit(limit),
    db.select({ id: comments.postId }).from(comments).where(gt(comments.createdAt, sinceIso)).limit(limit),
    db.select({ id: posts.repostOfId }).from(posts).where(and(gt(posts.createdAt, sinceIso), sql`${posts.repostOfId} IS NOT NULL`)).limit(limit),
    db.select({ id: comments.postId }).from(commentLikes).innerJoin(comments, eq(commentLikes.commentId, comments.id)).where(gt(commentLikes.createdAt, sinceIso)).limit(limit),
  ]);
  return [...new Set([...l, ...c, ...r, ...cl].map((x) => x.id).filter((x): x is string => !!x))].slice(0, limit);
}

/** Новые уведомления после момента `sinceIso` (для realtime-потока). */
export async function notificationsSince(userId: string, sinceIso: string, limit = 10): Promise<NotificationDto[]> {
  const db = await getDb();
  const rows = await db.select({ n: notifications, actor: users, postText: posts.text })
    .from(notifications)
    .innerJoin(users, eq(notifications.actorId, users.id))
    .leftJoin(posts, eq(notifications.postId, posts.id))
    .where(and(eq(notifications.userId, userId), gt(notifications.createdAt, sinceIso)))
    .orderBy(notifications.createdAt)
    .limit(limit);
  return rows.map(({ n, actor, postText }) => ({
    id: n.id, type: n.type as NotificationDto["type"], read: n.read === 1, createdAt: n.createdAt, actor: toUserDto(actor),
    post: n.postId ? { id: n.postId, excerpt: (postText ?? "").slice(0, 80) } : null, link: n.link ?? null,
  }));
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
    db.select().from(users).where(sql`${users.handle} != ${BOT_HANDLE}`),
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
