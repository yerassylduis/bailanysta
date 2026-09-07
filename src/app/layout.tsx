import type { Metadata, Viewport } from "next";
import { Unbounded, Manrope } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { Cosmos } from "@/components/cosmos";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { getT } from "@/lib/i18n/server";

const display = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-display", weight: ["500", "700", "900"] });
const sans = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t("nav.siteTitle"), template: "%s · Expert Bailanysta" },
    description: t("nav.siteDescription"),
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#f6f5f0", width: "device-width", initialScale: 1, viewportFit: "cover" };

/* Скрипт исполняется до первой отрисовки, чтобы тема не «мигала». */
const themeScript = `(function(){try{var t=localStorage.getItem('bl_theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value as Theme | undefined;
  const { locale } = await getT();
  return (
    <html lang={locale} data-theme={cookieTheme ?? "light"} className={`${display.variable} ${sans.variable} h-full`} suppressHydrationWarning>
      <head>
        {!cookieTheme && <script dangerouslySetInnerHTML={{ __html: themeScript }} />}
      </head>
      <body className="min-h-full">
        <Cosmos />
        <Providers initialTheme={cookieTheme ?? null} initialLocale={locale}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
