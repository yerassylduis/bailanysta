/**
 * Локализация интерфейса: KK / RU / EN. По умолчанию — русский.
 * Переводятся только надписи интерфейса; посты, комментарии и сообщения людей остаются как есть.
 *
 * Словари разбиты по неймспейсам (`src/lib/i18n/dict/*`), ключ — `namespace.key`.
 * Множественное число: ключи `key.one|few|many|other` и `t("ns.key", { count })` — категория берётся из Intl.PluralRules.
 * Подстановки: `{name}` → vars.name.
 */
import common from "./dict/common";
import nav from "./dict/nav";
import auth from "./dict/auth";
import admin from "./dict/admin";
import calls from "./dict/calls";
import messages from "./dict/messages";
import posts from "./dict/posts";
import notifications from "./dict/notifications";
import feed from "./dict/feed";
import profile from "./dict/profile";
import explore from "./dict/explore";
import muse from "./dict/muse";
import palette from "./dict/palette";
import search from "./dict/search";
import settings from "./dict/settings";

export const LOCALES = ["kk", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "bl_lang";
export const LOCALE_NAMES: Record<Locale, string> = { kk: "Қазақша", ru: "Русский", en: "English" };
/** BCP-47 теги для Intl (даты, числа). */
export const INTL_TAG: Record<Locale, string> = { kk: "kk-KZ", ru: "ru-RU", en: "en-GB" };

export type Messages = Record<string, string>;
export type Namespace = { ru: Messages; kk: Messages; en: Messages };
export type Vars = Record<string, string | number | null | undefined>;
export type TFn = (key: string, vars?: Vars) => string;

export const isLocale = (x: unknown): x is Locale => typeof x === "string" && (LOCALES as readonly string[]).includes(x);

export const DICTS: Record<string, Namespace> = { common, nav, auth, admin, calls, messages, posts, notifications, feed, profile, explore, muse, palette, search, settings };

export function pluralCategory(locale: Locale, n: number): string {
  try { return new Intl.PluralRules(INTL_TAG[locale]).select(n); } catch { return "other"; }
}

export function translate(locale: Locale, key: string, vars?: Vars): string {
  const dot = key.indexOf(".");
  const ns = dot > 0 ? DICTS[key.slice(0, dot)] : undefined;
  const k = key.slice(dot + 1);
  let s: string | undefined;
  if (ns) {
    const n = vars?.count;
    if (typeof n === "number") {
      const loc = ns[locale], ru = ns.ru;
      s = loc[`${k}.${pluralCategory(locale, n)}`] ?? loc[`${k}.other`] ?? ru[`${k}.${pluralCategory("ru", n)}`] ?? ru[`${k}.other`];
    }
    s ??= ns[locale][k] ?? ns.ru[k];
  }
  if (s === undefined) {
    if (process.env.NODE_ENV !== "production") console.warn(`[i18n] нет ключа ${key}`);
    return key;
  }
  return vars ? s.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? "")) : s;
}

/* ------------------------- текущая локаль для утилит ------------------------- */

let current: Locale = DEFAULT_LOCALE;
/** Ставится провайдером на клиенте; на сервере всегда локаль по умолчанию — передавайте locale явно. */
export const setCurrentLocale = (l: Locale) => { current = l; };
export const currentLocale = () => current;
