"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { Feed } from "./feed";
import { Avatar } from "./ui";
import { useT } from "./locale-provider";
import Link from "next/link";

/** Поиск: строка → URL (?q=) → лента с фильтром. «#тег» ищет по тегам, иначе — по тексту; люди — отдельной полкой. */
export function SearchView() {
  const sp = useSearchParams();
  const router = useRouter();
  const { t } = useT();
  const q = sp.get("q") ?? "";

  const people = useQuery({ queryKey: ["search-users", q], queryFn: () => api.searchUsers(q), enabled: q.length >= 1 && !q.startsWith("#") });
  const isTag = q.startsWith("#");

  return (
    <div className="space-y-5">
      {/* key={q}: при смене запроса в URL форма пересоздаётся с новым начальным значением */}
      <SearchForm key={q} initial={q} onSubmit={(v) => router.push(v ? `/search?q=${encodeURIComponent(v)}` : "/search")} />

      {!q ? (
        <div className="card p-6 text-sm text-muted">
          <p className="font-semibold text-ink">{t("search.tipsTitle")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><span className="link-tag">{t("search.tipTagExample")}</span> {t("search.tipTagText")}</li>
            <li><span className="link-tag">{t("search.tipTextExample")}</span> {t("search.tipTextText")}</li>
            <li><span className="link-tag">{t("search.tipUserExample")}</span> {t("search.tipUserText")}</li>
          </ul>
        </div>
      ) : (
        <>
          {people.data?.items.length ? (
            <section className="card p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{t("search.people")}</h2>
              <div className="flex flex-wrap gap-2">
                {people.data.items.map((u) => (
                  <Link key={u.id} href={`/u/${u.handle}`} className="chip py-1.5 pl-1"><Avatar user={u} size={22} />{u.name} <span className="text-muted">@{u.handle}</span></Link>
                ))}
              </div>
            </section>
          ) : null}
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">{isTag ? t("search.postsWithTag", { q }) : t("search.postsForQuery", { q })}</h2>
          <Feed filter={{ q }} emptyTitle={t("search.emptyTitle")} emptyText={t("search.emptyText")} />
        </>
      )}
    </div>
  );
}

function SearchForm({ initial, onSubmit }: { initial: string; onSubmit: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  const { t } = useT();
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(value.trim()); }} className="relative">
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder={t("search.placeholder")} className="input py-3.5 pl-12 text-base" />
    </form>
  );
}
