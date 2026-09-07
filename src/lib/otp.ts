import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { HttpError } from "./auth";
import { newId, nowIso } from "./ids";

/**
 * Одноразовые коды входа и регистрации.
 * Доставка: почта через Resend (RESEND_API_KEY, MAIL_FROM), SMS через Twilio
 * (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM). Если провайдер канала не настроен —
 * демо-режим: код возвращается клиенту и показывается на экране (честно помечено в интерфейсе и README).
 */

const TTL_MS = 10 * 60_000;
const RESEND_MS = 30_000;
const MAX_ATTEMPTS = 5;

export type Channel = "sms" | "email";

/** Телефон → E.164 (+7…), почта → нижний регистр. Возвращает канал и нормализованную цель. */
export function normalizeTarget(raw: string): { target: string; channel: Channel } {
  const v = raw.trim();
  if (v.includes("@")) {
    const email = v.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "Похоже, почта написана с ошибкой");
    return { target: email, channel: "email" };
  }
  let digits = v.replace(/[^\d+]/g, "");
  if (digits.startsWith("8") && digits.length === 11) digits = "+7" + digits.slice(1); // казахстанский/российский формат 8XXXXXXXXXX
  if (!digits.startsWith("+")) digits = "+" + digits;
  if (!/^\+\d{10,15}$/.test(digits)) throw new HttpError(400, "Введите телефон в международном формате, например +7 701 000 00 00");
  return { target: digits, channel: "sms" };
}

const hash = (target: string, code: string) => createHash("sha256").update(`${target}:${code}:${process.env.SESSION_SECRET ?? "dev"}`).digest("hex");

export function providerConfigured(channel: Channel) {
  return channel === "email" ? !!process.env.RESEND_API_KEY : !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

async function deliver(channel: Channel, target: string, code: string): Promise<"sent" | "screen"> {
  const text = `Ваш код входа в Expert Bailanysta: ${code}. Действует 10 минут. Никому его не сообщайте.`;
  if (!providerConfigured(channel)) {
    console.info(`[otp] демо-режим, код для ${target}: ${code}`);
    return "screen";
  }
  if (channel === "email") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM ?? "Expert Bailanysta <onboarding@resend.dev>", to: [target], subject: `Код входа: ${code}`, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new HttpError(502, "Не удалось отправить письмо. Попробуйте позже");
    return "sent";
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!, token = process.env.TWILIO_AUTH_TOKEN!;
  const body = new URLSearchParams({ To: target, From: process.env.TWILIO_FROM!, Body: text });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST", headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body, signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new HttpError(502, "Не удалось отправить SMS. Попробуйте позже");
  return "sent";
}

/** Создаёт и отправляет код. Возвращает способ доставки и (в демо-режиме) сам код. */
export async function issueCode(target: string, channel: Channel, purpose: "login" | "register", payload?: unknown) {
  const db = await getDb();
  const [recent] = await db.select().from(schema.otpCodes)
    .where(and(eq(schema.otpCodes.target, target), gt(schema.otpCodes.createdAt, new Date(Date.now() - RESEND_MS).toISOString())))
    .orderBy(desc(schema.otpCodes.createdAt)).limit(1);
  if (recent) throw new HttpError(429, "Код уже отправлен. Повторить можно через 30 секунд");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.delete(schema.otpCodes).where(eq(schema.otpCodes.target, target));
  await db.insert(schema.otpCodes).values({
    id: newId(), target, channel, purpose, codeHash: hash(target, code), payload: payload ? JSON.stringify(payload) : null,
    attempts: 0, expiresAt: new Date(Date.now() + TTL_MS).toISOString(), createdAt: nowIso(),
  });
  const delivery = await deliver(channel, target, code);
  return { delivery, code: delivery === "screen" ? code : undefined, expiresInSec: TTL_MS / 1000 };
}

/** Проверяет код; при успехе удаляет запись и возвращает назначение и данные регистрации. */
export async function verifyCode(target: string, code: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.otpCodes).where(eq(schema.otpCodes.target, target)).orderBy(desc(schema.otpCodes.createdAt)).limit(1);
  if (!row) throw new HttpError(400, "Код не запрашивали или он уже использован");
  if (new Date(row.expiresAt).getTime() < Date.now()) { await db.delete(schema.otpCodes).where(eq(schema.otpCodes.id, row.id)); throw new HttpError(400, "Код истёк — запросите новый"); }
  if (row.attempts >= MAX_ATTEMPTS) { await db.delete(schema.otpCodes).where(eq(schema.otpCodes.id, row.id)); throw new HttpError(429, "Слишком много попыток — запросите новый код"); }
  const expected = Buffer.from(row.codeHash), actual = Buffer.from(hash(target, code.trim()));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await db.update(schema.otpCodes).set({ attempts: row.attempts + 1 }).where(eq(schema.otpCodes.id, row.id));
    throw new HttpError(400, `Неверный код. Осталось попыток: ${MAX_ATTEMPTS - row.attempts - 1}`);
  }
  await db.delete(schema.otpCodes).where(eq(schema.otpCodes.id, row.id));
  return { purpose: row.purpose as "login" | "register", payload: row.payload ? (JSON.parse(row.payload) as Record<string, string>) : null, channel: row.channel as Channel };
}
