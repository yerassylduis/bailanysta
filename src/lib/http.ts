import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { HttpError } from "./auth";

/** Общие помощники для route handlers: единый формат ошибок и валидация. */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Тело запроса должно быть JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw result.error;
  return result.data;
}

/**
 * Оборачивает обработчик: превращает HttpError/ZodError в аккуратные JSON-ответы,
 * остальное — в 500 с логом на сервере.
 */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      if (e instanceof ZodError) return fail(400, "Некорректные данные", e.issues);
      console.error("[api]", e, e instanceof Error && e.cause ? `\n  cause: ${String(e.cause)}` : "");
      return fail(500, "Внутренняя ошибка сервера");
    }
  };
}

export type RouteCtx<P extends Record<string, string>> = { params: Promise<P> };
