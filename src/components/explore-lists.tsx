"use client";

import Link from "next/link";
import { Hash } from "lucide-react";
import { useGraph, useTrending } from "@/hooks/use-data";
import { Avatar, Skeleton } from "./ui";
import { plural } from "@/lib/format";

/** Под графом: все люди сети и трендовые теги — плоский, доступный дубль созвездия. */
export function ExploreLists() {
  const graph = useGraph();
  const trending = useTrending();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card p-4">
        <h2 className="mb-3 font-display text-sm font-bold">Люди</h2>
        {graph.isPending ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
          <ul className="space-y-1">
            {[...(graph.data?.nodes ?? [])].sort((a, b) => b.followers - a.followers).map((u) => (
              <li key={u.id}>
                <Link href={`/u/${u.handle}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-accent-soft">
                  <Avatar user={u} size={36} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold">{u.name}</span>
                    <span className="block truncate text-xs text-muted">@{u.handle}{u.bio ? ` · ${u.bio}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] leading-tight text-muted">{u.posts} {plural(u.posts, "пост", "поста", "постов")}<br />{u.followers} {plural(u.followers, "подписчик", "подписчика", "подписчиков")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card p-4">
        <h2 className="mb-3 font-display text-sm font-bold">Теги за две недели</h2>
        {trending.isPending ? <div className="flex flex-wrap gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-full!" />)}</div> : (
          <div className="flex flex-wrap gap-2">
            {trending.data?.items.map((t, i) => (
              <Link key={t.tag} href={`/search?q=${encodeURIComponent("#" + t.tag)}`} className="chip py-1.5" style={{ fontSize: `${Math.max(12, 16 - i)}px` }}><Hash size={12} className="text-accent" />{t.tag}<span className="text-muted">{t.count}</span></Link>
            ))}
            {trending.data && !trending.data.items.length && <p className="text-sm text-muted">Тегов пока нет.</p>}
          </div>
        )}
      </section>
    </div>
  );
}
