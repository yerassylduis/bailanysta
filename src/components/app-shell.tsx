"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, LogIn, Moon, Search, Sun, UserRound, Sparkles, Command, MessageCircle, Bookmark } from "lucide-react";
import { useMe } from "@/hooks/use-data";
import { useTheme } from "./providers";
import { Avatar, Logo } from "./ui";
import { cn } from "@/lib/format";
import { RightRail } from "./right-rail";
import { CommandPalette, useCommandPalette } from "./command-palette";

/**
 * Каркас: слева навигация (≥ md), в центре контент, справа «рельс» (≥ xl).
 * На телефонах — шапка и нижняя панель с безопасными зонами.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useMe();
  const me = data?.user ?? null;
  const unread = data?.unread ?? 0;
  const unreadMsgs = data?.unreadMessages ?? 0;
  const palette = useCommandPalette();
  const isChat = /^\/messages\/.+/.test(pathname);

  const items = [
    { href: "/", label: "Лента", icon: Home, badge: 0, match: (p: string) => p === "/" || p.startsWith("/post") },
    { href: "/explore", label: "Созвездие", icon: Compass, badge: 0, match: (p: string) => p.startsWith("/explore") || p.startsWith("/search") },
    ...(me ? [
      { href: "/messages", label: "Сообщения", icon: MessageCircle, badge: unreadMsgs, match: (p: string) => p.startsWith("/messages") },
      { href: "/notifications", label: "Уведомления", icon: Bell, badge: unread, match: (p: string) => p.startsWith("/notifications") },
      { href: "/bookmarks", label: "Закладки", icon: Bookmark, badge: 0, match: (p: string) => p.startsWith("/bookmarks") },
    ] : []),
    me
      ? { href: `/u/${me.handle}`, label: "Профиль", icon: UserRound, badge: 0, match: (p: string) => p === `/u/${me.handle}` }
      : { href: "/login", label: "Войти", icon: LogIn, badge: 0, match: (p: string) => p.startsWith("/login") },
  ];
  const mobileItems = items.filter((i) => i.href !== "/bookmarks");

  return (
    <div className="min-h-full">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-5 px-3 sm:px-5 lg:gap-6">
        {/* Левая навигация */}
        <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col overflow-y-auto py-5 no-scrollbar md:flex lg:w-60">
          <Link href="/" className="mb-6 flex items-center gap-2.5 px-3">
            <Logo size={32} />
            <Wordmark />
          </Link>
          <nav className="flex flex-col gap-0.5">
            {items.map((it) => (
              <NavLink key={it.href} href={it.href} active={it.match(pathname)} icon={it.icon} badge={it.badge}>{it.label}</NavLink>
            ))}
            <button onClick={palette.open} className="btn btn-ghost justify-start gap-3 px-3 py-2.5 text-[15px]">
              <Search size={20} strokeWidth={1.9} /> Поиск
              <kbd className="ml-auto hidden items-center gap-0.5 rounded-md border border-line-strong px-1.5 py-0.5 text-[10px] text-muted lg:inline-flex"><Command size={10} />K</kbd>
            </button>
          </nav>

          {me && <Link href="/?compose=1" className="btn btn-primary mt-5 py-3 text-[15px] shadow-card"><Sparkles size={18} /> Написать</Link>}

          <div className="mt-auto space-y-3 pt-6">
            <ThemeToggle />
            {me ? (
              <Link href={`/u/${me.handle}`} className="card flex items-center gap-3 p-2.5 transition hover:border-line-strong">
                <Avatar user={me} size={36} />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-semibold">{me.name}</span>
                  <span className="block truncate text-xs text-muted">@{me.handle}</span>
                </span>
              </Link>
            ) : (
              <Link href="/login" className="btn btn-outline w-full">Войти по нику</Link>
            )}
          </div>
        </aside>

        {/* Центр */}
        <main className={cn("min-w-0 flex-1 pt-3 md:pb-8 md:pt-5", isChat ? "pb-3" : "pb-24")}>
          <header className={cn("mb-3 flex items-center justify-between md:hidden", isChat && "hidden")}>
            <Link href="/" className="flex items-center gap-2"><Logo size={28} /><Wordmark compact /></Link>
            <div className="flex items-center gap-0.5">
              <button onClick={palette.open} className="btn btn-ghost btn-icon" aria-label="Поиск"><Search size={21} /></button>
              <ThemeToggle compact />
            </div>
          </header>
          {children}
        </main>

        {/* Правый рельс */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto py-5 no-scrollbar xl:block">
          <RightRail />
        </aside>
      </div>

      {/* Нижняя навигация (телефоны) */}
      {!isChat && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elev/95 backdrop-blur md:hidden pb-safe">
          <div className="mx-auto flex max-w-lg items-stretch justify-around">
            {mobileItems.map((it) => {
              const active = it.match(pathname);
              return (
                <Link key={it.href} href={it.href} className={cn("relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10.5px] leading-tight", active ? "text-accent" : "text-muted")}>
                  <it.icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                  <span className="truncate">{it.label}</span>
                  {it.badge ? <span className="absolute left-1/2 top-1 ml-1.5 min-w-4 rounded-full bg-rose px-1 text-[9px] font-bold leading-4 text-white">{it.badge > 99 ? "99+" : it.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <CommandPalette state={palette} />
    </div>
  );
}

function NavLink({ href, active, icon: Icon, badge, children }: { href: string; active: boolean; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; badge?: number; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("btn btn-ghost relative justify-start gap-3 px-3 py-2.5 text-[15px]", active && "bg-accent-soft font-bold text-ink")}>
      <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
      {children}
      {badge ? <span className="ml-auto rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-white">{badge > 99 ? "99+" : badge}</span> : null}
    </Link>
  );
}

/** Переключатель темы: сегментный контрол «Күн | Түн». */
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, setTheme, toggle } = useTheme();
  const dark = theme === "dark";
  if (compact) {
    return <button onClick={toggle} className="btn btn-ghost btn-icon" aria-label="Переключить тему">{dark ? <Sun size={21} /> : <Moon size={21} />}</button>;
  }
  return (
    <div className="seg w-full" role="radiogroup" aria-label="Тема">
      <button role="radio" aria-checked={!dark} onClick={() => setTheme("light")} className={cn("flex flex-1 items-center justify-center gap-1.5", !dark && "seg-on")}><Sun size={15} /> Күн</button>
      <button role="radio" aria-checked={dark} onClick={() => setTheme("dark")} className={cn("flex flex-1 items-center justify-center gap-1.5", dark && "seg-on")}><Moon size={15} /> Түн</button>
    </div>
  );
}

/** Словесный знак: «Expert» мелким акцентом над «Bailanysta». */
export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="leading-none">
      <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-accent">Expert</span>
      <span className={cn("block font-display font-bold tracking-tight", compact ? "text-base" : "text-lg")}>Bailanysta</span>
    </span>
  );
}
