import { and, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { HttpError, isAdmin, isBanned } from "./auth";
import { newId, nowIso } from "./ids";
import { toMeDto, toUserDto } from "./repo";
import { normalizeTarget } from "./otp";
import { HANDLE_RE, hueFromHandle } from "./text";
import { BOT_HANDLE } from "./bot";
import type { AdminLogDto, AdminStatsDto, AdminUserDto } from "./types";
import type { User } from "@/db/schema";

/**
 * Администрирование: пользователи (поиск, создание, правка, удаление), баны, статистика, журнал.
 * Каждое действие пишется в admin_log.
 */
const { users, posts, comments, follows, likes, commentLikes, bookmarks, notifications, media, postMedia, conversations, conversationMembers, messages, conversationReads, callParticipants, callSignals, calls, adminLog } = schema;

async function log(adminId: string, action: string, targetId: string | null, details?: unknown) {
  const db = await getDb();
  await db.insert(adminLog).values({ id: newId(), adminId, action, targetId, details: details ? JSON.stringify(details) : null, createdAt: nowIso() });
}

async function toAdminDto(u: User): Promise<AdminUserDto> {
  const db = await getDb();
  const [[p], [f], [c], [last]] = await Promise.all([
    db.select({ n: count() }).from(posts).where(eq(posts.authorId, u.id)),
    db.select({ n: count() }).from(follows).where(eq(follows.followeeId, u.id)),
    db.select({ n: count() }).from(comments).where(eq(comments.authorId, u.id)),
    db.select({ at: posts.createdAt }).from(posts).where(eq(posts.authorId, u.id)).orderBy(desc(posts.createdAt)).limit(1),
  ]);
  return { ...toMeDto(u), role: (u.role === "admin" ? "admin" : "user"), stats: { posts: p.n, followers: f.n, comments: c.n }, lastActivityAt: last?.at ?? null };
}

export async function adminListUsers(q: string, page = 1, pageSize = 25, filter: "all" | "banned" | "admins" = "all") {
  const db = await getDb();
  const conds = [];
  if (q.trim()) {
    const pat = `%${q.trim().toLowerCase()}%`;
    conds.push(or(like(users.handle, pat), like(sql`lower(${users.name})`, pat), like(users.email, pat), like(users.phone, pat)));
  }
  if (filter === "banned") conds.push(sql`${users.bannedUntil} IS NOT NULL AND (${users.bannedUntil} = 'forever' OR ${users.bannedUntil} > ${nowIso()})`);
  if (filter === "admins") conds.push(eq(users.role, "admin"));
  const where = conds.length ? and(...conds) : undefined;
  const [[total], rows] = await Promise.all([
    db.select({ n: count() }).from(users).where(where),
    db.select().from(users).where(where).orderBy(desc(users.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
  ]);
  return { total: total.n, page, pageSize, items: await Promise.all(rows.map(toAdminDto)) };
}

export async function adminGetUser(id: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) throw new HttpError(404, "Пользователь не найден");
  return u;
}

export type AdminUserInput = { handle?: string; name?: string; bio?: string; email?: string | null; phone?: string | null; birthday?: string | null; role?: "user" | "admin" };

async function assertUnique(field: "handle" | "email" | "phone", value: string, exceptId?: string) {
  const db = await getDb();
  const col = field === "handle" ? users.handle : field === "email" ? users.email : users.phone;
  const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(col, value), exceptId ? sql`${users.id} != ${exceptId}` : undefined)).limit(1);
  if (taken) throw new HttpError(409, field === "handle" ? "Ник уже занят" : field === "email" ? "Почта уже используется" : "Телефон уже используется");
}

function normalizeInput(input: AdminUserInput, exceptId?: string) {
  const out: Partial<User> = {};
  const checks: Array<Promise<void>> = [];
  if (input.handle !== undefined) {
    const h = input.handle.trim().toLowerCase();
    if (!HANDLE_RE.test(h)) throw new HttpError(400, "Ник: 2–32 символа, латиница, цифры, «_»");
    if (h === BOT_HANDLE) throw new HttpError(400, "Этот ник занят помощником");
    out.handle = h; checks.push(assertUnique("handle", h, exceptId));
  }
  if (input.name !== undefined) { if (input.name.trim().length < 1) throw new HttpError(400, "Имя не может быть пустым"); out.name = input.name.trim().slice(0, 60); }
  if (input.bio !== undefined) out.bio = input.bio.trim().slice(0, 200);
  if (input.email !== undefined) {
    if (input.email === null || input.email === "") out.email = null;
    else { const t = normalizeTarget(input.email); if (t.channel !== "email") throw new HttpError(400, "Некорректная почта"); out.email = t.target; checks.push(assertUnique("email", t.target, exceptId)); }
  }
  if (input.phone !== undefined) {
    if (input.phone === null || input.phone === "") out.phone = null;
    else { const t = normalizeTarget(input.phone); if (t.channel !== "sms") throw new HttpError(400, "Некорректный телефон"); out.phone = t.target; checks.push(assertUnique("phone", t.target, exceptId)); }
  }
  if (input.birthday !== undefined) {
    if (!input.birthday) out.birthday = null;
    else { if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthday)) throw new HttpError(400, "Дата рождения в формате ГГГГ-ММ-ДД"); out.birthday = input.birthday; }
  }
  if (input.role !== undefined) out.role = input.role;
  return { out, checks };
}

export async function adminCreateUser(admin: User, input: AdminUserInput) {
  if (!input.handle || !input.name) throw new HttpError(400, "Ник и имя обязательны");
  const { out, checks } = normalizeInput(input);
  await Promise.all(checks);
  const db = await getDb();
  const user: User = {
    id: newId(), handle: out.handle!, name: out.name!, bio: out.bio ?? "", hue: hueFromHandle(out.handle!), avatarUrl: null, cover: null,
    phone: out.phone ?? null, email: out.email ?? null, birthday: out.birthday ?? null, role: out.role ?? "user", bannedUntil: null, banReason: null, galaxyId: null, createdAt: nowIso(),
  };
  await db.insert(users).values(user);
  await log(admin.id, "user.create", user.id, { handle: user.handle });
  return toAdminDto(user);
}

export async function adminUpdateUser(admin: User, id: string, input: AdminUserInput) {
  const u = await adminGetUser(id);
  if (u.handle === BOT_HANDLE && (input.handle || input.role)) throw new HttpError(400, "Помощника нельзя переименовать или менять роль");
  if (input.role === "user" && u.id === admin.id) throw new HttpError(400, "Нельзя снять роль администратора с себя");
  const { out, checks } = normalizeInput(input, id);
  await Promise.all(checks);
  const db = await getDb();
  if (Object.keys(out).length) await db.update(users).set(out).where(eq(users.id, id));
  await log(admin.id, "user.update", id, out);
  return toAdminDto(await adminGetUser(id));
}

/** Бан на срок (days) или навсегда (days=null). reason — покажется пользователю при входе. */
export async function adminBan(admin: User, id: string, days: number | null, reason: string) {
  const u = await adminGetUser(id);
  if (u.id === admin.id) throw new HttpError(400, "Нельзя заблокировать себя");
  if (isAdmin(u)) throw new HttpError(400, "Сначала снимите роль администратора");
  if (u.handle === BOT_HANDLE) throw new HttpError(400, "Помощника нельзя заблокировать");
  const db = await getDb();
  const until = days === null ? "forever" : new Date(Date.now() + days * 86400_000).toISOString();
  await db.update(users).set({ bannedUntil: until, banReason: reason.trim().slice(0, 200) || null }).where(eq(users.id, id));
  await log(admin.id, "user.ban", id, { until, reason });
  return toAdminDto(await adminGetUser(id));
}

export async function adminUnban(admin: User, id: string) {
  await adminGetUser(id);
  const db = await getDb();
  await db.update(users).set({ bannedUntil: null, banReason: null }).where(eq(users.id, id));
  await log(admin.id, "user.unban", id);
  return toAdminDto(await adminGetUser(id));
}

/** Полное удаление пользователя со всем содержимым (явно, без надежды на каскад в Turso). */
export async function adminDeleteUser(admin: User, id: string) {
  const u = await adminGetUser(id);
  if (u.id === admin.id) throw new HttpError(400, "Нельзя удалить себя");
  if (u.handle === BOT_HANDLE) throw new HttpError(400, "Помощника нельзя удалить");
  const db = await getDb();
  const myPosts = db.select({ id: posts.id }).from(posts).where(eq(posts.authorId, id));
  const myComments = db.select({ id: comments.id }).from(comments).where(eq(comments.authorId, id));
  // лайки/закладки/комментарии/уведомления вокруг постов пользователя и его собственные
  await db.delete(commentLikes).where(or(eq(commentLikes.userId, id), inArray(commentLikes.commentId, myComments), inArray(commentLikes.commentId, db.select({ id: comments.id }).from(comments).where(inArray(comments.postId, myPosts)))));
  await db.delete(comments).where(or(eq(comments.authorId, id), inArray(comments.postId, myPosts)));
  await db.delete(likes).where(or(eq(likes.userId, id), inArray(likes.postId, myPosts)));
  await db.delete(bookmarks).where(or(eq(bookmarks.userId, id), inArray(bookmarks.postId, myPosts)));
  await db.delete(notifications).where(or(eq(notifications.userId, id), eq(notifications.actorId, id), inArray(notifications.postId, myPosts)));
  await db.delete(postMedia).where(inArray(postMedia.postId, myPosts));
  await db.update(posts).set({ repostOfId: null }).where(inArray(posts.repostOfId, myPosts));
  await db.delete(posts).where(eq(posts.authorId, id));
  await db.delete(follows).where(or(eq(follows.followerId, id), eq(follows.followeeId, id)));
  // сообщения: личные диалоги удаляем целиком, из групп — выходим
  const dms = db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.isGroup, 0), or(eq(conversations.userA, id), eq(conversations.userB, id))));
  await db.delete(conversationReads).where(or(eq(conversationReads.userId, id), inArray(conversationReads.conversationId, dms)));
  await db.delete(messages).where(or(eq(messages.senderId, id), inArray(messages.conversationId, dms)));
  await db.delete(conversationMembers).where(eq(conversationMembers.userId, id));
  await db.delete(conversations).where(inArray(conversations.id, dms));
  // звонки
  await db.delete(callSignals).where(eq(callSignals.fromId, id));
  await db.delete(callParticipants).where(eq(callParticipants.userId, id));
  await db.delete(calls).where(eq(calls.hostId, id));
  await db.delete(media).where(eq(media.ownerId, id));
  await db.delete(users).where(eq(users.id, id));
  await log(admin.id, "user.delete", id, { handle: u.handle, name: u.name });
  return { ok: true };
}

export async function adminDeletePost(admin: User, postId: string) {
  const db = await getDb();
  const [p] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!p) throw new HttpError(404, "Пост не найден");
  await db.delete(notifications).where(eq(notifications.postId, postId));
  await db.delete(commentLikes).where(inArray(commentLikes.commentId, db.select({ id: comments.id }).from(comments).where(eq(comments.postId, postId))));
  await db.delete(comments).where(eq(comments.postId, postId));
  await db.delete(likes).where(eq(likes.postId, postId));
  await db.delete(bookmarks).where(eq(bookmarks.postId, postId));
  await db.delete(postMedia).where(eq(postMedia.postId, postId));
  await db.update(posts).set({ repostOfId: null }).where(eq(posts.repostOfId, postId));
  await db.delete(posts).where(eq(posts.id, postId));
  await log(admin.id, "post.delete", postId, { authorId: p.authorId, text: p.text.slice(0, 80) });
  return { ok: true };
}

export async function adminStats(): Promise<AdminStatsDto> {
  const db = await getDb();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = today.toISOString();
  const [[u], [b], [p], [c], [m], [cl], [ut], [pt]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(sql`${users.bannedUntil} IS NOT NULL AND (${users.bannedUntil} = 'forever' OR ${users.bannedUntil} > ${nowIso()})`),
    db.select({ n: count() }).from(posts),
    db.select({ n: count() }).from(comments),
    db.select({ n: count() }).from(messages),
    db.select({ n: count() }).from(calls),
    db.select({ n: count() }).from(users).where(sql`${users.createdAt} >= ${t}`),
    db.select({ n: count() }).from(posts).where(sql`${posts.createdAt} >= ${t}`),
  ]);
  return { users: u.n, banned: b.n, posts: p.n, comments: c.n, messages: m.n, calls: cl.n, today: { users: ut.n, posts: pt.n } };
}

export async function adminLogList(limit = 50): Promise<AdminLogDto[]> {
  const db = await getDb();
  const rows = await db.select({ l: adminLog, a: users }).from(adminLog).leftJoin(users, eq(adminLog.adminId, users.id)).orderBy(desc(adminLog.createdAt)).limit(limit);
  return rows.map(({ l, a }) => ({ id: l.id, admin: a ? toUserDto(a) : null, action: l.action, targetId: l.targetId, details: l.details, createdAt: l.createdAt }));
}

export { isBanned };
