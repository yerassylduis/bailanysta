import { and, asc, desc, eq, gt, sql, count, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { HttpError } from "./auth";
import { newId, nowIso } from "./ids";
import { findUserByHandle, toMediaDto, toUserDto } from "./repo";
import type { ConversationDto, MessageDto, UserDto } from "./types";
import type { User } from "@/db/schema";
import { BOT_HANDLE, WELCOME, botReply } from "./bot";

/**
 * Сообщения («Хат»): личные диалоги и группы.
 * Личный диалог: user_a < user_b. Группа: is_group=1, участники в conversation_members.
 */

const { users, media, conversations, conversationMembers, messages, conversationReads } = schema;

type Conv = typeof conversations.$inferSelect;

const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string];

async function findConversation(a: string, b: string) {
  const db = await getDb();
  const [ua, ub] = pair(a, b);
  const [c] = await db.select().from(conversations).where(and(eq(conversations.userA, ua), eq(conversations.userB, ub), eq(conversations.isGroup, 0))).limit(1);
  return c ?? null;
}

/** Все id диалогов пользователя: личные + группы, где он участник. */
function myConversationIds(userId: string) {
  return sql<string>`(select id from conversations where is_group = 0 and (user_a = ${userId} or user_b = ${userId})
    union select conversation_id from conversation_members where user_id = ${userId})`;
}

async function assertMember(conv: Conv, userId: string) {
  if (!conv.isGroup) {
    if (conv.userA !== userId && conv.userB !== userId) throw new HttpError(403, "Это не ваш диалог");
    return;
  }
  const db = await getDb();
  const [m] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, conv.id), eq(conversationMembers.userId, userId))).limit(1);
  if (!m) throw new HttpError(403, "Вы не участник этой группы");
}

async function markRead(conversationId: string, userId: string) {
  const db = await getDb();
  await db.insert(conversationReads).values({ conversationId, userId, lastReadAt: nowIso() })
    .onConflictDoUpdate({ target: [conversationReads.conversationId, conversationReads.userId], set: { lastReadAt: nowIso() } });
}

async function membersOf(convIds: string[]): Promise<Map<string, UserDto[]>> {
  const db = await getDb();
  if (!convIds.length) return new Map();
  const rows = await db.select({ cid: conversationMembers.conversationId, u: users }).from(conversationMembers)
    .innerJoin(users, eq(conversationMembers.userId, users.id)).where(inArray(conversationMembers.conversationId, convIds));
  const m = new Map<string, UserDto[]>();
  for (const r of rows) m.set(r.cid, [...(m.get(r.cid) ?? []), toUserDto(r.u)]);
  return m;
}

/* ------------------------------ список ---------------------------------- */

export async function listConversations(userId: string): Promise<ConversationDto[]> {
  const db = await getDb();
  const convs = await db.select().from(conversations)
    .where(inArray(conversations.id, myConversationIds(userId)))
    .orderBy(desc(conversations.lastMessageAt)).limit(60);
  if (!convs.length) return [];
  const convIds = convs.map((c) => c.id);
  const peerIds = convs.filter((c) => !c.isGroup).map((c) => (c.userA === userId ? c.userB : c.userA));
  const [peers, reads, lasts, members] = await Promise.all([
    peerIds.length ? db.select().from(users).where(inArray(users.id, peerIds)) : Promise.resolve([]),
    db.select().from(conversationReads).where(and(inArray(conversationReads.conversationId, convIds), eq(conversationReads.userId, userId))),
    // последнее сообщение каждого диалога
    db.select({ m: messages, u: users }).from(messages).innerJoin(users, eq(messages.senderId, users.id))
      .where(and(inArray(messages.conversationId, convIds), sql`${messages.createdAt} = (select max(m2.created_at) from messages m2 where m2.conversation_id = ${messages.conversationId})`)),
    membersOf(convs.filter((c) => c.isGroup).map((c) => c.id)),
  ]);
  const peerMap = new Map(peers.map((u) => [u.id, toUserDto(u)]));
  const readMap = new Map(reads.map((r) => [r.conversationId, r.lastReadAt]));
  const lastMap = new Map(lasts.map(({ m, u }) => [m.conversationId, { m, u }]));

  const unread = new Map<string, number>();
  for (const c of convs) {
    const since = readMap.get(c.id);
    const [{ n }] = await db.select({ n: count() }).from(messages)
      .where(and(eq(messages.conversationId, c.id), sql`${messages.senderId} != ${userId}`, since ? gt(messages.createdAt, since) : undefined));
    unread.set(c.id, n);
  }

  const items: ConversationDto[] = convs.map((c) => {
    const last = lastMap.get(c.id);
    return {
      id: c.id, kind: c.isGroup ? "group" : "dm",
      peer: c.isGroup ? null : peerMap.get(c.userA === userId ? c.userB : c.userA) ?? null,
      title: c.isGroup ? c.title : null, members: c.isGroup ? members.get(c.id) ?? [] : [], ownerId: c.ownerId ?? null,
      unread: unread.get(c.id) ?? 0,
      lastMessage: last ? { text: last.m.text, hasMedia: !!last.m.mediaId, mine: last.m.senderId === userId, createdAt: last.m.createdAt, fromName: last.u.name.split(/\s+/)[0] } : null,
    };
  });
  // Помощник — всегда первым, как закреплённый чат.
  return items.sort((a, b) => Number(b.peer?.handle === BOT_HANDLE) - Number(a.peer?.handle === BOT_HANDLE));
}

export async function unreadMessagesCount(userId: string): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(messages)
    .leftJoin(conversationReads, and(eq(conversationReads.conversationId, messages.conversationId), eq(conversationReads.userId, userId)))
    .where(and(
      inArray(messages.conversationId, myConversationIds(userId)),
      sql`${messages.senderId} != ${userId}`,
      sql`(${conversationReads.lastReadAt} IS NULL OR ${messages.createdAt} > ${conversationReads.lastReadAt})`,
    ));
  return n;
}

/* ------------------------------- тред ----------------------------------- */

const toMessageDto = (m: typeof messages.$inferSelect, u: User, md: typeof media.$inferSelect | null, viewerId: string): MessageDto => ({
  id: m.id, text: m.text, media: md ? toMediaDto(md) : null, mine: m.senderId === viewerId, createdAt: m.createdAt, from: toUserDto(u),
});

async function threadOf(conv: Conv, viewerId: string, after?: string): Promise<MessageDto[]> {
  const db = await getDb();
  const rows = await db.select({ m: messages, u: users, md: media }).from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .leftJoin(media, eq(messages.mediaId, media.id))
    .where(and(eq(messages.conversationId, conv.id), after ? gt(messages.createdAt, after) : undefined))
    .orderBy(asc(messages.createdAt)).limit(after ? 200 : 100);
  await markRead(conv.id, viewerId);
  return rows.map(({ m, u, md }) => toMessageDto(m, u, md, viewerId));
}

/** Личный тред по нику собеседника. */
export async function listMessages(viewer: User, handle: string, after?: string): Promise<{ peer: UserDto; items: MessageDto[] }> {
  const peer = await findUserByHandle(handle);
  if (!peer) throw new HttpError(404, "Пользователь не найден");
  if (peer.id === viewer.id) throw new HttpError(400, "Нельзя писать самому себе");
  const conv = await findConversation(viewer.id, peer.id);
  return { peer: toUserDto(peer), items: conv ? await threadOf(conv, viewer.id, after) : [] };
}

/** Групповой тред по id диалога. */
export async function listGroupMessages(viewer: User, conversationId: string, after?: string): Promise<{ conversation: ConversationDto; items: MessageDto[] }> {
  const db = await getDb();
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conv || !conv.isGroup) throw new HttpError(404, "Группа не найдена");
  await assertMember(conv, viewer.id);
  const members = (await membersOf([conv.id])).get(conv.id) ?? [];
  const items = await threadOf(conv, viewer.id, after);
  return {
    conversation: { id: conv.id, kind: "group", peer: null, title: conv.title, members, ownerId: conv.ownerId ?? null, unread: 0, lastMessage: null },
    items,
  };
}

async function insertMessage(conv: Conv, sender: User, text: string, mediaId: string | null): Promise<MessageDto> {
  const db = await getDb();
  let md: typeof media.$inferSelect | null = null;
  if (mediaId) {
    const [m] = await db.select().from(media).where(and(eq(media.id, mediaId), eq(media.ownerId, sender.id))).limit(1);
    if (!m) throw new HttpError(400, "Файл не найден");
    md = m;
  }
  const now = nowIso();
  const id = newId();
  await db.insert(messages).values({ id, conversationId: conv.id, senderId: sender.id, text, mediaId, createdAt: now });
  await db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conv.id));
  await markRead(conv.id, sender.id);
  return { id, text, media: md ? toMediaDto(md) : null, mine: true, createdAt: now, from: toUserDto(sender) };
}

export async function sendMessage(sender: User, handle: string, text: string, mediaId: string | null): Promise<MessageDto> {
  const peer = await findUserByHandle(handle);
  if (!peer) throw new HttpError(404, "Пользователь не найден");
  if (peer.id === sender.id) throw new HttpError(400, "Нельзя писать самому себе");
  const db = await getDb();
  let conv = await findConversation(sender.id, peer.id);
  if (!conv) {
    const [ua, ub] = pair(sender.id, peer.id);
    const now = nowIso();
    conv = { id: newId(), userA: ua, userB: ub, isGroup: 0, title: null, ownerId: null, lastMessageAt: now, createdAt: now };
    await db.insert(conversations).values(conv);
  }
  const dto = await insertMessage(conv, sender, text, mediaId);

  // Бот отвечает сразу, в том же запросе: клиент увидит ответ при следующем опросе.
  if (peer.handle === BOT_HANDLE) {
    const reply = text ? await botReply(text) : "Красиво! 📷 Я, правда, пока умею отвечать только на вопросы словами — спросите что-нибудь о Expert Bailanysta.";
    const at = new Date(Date.now() + 1).toISOString();
    await db.insert(messages).values({ id: newId(), conversationId: conv.id, senderId: peer.id, text: reply, mediaId: null, createdAt: at });
    await db.update(conversations).set({ lastMessageAt: at }).where(eq(conversations.id, conv.id));
  }
  return dto;
}

export async function sendGroupMessage(sender: User, conversationId: string, text: string, mediaId: string | null): Promise<MessageDto> {
  const db = await getDb();
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conv || !conv.isGroup) throw new HttpError(404, "Группа не найдена");
  await assertMember(conv, sender.id);
  return insertMessage(conv, sender, text, mediaId);
}

/* ------------------------------- группы --------------------------------- */

export async function createGroup(owner: User, title: string, handles: string[]): Promise<ConversationDto> {
  const db = await getDb();
  const uniq = [...new Set(handles.map((h) => h.toLowerCase()).filter((h) => h !== owner.handle && h !== BOT_HANDLE))];
  const found = uniq.length ? await db.select().from(users).where(inArray(users.handle, uniq)) : [];
  if (found.length !== uniq.length) throw new HttpError(404, "Некоторые пользователи не найдены");
  if (!found.length) throw new HttpError(400, "Добавьте хотя бы одного участника");
  const now = nowIso();
  const id = newId();
  await db.insert(conversations).values({ id, userA: owner.id, userB: owner.id, isGroup: 1, title, ownerId: owner.id, lastMessageAt: now, createdAt: now });
  await db.insert(conversationMembers).values([owner, ...found].map((u) => ({ conversationId: id, userId: u.id, joinedAt: now })));
  await markRead(id, owner.id);
  // системное сообщение о создании
  await db.insert(messages).values({ id: newId(), conversationId: id, senderId: owner.id, text: `Создал(а) группу «${title}»`, mediaId: null, createdAt: now });
  const members = [owner, ...found].map(toUserDto);
  return { id, kind: "group", peer: null, title, members, ownerId: owner.id, unread: 0, lastMessage: null };
}

export async function addGroupMember(actor: User, conversationId: string, handle: string): Promise<ConversationDto> {
  const db = await getDb();
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conv || !conv.isGroup) throw new HttpError(404, "Группа не найдена");
  await assertMember(conv, actor.id);
  const u = await findUserByHandle(handle.toLowerCase());
  if (!u) throw new HttpError(404, "Пользователь не найден");
  if (u.handle === BOT_HANDLE) throw new HttpError(400, "Помощника нельзя добавить в группу");
  const now = nowIso();
  await db.insert(conversationMembers).values({ conversationId, userId: u.id, joinedAt: now }).onConflictDoNothing();
  await db.insert(messages).values({ id: newId(), conversationId, senderId: actor.id, text: `Добавил(а) ${u.name} в группу`, mediaId: null, createdAt: now });
  await db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conversationId));
  const members = (await membersOf([conversationId])).get(conversationId) ?? [];
  return { id: conv.id, kind: "group", peer: null, title: conv.title, members, ownerId: conv.ownerId ?? null, unread: 0, lastMessage: null };
}

export async function leaveGroup(actor: User, conversationId: string) {
  const db = await getDb();
  await db.delete(conversationMembers).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, actor.id)));
  const now = nowIso();
  await db.insert(messages).values({ id: newId(), conversationId, senderId: actor.id, text: `Покинул(а) группу`, mediaId: null, createdAt: now });
  return { ok: true };
}

/* ---------------------------- приветствие бота --------------------------- */

export async function ensureWelcome(user: User) {
  if (user.handle === BOT_HANDLE) return;
  const bot = await findUserByHandle(BOT_HANDLE);
  if (!bot) return;
  if (await findConversation(user.id, bot.id)) return;
  const db = await getDb();
  const now = nowIso();
  const [ua, ub] = pair(user.id, bot.id);
  const conv = { id: newId(), userA: ua, userB: ub, isGroup: 0, title: null, ownerId: null, lastMessageAt: now, createdAt: now };
  await db.insert(conversations).values(conv);
  await db.insert(messages).values({ id: newId(), conversationId: conv.id, senderId: bot.id, text: WELCOME(user.name.split(/\s+/)[0] || user.name), mediaId: null, createdAt: now });
  await markRead(conv.id, bot.id);
}

/* ------------------------------ realtime -------------------------------- */

/** Новые входящие сообщения после `sinceIso` — из личных диалогов и групп. */
export async function incomingMessagesSince(userId: string, sinceIso: string, limit = 5) {
  const db = await getDb();
  const rows = await db.select({ m: messages, sender: users, conv: conversations })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(and(
      inArray(messages.conversationId, myConversationIds(userId)),
      sql`${messages.senderId} != ${userId}`,
      gt(messages.createdAt, sinceIso),
    ))
    .orderBy(asc(messages.createdAt)).limit(limit);
  return rows.map(({ m, sender, conv }) => ({
    id: m.id, createdAt: m.createdAt, from: toUserDto(sender), text: m.text || (m.mediaId ? "📎 Медиа" : ""),
    conversationId: m.conversationId, group: conv.isGroup ? { id: conv.id, title: conv.title ?? "Группа" } : null,
  }));
}
