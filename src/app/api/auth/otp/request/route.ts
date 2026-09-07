import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { handler, ok, parseBody } from "@/lib/http";
import { HttpError, isBanned } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { HANDLE_RE } from "@/lib/text";
import { BOT_HANDLE } from "@/lib/bot";
import { issueCode, normalizeTarget } from "@/lib/otp";

/**
 * POST /api/auth/otp/request
 *  - вход:        { target }                       — почта существующего аккаунта
 *  - регистрация: { register: {handle,name,phone,email,birthday} } — код уходит на почту
 * Отвечает { delivery: "sent" | "screen", code?, target, channel } — code только в демо-режиме без провайдера.
 */
const Register = z.object({
  handle: z.string().trim().toLowerCase().regex(HANDLE_RE, "Ник: 2–32 символа, латиница, цифры, «_»"),
  name: z.string().trim().min(2, "Имя слишком короткое").max(60),
  phone: z.string().trim().min(10, "Введите телефон"),
  email: z.string().trim().min(5, "Введите почту"),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата рождения в формате ГГГГ-ММ-ДД"),
});
const Body = z.object({ target: z.string().trim().optional(), register: Register.optional() });

export const POST = handler(async (req) => {
  const body = await parseBody(req, Body);
  const db = await getDb();

  if (body.register) {
    const r = body.register;
    if (r.handle === BOT_HANDLE) throw new HttpError(400, "Этот ник занят помощником 🙂");
    const phone = normalizeTarget(r.phone); if (phone.channel !== "sms") throw new HttpError(400, "В поле телефона нужен номер");
    const email = normalizeTarget(r.email); if (email.channel !== "email") throw new HttpError(400, "В поле почты нужен адрес почты");
    const bd = new Date(r.birthday); const age = (Date.now() - bd.getTime()) / (365.25 * 86400_000);
    if (Number.isNaN(bd.getTime()) || age < 13 || age > 120) throw new HttpError(400, "Проверьте дату рождения (нам можно с 13 лет)");
    const clash = await db.select({ handle: schema.users.handle, phone: schema.users.phone, email: schema.users.email }).from(schema.users)
      .where(or(eq(schema.users.handle, r.handle), eq(schema.users.phone, phone.target), eq(schema.users.email, email.target)));
    if (clash.some((u) => u.handle === r.handle)) throw new HttpError(409, "Этот ник уже занят");
    if (clash.some((u) => u.phone === phone.target)) throw new HttpError(409, "Этот телефон уже зарегистрирован — войдите по нему");
    if (clash.some((u) => u.email === email.target)) throw new HttpError(409, "Эта почта уже зарегистрирована — войдите по ней");
    const res = await issueCode(email.target, "email", "register", { handle: r.handle, name: r.name, phone: phone.target, email: email.target, birthday: r.birthday });
    return ok({ ...res, target: email.target, channel: "email" });
  }

  if (!body.target) throw new HttpError(400, "Введите почту");
  const t = normalizeTarget(body.target);
  if (t.channel !== "email") throw new HttpError(400, "Вход по почте: введите адрес электронной почты");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, t.target)).limit(1);
  if (!user) throw new HttpError(404, "Аккаунт с такой почтой не найден. Зарегистрируйтесь");
  if (isBanned(user)) throw new HttpError(403, `Аккаунт заблокирован${user.banReason ? `: ${user.banReason}` : ""}${user.bannedUntil && user.bannedUntil !== "forever" ? ` до ${new Date(user.bannedUntil).toLocaleDateString("ru-RU")}` : ""}`);
  const res = await issueCode(t.target, t.channel, "login");
  return ok({ ...res, target: t.target, channel: t.channel });
});
