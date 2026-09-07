"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, setCurrentLocale, translate, type Locale, type TFn, type Vars } from "@/lib/i18n";
import { cn } from "@/lib/format";

type LocaleCtx = { locale: Locale; t: TFn; setLocale: (l: Locale) => void };
const Ctx = createContext<LocaleCtx | null>(null);

/** Локаль интерфейса: начальное значение — из cookie на сервере, смена — cookie + перерисовка серверных частей. */
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();
  useEffect(() => { setCurrentLocale(locale); }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    setCurrentLocale(l);
    try { document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`; } catch {}
    document.documentElement.lang = l;
    setLocaleState(l);
    router.refresh();
  }, [router]);
  const t = useCallback<TFn>((key: string, vars?: Vars) => translate(locale, key, vars), [locale]);
  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): LocaleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useT вне LocaleProvider");
  return ctx;
}

/** Переключатель языка: сегментный контрол KK | RU | EN; compact — одна кнопка, листающая языки по кругу. */
export function LangToggle({ compact }: { compact?: boolean }) {
  const { locale, setLocale, t } = useT();
  if (compact) {
    const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];
    return (
      <button onClick={() => setLocale(next)} className="btn btn-ghost btn-icon relative" aria-label={t("nav.lang")} title={`${t("nav.lang")}: ${LOCALE_NAMES[locale]}`}>
        <Languages size={21} />
        <span className="absolute -bottom-0.5 right-0 rounded bg-accent px-1 text-[9px] font-bold uppercase leading-[14px] text-white">{locale}</span>
      </button>
    );
  }
  return (
    <div className="seg w-full" role="radiogroup" aria-label={t("nav.lang")}>
      {LOCALES.map((l) => (
        <button key={l} role="radio" aria-checked={locale === l} onClick={() => setLocale(l)} title={LOCALE_NAMES[l]}
          className={cn("flex flex-1 items-center justify-center text-xs font-bold uppercase tracking-wide", locale === l && "seg-on")}>{l}</button>
      ))}
    </div>
  );
}
