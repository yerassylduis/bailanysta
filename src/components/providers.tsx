"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { THEME_COOKIE, THEME_KEY, type Theme } from "@/lib/theme";
import { ToastProvider } from "./toast";
import { LocaleProvider } from "./locale-provider";
import type { Locale } from "@/lib/i18n";

/* ------------------------------- Тема ----------------------------------- */

type ThemeCtx = { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void };
const ThemeContext = createContext<ThemeCtx | null>(null);

/** Источник правды о теме — атрибут data-theme на <html>; React подписан на него через MutationObserver. */
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const readTheme = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

function ThemeProvider({ initialTheme, children }: { initialTheme: Theme | null; children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => initialTheme ?? "light");

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_KEY, t);
      document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {}
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme вне ThemeProvider");
  return ctx;
}

/* ------------------------------ Провайдеры ------------------------------ */

export function Providers({ initialTheme, initialLocale, children }: { initialTheme: Theme | null; initialLocale: Locale; children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
  }));
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider initialTheme={initialTheme}>
        <LocaleProvider initialLocale={initialLocale}>
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
