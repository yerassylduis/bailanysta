import { INTL_TAG, currentLocale, translate, type Locale } from "./i18n";

/** Относительное время: «только что», «5 мин», «3 ч», «вчера», «12 авг». Локаль передавайте явно (useT().locale), иначе берётся текущая. */
export function timeAgo(iso: string, locale: Locale = currentLocale(), now = Date.now()): string {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((now - d) / 1000));
  if (s < 45) return translate(locale, "common.justNow");
  const m = Math.floor(s / 60);
  if (m < 60) return translate(locale, "common.min", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return translate(locale, "common.hours", { count: h });
  const days = Math.floor(h / 24);
  if (days === 1) return translate(locale, "common.yesterday");
  if (days < 7) return translate(locale, "common.days", { count: days });
  return new Date(iso).toLocaleDateString(INTL_TAG[locale], { day: "numeric", month: "short" });
}

/** Дата/время в локали интерфейса. */
export const fmtDate = (iso: string, locale: Locale = currentLocale(), opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) =>
  new Date(iso).toLocaleDateString(INTL_TAG[locale], opts);
export const fmtDateTime = (iso: string, locale: Locale = currentLocale(), opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) =>
  new Date(iso).toLocaleString(INTL_TAG[locale], opts);
export const fmtTime = (iso: string, locale: Locale = currentLocale()) => new Date(iso).toLocaleTimeString(INTL_TAG[locale], { hour: "2-digit", minute: "2-digit" });

/** Русские формы множественного числа (устаревшее — используйте t("ns.key", { count })). */
export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};

export const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");
