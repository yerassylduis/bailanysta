import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { MuseRequest, MuseResponse } from "./types";
import { extractTags } from "./text";

/**
 * «Муза» — ИИ-соавтор Bailanysta.
 * Работает через Anthropic SDK строго на сервере. Если ключа нет или API недоступен,
 * переключается в офлайн-режим с локальными эвристиками — приложение не ломается.
 */

const MODEL = "claude-opus-5";

const Out = z.object({ variants: z.array(z.string()).min(1).max(4) });

const SYSTEM = `Ты — Муза, соавтор в социальной сети Bailanysta (bailanys — «связь» по-казахски).
Аудитория: молодые инженеры, дизайнеры, студенты из Казахстана. Тон — живой, тёплый, без канцелярита и без кринжа.
Пиши на языке исходного текста (казахский, русский или английский), если не попросили перевести.
Пост — до 280 символов, без эмодзи-спама (максимум один), хэштеги только по делу.
Возвращай 3 разных варианта.`;

const TASK: Record<MuseRequest["mode"], (t: string, lang?: string) => string> = {
  draft: (t) => `Напиши 3 варианта короткого поста по теме или наброску:\n"""${t}"""`,
  polish: (t) => `Отредактируй пост: сохрани смысл и голос автора, убери воду, сделай ярче. Дай 3 варианта:\n"""${t}"""`,
  hashtags: (t) => `Предложи 3 набора из 2–4 уместных хэштегов для поста (каждый вариант — одна строка вида "#a #b #c"):\n"""${t}"""`,
  translate: (t, lang) => `Переведи пост на ${lang === "kk" ? "казахский" : lang === "en" ? "английский" : "русский"} язык. Дай 3 варианта: дословный, разговорный, поэтичный:\n"""${t}"""`,
  reply: (t) => `Придумай 3 варианта короткого, доброжелательного и содержательного комментария к посту:\n"""${t}"""`,
  caption: (t) => `Пользователь публикует фото/видео и описал его так: """${t}""". Напиши 3 варианта живой подписи к медиа (до 200 символов), можно с 1–2 хэштегами.`,
};

/* ------------------------ перевод без ключа ИИ -------------------------- */

/** Грубое определение языка: казахские буквы → kk, латиница → en, иначе ru. */
function detectLang(t: string): "kk" | "ru" | "en" {
  if (/[әіңғүұқөһӘІҢҒҮҰҚӨҺ]/.test(t)) return "kk";
  const cyr = (t.match(/[а-яё]/gi) ?? []).length, lat = (t.match(/[a-z]/gi) ?? []).length;
  return lat > cyr ? "en" : "ru";
}

/**
 * Резервный переводчик — бесплатный MyMemory (без ключа, лимит ~5000 символов в день с одного IP).
 * Вызывается только с сервера; при любой ошибке возвращает null, и Муза честно скажет об этом.
 */
async function freeTranslate(text: string, to: "kk" | "ru" | "en"): Promise<string | null> {
  const from = detectLang(text);
  if (from === to) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${from}|${to}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const j = (await res.json()) as { responseStatus: number; responseData?: { translatedText?: string } };
    const out = j.responseData?.translatedText?.trim();
    return j.responseStatus === 200 && out && !/MYMEMORY WARNING/i.test(out) ? out : null;
  } catch { return null; }
}

export async function muse(req: MuseRequest): Promise<MuseResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    if (req.mode === "translate") {
      const out = await freeTranslate(req.text, req.lang ?? "kk");
      if (out) return { variants: [out], source: "offline", note: "перевод выполнен бесплатным сервисом MyMemory, без ИИ" };
      return offline(req, "переводчик недоступен");
    }
    return offline(req, "Ключ ANTHROPIC_API_KEY не задан — Муза работает офлайн");
  }
  try {
    const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: TASK[req.mode](req.text, req.lang) }],
      output_config: { format: zodOutputFormat(Out), effort: "low" },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return offline(req, "Муза не смогла ответить на этот запрос");
    }
    return { variants: response.parsed_output.variants.map((v) => v.trim()).filter(Boolean), source: "claude" };
  } catch (e) {
    console.error("[muse]", e instanceof Error ? e.message : e);
    return offline(req, "ИИ временно недоступен — показаны офлайн-подсказки");
  }
}

/* ------------------------------ офлайн-режим ---------------------------- */

const STARTERS = ["Заметил(а) сегодня:", "Мысль дня:", "Маленькое наблюдение —"];
const CLOSERS = ["А как у вас?", "Поделитесь опытом.", "Обсудим?"];

function offline(req: MuseRequest, note: string): MuseResponse {
  const t = req.text.trim();
  let variants: string[] = [];
  switch (req.mode) {
    case "draft":
      variants = STARTERS.map((s, i) => `${s} ${t.replace(/[.!?]+$/, "")}. ${CLOSERS[i]}`);
      break;
    case "polish": {
      const clean = t.replace(/\s+/g, " ").replace(/\s([,.!?])/g, "$1");
      const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
      variants = [cap, cap.replace(/[.!?]*$/, "."), cap.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")];
      break;
    }
    case "hashtags": {
      const words = t.toLowerCase().replace(/#\w+/g, "").match(/[\p{L}]{5,}/gu) ?? [];
      const uniq = [...new Set(words)].slice(0, 6);
      const existing = extractTags(t);
      const mk = (arr: string[]) => arr.map((w) => `#${w}`).join(" ");
      variants = [mk([...existing, ...uniq.slice(0, 2)]), mk(uniq.slice(0, 3)), mk(["bailanysta", ...uniq.slice(2, 4)])].filter(Boolean);
      break;
    }
    case "translate":
      variants = [t];
      break;
    case "reply":
      variants = ["Очень откликается, спасибо!", "Интересная мысль — расскажите подробнее?", "Согласен(на) на сто процентов."];
      break;
    case "caption":
      variants = [`${t} ✨`, `Момент дня: ${t.toLowerCase()} #bailanysta`, `${t}. Без фильтров.`];
      break;
  }
  return { variants: [...new Set(variants)].filter(Boolean), source: "offline", note };
}
