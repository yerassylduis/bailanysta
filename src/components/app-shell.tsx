"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, LogIn, Moon, Search, Sun, UserRound, Sparkles, Command } from "lucide-react";
import { useMe } from "@/hooks/use-data";
import { useTheme } from "./providers";
import { Avatar, Logo } from "./ui";
import { cn } from "@/lib/format";
import { RightRail } from "./right-rail";
import { CommandPalette, useCommandPalette } from "./command-palette";

/**
 * Каркас: слева навигация, в центре контент, справа «рельс» с поиском и подсказками.
 * На мобильных — нижняя панель. Дерево: AppShell → (Nav | main | RightRail) + CommandPalette.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useMe();
  const me = data?.user ?? null;
  const unread = data?.unread ?? 0;
  const palette = useCommandPalette();

  const items = [
    { href: "/", label: "Лента", icon: Home, match: (p: string) => p === "/" || p.startsWith("/post") },
    { href: "/explore", label: "Созвездие", icon: Compass, match: (p: string) => p.startsWith("/explore") || p.startsWith("/search") },
    ...(me ? [{ href: "/notifications", label: "Уведомления", icon: Bell, badge: unread, match: (p: string) => p.startsWith("/notifications") }] : []),
    me
      ? { href: `/u/${me.handle}`, label: "Профиль", icon: UserRound, match: (p: string) => p === `/u/${me.handle}` }
      : { href: "/login", label: "Войти", icon: LogIn, match: (p: string) => p.startsWith("/login") },
  ];

  return (
    <div className="ornament min-h-full">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-3 sm:px-6">
        {/* Левая навигация */}
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col py-6 md:flex lg:w-64">
          <Link href="/" className="mb-8 flex items-center gap-3 px-3">
            <Logo size={34} />
            <span className="font-display text-xl font-bold tracking-tight">Bailanysta</span>
          </Link>
          <nav className="flex flex-col gap-1">
            {items.map((it) => (
              <NavLink key={it.href} href={it.href} active={it.match(pathname)} icon={it.icon} badge={"badge" in it ? it.badge : 0}>{it.label}</NavLink>
            ))}
            <button onClick={palette.open} className="btn btn-ghost mt-1 justify-start gap-3 px-3 py-2.5 text-[15px]">
              <Search size={20} strokeWidth={1.9} /> Поиск
              <kbd className="ml-auto hidden items-center gap-0.5 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted lg:inline-flex"><Command size={10} />K</kbd>
            </button>
          </nav>

          {me && (
            <Link href="/?compose=1" className="btn btn-primary mt-6 py-3 text-base shadow-card"><Sparkles size={18} /> Написать</Link>
          )}

          <div className="mt-auto space-y-3">
            <ThemeToggle />
            {me ? (
              <Link href={`/u/${me.handle}`} className="card flex items-center gap-3 p-3 transition hover:border-line-strong">
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
        <main className="min-w-0 flex-1 pb-24 pt-4 md:pb-10 md:pt-6">
          <header className="mb-4 flex items-center justify-between md:hidden">
            <Link href="/" className="flex items-center gap-2"><Logo size={28} /><span className="font-display text-lg font-bold">Bailanysta</span></Link>
            <div className="flex items-center gap-1">
              <button onClick={palette.open} className="btn btn-ghost h-10 w-10 p-0" aria-label="Поиск"><Search size={20} /></button>
              <ThemeToggle compact />
            </div>
          </header>
          {children}
        </main>

        {/* Правый рельс */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto py-6 xl:block">
          <RightRail />
        </aside>
      </div>

      {/* Нижняя навигация (мобильные) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elev/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {items.map((it) => {
            const active = it.match(pathname);
            return (
              <Link key={it.href} href={it.href} className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px]", active ? "text-accent" : "text-muted")}>
                <it.icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                {it.label}
                {"badge" in it && it.badge ? <span className="absolute right-1/4 top-1.5 h-2 w-2 rounded-full bg-rose" /> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <CommandPalette state={palette} />
    </div>
  );
}

function NavLink({ href, active, icon: Icon, badge, children }: { href: string; active: boolean; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; badge?: number; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("btn btn-ghost relative justify-start gap-3 px-3 py-2.5 text-[15px]", active && "bg-accent-soft text-ink font-bold")}>
      <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
      {children}
      {badge ? <span className="ml-auto rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-white">{badge > 99 ? "99+" : badge}</span> : null}
    </Link>
  );
}

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  if (compact) {
    return <button onClick={toggle} className="btn btn-ghost h-10 w-10 p-0" aria-label="Переключить тему">{dark ? <Sun size={20} /> : <Moon size={20} />}</button>;
  }
  return (
    <button onClick={toggle} className="card flex w-full items-center justify-between px-3 py-2.5 text-sm transition hover:border-line-strong" aria-label="Переключить тему">
      <span className="flex items-center gap-2 font-medium">{dark ? <Moon size={16} /> : <Sun size={16} />}{dark ? "Түн · ночь" : "Күн · день"}</span>
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", dark ? "bg-accent" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", dark ? "translate-x-4.5" : "translate-x-0.5")} />
      </span>
    </button>
  );
}
