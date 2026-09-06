import { z } from "zod";
import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/http";
import { HANDLE_RE } from "@/lib/text";
import { loginOrRegister, toUserDto } from "@/lib/repo";
import { SESSION_COOKIE, makeSessionToken } from "@/lib/auth";

const Body = z.object({
  handle: z.string().trim().toLowerCase().regex(HANDLE_RE, "Ник: 2–32 символа, латиница, цифры, «_»"),
  name: z.string().trim().max(60).optional(),
});

/** Вход или регистрация по нику. Ставит подписанную cookie сессии. */
export const POST = handler(async (req) => {
  const { handle, name } = await parseBody(req, Body);
  const { user, created } = await loginOrRegister(handle, name);
  const res = NextResponse.json({ user: toUserDto(user), created }, { status: created ? 201 : 200 });
  res.cookies.set(SESSION_COOKIE, makeSessionToken(user.id), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90,
  });
  return res;
});
