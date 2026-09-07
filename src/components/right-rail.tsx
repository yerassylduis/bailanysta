"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Hash, Sparkles, Bot } from "lucide-react";
import { useMe, useSuggested, useTrending } from "@/hooks/use-data";
import { Avatar, Skeleton } from "./ui";
import { useT } from "./locale-provider";

/** Правый рельс: поиск, тренды хэштегов, кого почитать, подсказка про Cosmos. */
export function RightRail() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const trending = useTrending();
  const suggested = useSuggested();
  const { data: me } = useMe();
  const { t } = useT();

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }} className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("explore.searchPlaceholder")} className="input pl-10" />
      </form>

      <section className="card p-4">
        <h3 className="mb-3 font-display text-sm font-bold">{t("explore.trendingNow")}</h3>
        {trending.isPending ? (
          <div className="space-y-2.5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
        ) : trending.data?.items.length ? (
          <ul className="space-y-1.5">
            {trending.data.items.map((tag) => (
              <li key={tag.tag}>
                <Link href={`/search?q=${encodeURIComponent("#" + tag.tag)}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-accent-soft">
                  <span className="flex items-center gap-1.5 font-medium"><Hash size={14} className="text-accent" />{tag.tag}</span>
                  <span className="text-xs text-muted">{t("common.posts", { count: tag.count })}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">{t("explore.quiet")}</p>}
      </section>

      <section className="card p-4">
        <h3 className="mb-3 font-display text-sm font-bold">{t("explore.whoToRead")}</h3>
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
                    <span className="block truncate text-xs text-muted">@{u.handle} · {t("common.followers", { count: u.followers })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card relative overflow-hidden p-4">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-saffron-soft blur-2xl" />
        <h3 className="mb-1.5 flex items-center gap-2 font-display text-sm font-bold"><Sparkles size={16} className="text-saffron" /> Cosmos</h3>
        <p className="text-sm text-muted">{t("explore.cosmosBlurb")}</p>
        {!me?.user && <Link href="/login" className="btn btn-outline mt-3 w-full text-xs">{t("explore.loginTry")}</Link>}
      </section>

      {me?.user && (
        <Link href="/messages/bailanysta" className="card flex items-center gap-3 p-3 transition hover:border-accent">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Bot size={18} /></span>
          <span className="min-w-0 leading-tight"><span className="block text-sm font-semibold">{t("explore.haveQuestion")}</span><span className="block text-xs text-muted">{t("explore.askHelper")}</span></span>
        </Link>
      )}
      <p className="px-2 text-[11px] leading-relaxed text-muted">{t("explore.footer")}</p>
    </div>
  );
}
