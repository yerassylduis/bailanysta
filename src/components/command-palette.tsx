"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Compass, Hash, Home, Moon, Search, UserRound, Bell, PenLine, MessageCircle, Bookmark, Video } from "lucide-react";
import { api } from "@/lib/api-client";
import { useMe } from "@/hooks/use-data";
import { useTheme } from "./providers";
import { Avatar } from "./ui";
import { cn } from "@/lib/format";

/**
 * Командная палитра (⌘K / Ctrl+K): навигация, поиск людей и постов, действия.
 * Нетипичная для соцсети деталь — делает интерфейс «клавиатурным».
 */
export function useCommandPalette() {
  const [isOpen, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { isOpen, open: () => setOpen(true), close: () => setOpen(false) };
}

type Item = { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void };

export function CommandPalette({ state }: { state: ReturnType<typeof useCommandPalette> }) {
  // Монтируется только в открытом виде: состояние (запрос, курсор) каждый раз свежее без эффектов.
  if (!state.isOpen) return null;
  return <PaletteDialog state={state} />;
}

function PaletteDialog({ state }: { state: ReturnType<typeof useCommandPalette> }) {
  const router = useRouter();
  const { toggle, theme } = useTheme();
  const { data } = useMe();
  const me = data?.user;
  const [q, setQRaw] = useState("");
  const [idx, setIdx] = useState(0);
  const setQ = (v: string) => { setQRaw(v); setIdx(0); };

  const users = useQuery({ queryKey: ["cmd-users", q], queryFn: () => api.searchUsers(q), enabled: state.isOpen && q.trim().length >= 1 && !q.startsWith("#"), staleTime: 10_000 });
  const posts = useQuery({ queryKey: ["cmd-posts", q], queryFn: () => api.posts({ q, limit: 4 }), enabled: state.isOpen && q.trim().length >= 2, staleTime: 10_000 });

  const go = (href: string) => { state.close(); router.push(href); };

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      { id: "home", label: "Лента", icon: <Home size={16} />, run: () => go("/") },
      { id: "explore", label: "Созвездие связей", icon: <Compass size={16} />, run: () => go("/explore") },
      ...(me ? [
        { id: "compose", label: "Написать пост", hint: "N", icon: <PenLine size={16} />, run: () => go("/?compose=1") },
        { id: "notif", label: "Уведомления", icon: <Bell size={16} />, run: () => go("/notifications") },
        { id: "msgs", label: "Сообщения", icon: <MessageCircle size={16} />, run: () => go("/messages") },
        { id: "calls", label: "Байланыс · созвоны", icon: <Video size={16} />, run: () => go("/calls") },
        { id: "bm", label: "Закладки", icon: <Bookmark size={16} />, run: () => go("/bookmarks") },
        { id: "me", label: "Мой профиль", hint: `@${me.handle}`, icon: <UserRound size={16} />, run: () => go(`/u/${me.handle}`) },
      ] : [{ id: "login", label: "Войти", icon: <UserRound size={16} />, run: () => go("/login") }]),
      { id: "theme", label: theme === "dark" ? "Светлая тема · Күн" : "Тёмная тема · Түн", icon: <Moon size={16} />, run: () => { toggle(); state.close(); } },
    ];
    const qq = q.trim();
    if (!qq) return base;
    const res: Item[] = [];
    res.push({ id: "search", label: `Искать «${qq}»`, hint: "все посты", icon: <Search size={16} />, run: () => go(`/search?q=${encodeURIComponent(qq)}`) });
    if (qq.startsWith("#")) res.push({ id: "tag", label: `Тег ${qq}`, icon: <Hash size={16} />, run: () => go(`/search?q=${encodeURIComponent(qq)}`) });
    for (const u of users.data?.items ?? []) res.push({ id: `u-${u.id}`, label: u.name, hint: `@${u.handle}`, icon: <Avatar user={u} size={20} />, run: () => go(`/u/${u.handle}`) });
    for (const p of posts.data?.items ?? []) res.push({ id: `p-${p.id}`, label: p.text.slice(0, 70), hint: `@${p.author.handle}`, icon: <Search size={16} className="text-muted" />, run: () => go(`/post/${p.id}`) });
    for (const b of base) if (b.label.toLowerCase().includes(qq.toLowerCase())) res.push(b);
    return res;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, me, theme, users.data, posts.data]);

  const cur = Math.min(idx, Math.max(items.length - 1, 0));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={state.close}>
      <div className="card fade-in w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Командная палитра">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search size={18} className="text-muted" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx(Math.min(cur + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx(Math.max(cur - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); items[cur]?.run(); }
            }}
            placeholder="Куда идём? Люди, #теги, посты…" className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted">esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {items.map((it, i) => (
            <li key={it.id}>
              <button onMouseEnter={() => setIdx(i)} onClick={it.run}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === cur ? "bg-accent-soft" : "hover:bg-bg-2")}>
                <span className="flex h-6 w-6 items-center justify-center text-ink-2">{it.icon}</span>
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="text-xs text-muted">{it.hint}</span>}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-muted">Ничего не нашлось</li>}
        </ul>
      </div>
    </div>
  );
}
