import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";

/**
 * Сессии без паролей: cookie `bl_session` = `<userId>.<hmac>`.
 * Подпись HMAC-SHA256 на SESSION_SECRET — cookie нельзя подделать, не зная секрета.
 * Компромисс осознанный: для учебного проекта регистрация по «нику» снимает барьер входа.
 */

export const SESSION_COOKIE = "bl_session";
const secret = () => process.env.SESSION_SECRET ?? "dev-secret-not-for-production";

function sign(userId: string) {
  return createHmac("sha256", secret()).update(userId).digest("base64url");
}

export function makeSessionToken(userId: string) {
  return `${userId}.${sign(userId)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(userId);
  if (sig.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? userId : null;
}

export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const userId = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return user ?? null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Забанен ли пользователь сейчас (срок не истёк или навсегда). */
export function isBanned(u: Pick<User, "bannedUntil">) {
  if (!u.bannedUntil) return false;
  if (u.bannedUntil === "forever") return true;
  return new Date(u.bannedUntil).getTime() > Date.now();
}

/** Админ — по роли в базе или по списку почт ADMIN_EMAILS (через запятую) в окружении. */
export function isAdmin(u: Pick<User, "role" | "email">) {
  if (u.role === "admin") return true;
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!u.email && list.includes(u.email.toLowerCase());
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Нужно войти, чтобы это сделать");
  if (isBanned(user)) throw new HttpError(403, `Аккаунт заблокирован${user.banReason ? `: ${user.banReason}` : ""}`);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) throw new HttpError(403, "Только для администраторов");
  return user;
}
