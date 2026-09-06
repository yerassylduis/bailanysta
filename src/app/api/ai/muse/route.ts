import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { muse } from "@/lib/muse";

const Body = z.object({
  mode: z.enum(["draft", "polish", "hashtags", "translate", "reply", "caption"]),
  text: z.string().trim().min(1).max(1200),
  lang: z.enum(["kk", "ru", "en"]).optional(),
});

/**
 * POST /api/ai/muse — единственная точка обращения к внешнему ИИ.
 * Ключ Anthropic живёт только на сервере; клиент видит лишь готовые варианты.
 */
export const POST = handler(async (req) => {
  await requireUser();
  const body = await parseBody(req, Body);
  return ok(await muse(body));
});
