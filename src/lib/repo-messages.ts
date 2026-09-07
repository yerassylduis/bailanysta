import { and, asc, desc, eq, gt, or, sql, count, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { HttpError } from "./auth";
import { newId, nowIso } from "./ids";
import { findUserByHandle, toMediaDto, toUserDto } from "./repo";
import type { ConversationDto, MessageDto } from "./types";
import type { User } from "@/db/schema";
import { BOT_HANDLE, WELCOME, botReply } from "./bot";

/** Личные сообщения («Хат» — письмо). Диалог создаётся при первом сообщении. */

const { users, media, conversations, messages, conversationReads } = schema;

const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string];

async function findConversation(a: string, b: string) {
  const db = await getDb();
  const [ua, ub] = pair(a, b);
  const [c] = await db.select().from(conversations).where(and(eq(conversations.userA, ua), eq(conversations.userB, ub))).limit(1);
  return c ?? null;
}

async function markRead(conversationId: string, userId: string) {
  const db = await getDb();
  await db.insert(conversationReads).values({ conversationId, userId, lastReadAt: nowIso() })
    .onConflictDoUpdate({ target: [conversationReads.conversationId, conversationReads.userId], set: { lastReadAt: nowIso() } });
}

export async function listConversations(userId: string): Promise<ConversationDto[]> {
  const db = await getDb();
  const convs = await db.select().from(conversations)
    .where(or(eq(conversations.userA, userId), eq(conversations.userB, userId)))
    .orderBy(desc(conversations.lastMessageAt)).limit(50);
  if (!convs.length) return [];
  const peerIds = convs.map((c) => (c.userA === userId ? c.userB : c.userA));
  const convIds = convs.map((c) => c.id);
  const [peers, reads, lasts] = await Promise.all([
    db.select().from(users).where(inArray(users.id, peerIds)),
    db.select().from(conversationReads).where(and(inArray(conversationReads.conversationId, convIds), eq(conversationReads.userId, userId))),
    // последнее сообщение каждого диалога
    db.select().from(messages).where(inArray(messages.id,
      db.select({ id: sql<string>`(select id from messages m2 where m2.conversation_id = ${messages.conversationId} order by m2.created_at desc limit 1)` }).from(messages).where(inArray(messages.conversationId, convIds)))),
  ]);
  const peerMap = new Map(peers.map((u) => [u.id, toUserDto(u)]));
  const readMap = new Map(reads.map((r) => [r.conversationId, r.lastReadAt]));
  const lastMap = new Map(lasts.map((m) => [m.conversationId, m]));

  const unreadRows = await db.select({ conversationId: messages.conversationId, n: count() }).from(messages)
    .where(and(inArray(messages.conversationId, convIds), sql`${messages.senderId} != ${userId}`))
    .groupBy(messages.conversationId);
  // точный подсчёт непрочитанных с учётом lastReadAt
  const unread = new Map<string, number>();
  for (const c of convs) {
    const since = readMap.get(c.id);
    if (!since) { unread.set(c.id, unreadRows.find((u) => u.conversationId === c.id)?.n ?? 0); continue; }
    const [{ n }] = await db.select({ n: count() }).from(messages).where(and(eq(messages.conversationId, c.id), sql`${messages.senderId} != ${userId}`, gt(messages.createdAt, since)));
    unread.set(c.id, n);
  }

  const items = convs.map((c) => {
    const peer = peerMap.get(c.userA === userId ? c.userB : c.userA)!;
    const last = lastMap.get(c.id);
    return {
      id: c.id, peer, unread: unread.get(c.id) ?? 0,
      lastMessage: last ? { text: last.text, hasMedia: !!last.mediaId, mine: last.senderId === userId, createdAt: last.createdAt } : null,
    };
  });
  // Помощник — всегда первым, как закреплённый чат.
  return items.sort((a, b) => Number(b.peer.handle === BOT_HANDLE) - Number(a.peer.handle === BOT_HANDLE));
}

export async function unreadMessagesCount(userId: string): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .leftJoin(conversationReads, and(eq(conversationReads.conversationId, conversations.id), eq(conversationReads.userId, userId)))
    .where(and(
      or(eq(conversations.userA, userId), eq(conversations.userB, userId)),
      sql`${messages.senderId} != ${userId}`,
      sql`(${conversationReads.lastReadAt} IS NULL OR ${messages.createdAt} > ${conversationReads.lastReadAt})`,
    ));
  return n;
}

export async function listMessages(viewer: User, handle: string, after?: string): Promise<{ peer: ReturnType<typeof toUserDto>; items: MessageDto[] }> {
  const peer = await findUserByHandle(handle);
  if (!peer) throw new HttpError(404, "Пользователь не найден");
  if (peer.id === viewer.id) throw new HttpError(400, "Нельзя писать самому себе");
  const db = await getDb();
  const conv = await findConversation(viewer.id, peer.id);
  if (!conv) return { peer: toUserDto(peer), items: [] };
  const rows = await db.select({ m: messages, md: media }).from(messages)
    .leftJoin(media, eq(messages.mediaId, media.id))
    .where(and(eq(messages.conversationId, conv.id), after ? gt(messages.createdAt, after) : undefined))
    .orderBy(asc(messages.createdAt)).limit(after ? 200 : 100);
  await markRead(conv.id, viewer.id);
  return {
    peer: toUserDto(peer),
    items: rows.map(({ m, md }) => ({ id: m.id, text: m.text, media: md ? toMediaDto(md) : null, mine: m.senderId === viewer.id, createdAt: m.createdAt })),
  };
}

export async function sendMessage(sender: User, handle: string, text: string, mediaId: string | null): Promise<MessageDto> {
  const peer = await findUserByHandle(handle);
  if (!peer) throw new HttpError(404, "Пользователь не найден");
  if (peer.id === sender.id) throw new HttpError(400, "Нельзя писать самому себе");
  const db = await getDb();
  let md = null;
  if (mediaId) {
    const [m] = await db.select().from(media).where(and(eq(media.id, mediaId), eq(media.ownerId, sender.id))).limit(1);
    if (!m) throw new HttpError(400, "Файл не найден");
    md = m;
  }
  let conv = await findConversation(sender.id, peer.id);
  const now = nowIso();
  if (!conv) {
    const [ua, ub] = pair(sender.id, peer.id);
    conv = { id: newId(), userA: ua, userB: ub, lastMessageAt: now, createdAt: now };
    await db.insert(conversations).values(conv);
  } else {
    await db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conv.id));
  }
  const id = newId();
  await db.insert(messages).values({ id, conversationId: conv.id, senderId: sender.id, text, mediaId, createdAt: now });
  await markRead(conv.id, sender.id);

  // Бот отвечает сразу, в той же транзакции запроса: клиент увидит ответ при следующем опросе.
  if (peer.handle === BOT_HANDLE) {
    const reply = text ? await botReply(text) : "Красиво! 📷 Я, правда, пока умею отвечать только на вопросы словами — спросите что-нибудь о Expert Bailanysta.";
    const at = new Date(Date.now() + 1).toISOString();
    await db.insert(messages).values({ id: newId(), conversationId: conv.id, senderId: peer.id, text: reply, mediaId: null, createdAt: at });
    await db.update(conversations).set({ lastMessageAt: at }).where(eq(conversations.id, conv.id));
  }
  return { id, text, media: md ? toMediaDto(md) : null, mine: true, createdAt: now };
}

/** Приветственный диалог от бота: создаётся один раз, если у пользователя ещё нет переписки с ним. */
export async function ensureWelcome(user: User) {
  if (user.handle === BOT_HANDLE) return;
  const bot = await findUserByHandle(BOT_HANDLE);
  if (!bot) return;
  if (await findConversation(user.id, bot.id)) return;
  const db = await getDb();
  const now = nowIso();
  const [ua, ub] = pair(user.id, bot.id);
  const conv = { id: newId(), userA: ua, userB: ub, lastMessageAt: now, createdAt: now };
  await db.insert(conversations).values(conv);
  await db.insert(messages).values({ id: newId(), conversationId: conv.id, senderId: bot.id, text: WELCOME(user.name.split(/\s+/)[0] || user.name), mediaId: null, createdAt: now });
  await markRead(conv.id, bot.id);
}

/** Новые входящие сообщения после `sinceIso` — кто написал и первые слова (для realtime-потока). */
export async function incomingMessagesSince(userId: string, sinceIso: string, limit = 5) {
  const db = await getDb();
  const rows = await db.select({ m: messages, sender: users })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(and(
      or(eq(conversations.userA, userId), eq(conversations.userB, userId)),
      sql`${messages.senderId} != ${userId}`,
      gt(messages.createdAt, sinceIso),
    ))
    .orderBy(asc(messages.createdAt)).limit(limit);
  return rows.map(({ m, sender }) => ({ id: m.id, createdAt: m.createdAt, from: toUserDto(sender), text: m.text || (m.mediaId ? "📎 Медиа" : "") }));
}
