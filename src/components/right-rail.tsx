"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Hash, Sparkles } from "lucide-react";
import { useMe, useSuggested, useTrending } from "@/hooks/use-data";
import { Avatar, Skeleton } from "./ui";
import { plural } from "@/lib/format";

/** Правый рельс: поиск, тренды хэштегов, кого почитать, подсказка про Музу. */
export function RightRail() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const trending = useTrending();
  const suggested = useSuggested();
  const { data: me } = useMe();

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }} className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск постов, #тегов, @людей" className="input pl-10" />
      </form>

      <section className="card p-4">
        <h3 className="mb-3 font-display text-sm font-bold">Сейчас обсуждают</h3>
        {trending.isPending ? (
          <div className="space-y-2.5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
        ) : trending.data?.items.length ? (
          <ul className="space-y-1.5">
            {trending.data.items.map((t) => (
              <li key={t.tag}>
                <Link href={`/search?q=${encodeURIComponent("#" + t.tag)}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent-soft">
                  <span className="flex items-center gap-1.5 font-medium"><Hash size={14} className="text-accent" />{t.tag}</span>
                  <span className="text-xs text-muted">{t.count} {plural(t.count, "пост", "поста", "постов")}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Пока тихо. Напишите первый пост с #тегом.</p>}
      </section>

      <section className="card p-4">
        <h3 className="mb-3 font-display text-sm font-bold">Кого почитать</h3>
        {suggested.isPending ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full!" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div></div>)}</div>
        ) : (
          <ul className="space-y-2.5">
            {suggested.data?.items.map((u) => (
              <li key={u.id}>
                <Link href={`/u/${u.handle}`} className="flex items-center gap-3 rounded-lg p-1 transition hover:bg-accent-soft">
                  <Avatar user={u} size={36} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold">{u.name}</span>
                    <span className="block truncate text-xs text-muted">@{u.handle} · {u.followers} {plural(u.followers, "подписчик", "подписчика", "подписчиков")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card relative overflow-hidden p-4">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-saffron-soft blur-2xl" />
        <h3 className="mb-1.5 flex items-center gap-2 font-display text-sm font-bold"><Sparkles size={16} className="text-saffron" /> Муза</h3>
        <p className="text-sm text-muted">ИИ-соавтор: набросок в пост, полировка, хэштеги, перевод на қазақша. Кнопка ✨ в редакторе.</p>
        {!me?.user && <Link href="/login" className="btn btn-outline mt-3 w-full text-xs">Войти и попробовать</Link>}
      </section>

      <p className="px-2 text-[11px] leading-relaxed text-muted">Bailanysta · «байланыс» — связь. Сделано для nFactorial, 2026.</p>
    </div>
  );
}
