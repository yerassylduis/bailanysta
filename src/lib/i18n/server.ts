import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, translate, type Locale, type TFn } from "./index";

/** Локаль текущего запроса — из cookie bl_lang; по умолчанию русский. */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** Переводчик для серверных компонентов и metadata. */
export async function getT(): Promise<{ t: TFn; locale: Locale }> {
  const locale = await getLocale();
  return { locale, t: (key, vars) => translate(locale, key, vars) };
}
