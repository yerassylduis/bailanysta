import { z } from "zod";
import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/http";
import { HANDLE_RE } from "@/lib/text";
import { findUserByHandle, toUserDto } from "@/lib/repo";
import { DEMO_HANDLES } from "@/db/seed";
import { SESSION_COOKIE, isBanned, makeSessionToken } from "@/lib/auth";
import { ensureWelcome } from "@/lib/repo-messages";
import { BOT_HANDLE } from "@/lib/bot";
import { HttpError } from "@/lib/auth";

const Body = z.object({
  handle: z.string().trim().toLowerCase().regex(HANDLE_RE, "Ник: 2–32 символа, латиница, цифры, «_»"),
  name: z.string().trim().max(60).optional(),
});

/**
 * Быстрый вход по нику — только для демо-аккаунтов (кнопки на экране входа) и старых аккаунтов
 * без телефона/почты. Все остальные входят по коду: /api/auth/otp/*.
 */
export const POST = handler(async (req) => {
  const { handle } = await parseBody(req, Body);
  if (handle === BOT_HANDLE) throw new HttpError(400, "Этот ник занят помощником 🙂");
  const user = await findUserByHandle(handle);
  if (!user) throw new HttpError(404, "Такого аккаунта нет — зарегистрируйтесь");
  if (isBanned(user)) throw new HttpError(403, `Аккаунт заблокирован${user.banReason ? `: ${user.banReason}` : ""}`);
  const legacy = !user.phone && !user.email;
  if (!DEMO_HANDLES.includes(handle) && !legacy) throw new HttpError(403, "Войдите по телефону или почте — вам придёт код");
  await ensureWelcome(user);
  const created = false;
  const res = NextResponse.json({ user: toUserDto(user), created }, { status: 200 });
  res.cookies.set(SESSION_COOKIE, makeSessionToken(user.id), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90,
  });
  return res;
});
