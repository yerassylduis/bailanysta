import type { Metadata, Viewport } from "next";
import { Unbounded, Manrope } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { Cosmos } from "@/components/cosmos";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

const display = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-display", weight: ["500", "700", "900"] });
const sans = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "Expert Bailanysta — байланыс между людьми", template: "%s · Expert Bailanysta" },
  description: "Expert Bailanysta — небольшая уютная социальная сеть: посты, лента, созвездие связей и ИИ-соавтор Cosmos.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#f2f3fa", width: "device-width", initialScale: 1, viewportFit: "cover" };

/* Скрипт исполняется до первой отрисовки, чтобы тема не «мигала». */
const themeScript = `(function(){try{var t=localStorage.getItem('bl_theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value as Theme | undefined;
  return (
    <html lang="ru" data-theme={cookieTheme ?? "light"} className={`${display.variable} ${sans.variable} h-full`} suppressHydrationWarning>
      <head>
        {!cookieTheme && <script dangerouslySetInnerHTML={{ __html: themeScript }} />}
      </head>
      <body className="min-h-full">
        <Cosmos />
        <Providers initialTheme={cookieTheme ?? null}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
