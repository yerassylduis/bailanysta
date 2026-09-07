import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { HttpError } from "./auth";
import { newId, nowIso } from "./ids";
import { toUserDto } from "./repo";
import type { CallDto, SignalDto, SignalType } from "./types";
import type { User } from "@/db/schema";
import { customAlphabet } from "nanoid";

/**
 * Звонки «Байланыс»: комнаты, участники и сигналинг WebRTC через базу.
 * Медиа идёт напрямую между браузерами (P2P, mesh); сервер лишь передаёт offer/answer/ICE и чат.
 */

const { users, calls, callParticipants, callSignals } = schema;
const roomCode = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 9);
const ONLINE_MS = 40_000;

export async function createCall(host: User, title: string): Promise<CallDto> {
  const db = await getDb();
  const id = `${roomCode().slice(0, 3)}-${roomCode().slice(0, 3)}-${roomCode().slice(0, 3)}`;
  const now = nowIso();
  await db.insert(calls).values({ id, hostId: host.id, title: title || `Созвон ${host.name.split(/\s+/)[0]}`, createdAt: now });
  return getCall(id);
}

export async function getCall(id: string): Promise<CallDto> {
  const db = await getDb();
  const [c] = await db.select({ c: calls, h: users }).from(calls).innerJoin(users, eq(calls.hostId, users.id)).where(eq(calls.id, id)).limit(1);
  if (!c) throw new HttpError(404, "Звонок не найден");
  const parts = await db.select({ p: callParticipants, u: users }).from(callParticipants).innerJoin(users, eq(callParticipants.userId, users.id))
    .where(and(eq(callParticipants.callId, id), isNull(callParticipants.leftAt)));
  const cutoff = Date.now() - ONLINE_MS;
  return {
    id: c.c.id, title: c.c.title, host: toUserDto(c.h), createdAt: c.c.createdAt, endedAt: c.c.endedAt,
    participants: parts.map(({ p, u }) => ({ ...toUserDto(u), joinedAt: p.joinedAt, online: new Date(p.lastSeenAt).getTime() > cutoff })),
  };
}

/** Мои звонки: созданные мной или где я участвовал, свежие сверху. */
export async function listMyCalls(userId: string): Promise<CallDto[]> {
  const db = await getDb();
  const rows = await db.select({ id: calls.id }).from(calls)
    .where(or(eq(calls.hostId, userId), inArray(calls.id, db.select({ id: callParticipants.callId }).from(callParticipants).where(eq(callParticipants.userId, userId)))))
    .orderBy(desc(calls.createdAt)).limit(20);
  return Promise.all(rows.map((r) => getCall(r.id)));
}

export async function joinCall(user: User, callId: string) {
  const db = await getDb();
  const [c] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  if (!c) throw new HttpError(404, "Звонок не найден");
  if (c.endedAt) throw new HttpError(410, "Звонок завершён");
  const now = nowIso();
  await db.insert(callParticipants).values({ callId, userId: user.id, joinedAt: now, lastSeenAt: now, leftAt: null })
    .onConflictDoUpdate({ target: [callParticipants.callId, callParticipants.userId], set: { joinedAt: now, lastSeenAt: now, leftAt: null } });
  // чистим старые сигналы комнаты (старше часа), чтобы таблица не росла
  await db.delete(callSignals).where(and(eq(callSignals.callId, callId), sql`${callSignals.createdAt} < ${new Date(Date.now() - 3600_000).toISOString()}`));
  await pushSignal(user, callId, "join", null, { name: user.name });
  return getCall(callId);
}

export async function heartbeat(user: User, callId: string) {
  const db = await getDb();
  await db.update(callParticipants).set({ lastSeenAt: nowIso() }).where(and(eq(callParticipants.callId, callId), eq(callParticipants.userId, user.id)));
}

export async function leaveCall(user: User, callId: string) {
  const db = await getDb();
  await db.update(callParticipants).set({ leftAt: nowIso() }).where(and(eq(callParticipants.callId, callId), eq(callParticipants.userId, user.id)));
  await pushSignal(user, callId, "leave", null, {});
  // Если вышли все — звонок считается завершённым
  const rest = await db.select({ id: callParticipants.userId }).from(callParticipants).where(and(eq(callParticipants.callId, callId), isNull(callParticipants.leftAt)));
  if (!rest.length) await db.update(calls).set({ endedAt: nowIso() }).where(eq(calls.id, callId));
  return { ok: true };
}

export async function pushSignal(from: User, callId: string, type: SignalType, toId: string | null, payload: unknown) {
  const db = await getDb();
  const id = newId();
  const createdAt = nowIso();
  await db.insert(callSignals).values({ id, callId, fromId: from.id, toId, type, payload: JSON.stringify(payload ?? {}), createdAt });
  return { id, createdAt };
}

/** Сигналы после `sinceIso`, адресованные мне или всем (кроме моих собственных). */
export async function signalsSince(userId: string, callId: string, sinceIso: string, limit = 100): Promise<SignalDto[]> {
  const db = await getDb();
  const rows = await db.select({ s: callSignals, u: users }).from(callSignals).innerJoin(users, eq(callSignals.fromId, users.id))
    .where(and(eq(callSignals.callId, callId), gt(callSignals.createdAt, sinceIso), sql`${callSignals.fromId} != ${userId}`,
      or(isNull(callSignals.toId), eq(callSignals.toId, userId))))
    .orderBy(callSignals.createdAt, sql`"call_signals".rowid`).limit(limit);
  return rows.map(({ s, u }) => ({ id: s.id, type: s.type as SignalType, from: toUserDto(u), to: s.toId, payload: JSON.parse(s.payload), createdAt: s.createdAt }));
}

/** История чата звонка (для тех, кто присоединился позже). */
export async function callChatHistory(callId: string, limit = 100): Promise<SignalDto[]> {
  const db = await getDb();
  const rows = await db.select({ s: callSignals, u: users }).from(callSignals).innerJoin(users, eq(callSignals.fromId, users.id))
    .where(and(eq(callSignals.callId, callId), eq(callSignals.type, "chat"))).orderBy(callSignals.createdAt).limit(limit);
  return rows.map(({ s, u }) => ({ id: s.id, type: "chat", from: toUserDto(u), to: null, payload: JSON.parse(s.payload), createdAt: s.createdAt }));
}
