/** Утилиты работы с текстом поста: хэштеги, упоминания, настроения. */

export const MOODS = [
  { id: "zhalyn", label: "Жалын", hint: "огонь, азарт", emoji: "🔥" },
  { id: "tynysh", label: "Тыныш", hint: "спокойствие", emoji: "🌊" },
  { id: "idea", label: "Идея", hint: "озарение", emoji: "⚡" },
  { id: "oi", label: "Ой", hint: "размышление", emoji: "🌙" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];
export const MOOD_IDS = MOODS.map((m) => m.id) as [MoodId, ...MoodId[]];
export const moodById = (id: string | null | undefined) => MOODS.find((m) => m.id === id) ?? null;

const TAG_RE = /(^|[^\p{L}\p{N}_#])#([\p{L}\p{N}_]{2,40})/gu;
const MENTION_RE = /(^|[^\p{L}\p{N}_@])@([a-z0-9_]{2,32})/giu;

export function extractTags(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) set.add(m[2].toLowerCase());
  return [...set];
}

export function extractMentions(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) set.add(m[2].toLowerCase());
  return [...set];
}

export const POST_MAX = 500;
export const COMMENT_MAX = 300;
export const HANDLE_RE = /^[a-z0-9_]{2,32}$/;

/** Детерминированный «оттенок» аватара из handle (0..7). */
export function hueFromHandle(handle: string): number {
  let h = 0;
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 8;
}
