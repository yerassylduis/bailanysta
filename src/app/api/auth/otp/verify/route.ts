import { z } from "zod";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/http";
import { HttpError, SESSION_COOKIE, makeSessionToken } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { newId, nowIso } from "@/lib/ids";
import { hueFromHandle } from "@/lib/text";
import { toMeDto } from "@/lib/repo";
import { normalizeTarget, verifyCode } from "@/lib/otp";
import { ensureWelcome } from "@/lib/repo-messages";
import type { User } from "@/db/schema";

/** POST /api/auth/otp/verify { target, code } — вход или завершение регистрации; ставит cookie сессии. */
export const POST = handler(async (req) => {
  const { target: raw, code } = await parseBody(req, z.object({ target: z.string().trim(), code: z.string().trim().regex(/^\d{6}$/, "Код — 6 цифр") }));
  const { target, channel } = normalizeTarget(raw);
  const result = await verifyCode(target, code);
  const db = await getDb();
  let user: User | undefined;
  let created = false;

  if (result.purpose === "register" && result.payload) {
    const p = result.payload;
    // повторная проверка уникальности — между запросом кода и вводом кто-то мог занять ник
    const [clash] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.handle, p.handle)).limit(1);
    if (clash) throw new HttpError(409, "Этот ник уже заняли. Начните регистрацию заново");
    user = { id: newId(), handle: p.handle, name: p.name, bio: "", hue: hueFromHandle(p.handle), avatarUrl: null, cover: null, phone: p.phone, email: p.email, birthday: p.birthday, createdAt: nowIso() };
    await db.insert(schema.users).values(user);
    created = true;
  } else {
    [user] = await db.select().from(schema.users).where(channel === "sms" ? eq(schema.users.phone, target) : eq(schema.users.email, target)).limit(1);
    if (!user) throw new HttpError(404, "Аккаунт не найден");
  }
  await ensureWelcome(user);
  const res = NextResponse.json({ user: toMeDto(user), created }, { status: created ? 201 : 200 });
  res.cookies.set(SESSION_COOKIE, makeSessionToken(user.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return res;
});
