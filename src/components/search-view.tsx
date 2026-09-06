"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { Feed } from "./feed";
import { Avatar } from "./ui";
import Link from "next/link";

/** Поиск: строка → URL (?q=) → лента с фильтром. «#тег» ищет по тегам, иначе — по тексту; люди — отдельной полкой. */
export function SearchView() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.get("q") ?? "";

  const people = useQuery({ queryKey: ["search-users", q], queryFn: () => api.searchUsers(q), enabled: q.length >= 1 && !q.startsWith("#") });
  const isTag = q.startsWith("#");

  return (
    <div className="space-y-5">
      {/* key={q}: при смене запроса в URL форма пересоздаётся с новым начальным значением */}
      <SearchForm key={q} initial={q} onSubmit={(v) => router.push(v ? `/search?q=${encodeURIComponent(v)}` : "/search")} />

      {!q ? (
        <div className="card p-6 text-sm text-muted">
          <p className="font-semibold text-ink">Подсказки</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><span className="link-tag">#дизайн</span> — все посты с тегом (по префиксу: #диз найдёт и #дизайн).</li>
            <li><span className="link-tag">степь</span> — поиск по тексту постов, без учёта регистра.</li>
            <li><span className="link-tag">@aisha</span> — люди по нику или имени.</li>
          </ul>
        </div>
      ) : (
        <>
          {people.data?.items.length ? (
            <section className="card p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Люди</h2>
              <div className="flex flex-wrap gap-2">
                {people.data.items.map((u) => (
                  <Link key={u.id} href={`/u/${u.handle}`} className="chip py-1.5 pl-1"><Avatar user={u} size={22} />{u.name} <span className="text-muted">@{u.handle}</span></Link>
                ))}
              </div>
            </section>
          ) : null}
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">{isTag ? `Посты с тегом ${q}` : `Посты по запросу «${q}»`}</h2>
          <Feed filter={{ q }} emptyTitle="Ничего не нашлось" emptyText="Попробуйте другое слово или тег. Или напишите об этом первым." />
        </>
      )}
    </div>
  );
}

function SearchForm({ initial, onSubmit }: { initial: string; onSubmit: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(value.trim()); }} className="relative">
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder="Слова, #теги, @люди…" className="input py-3.5 pl-12 text-base" />
    </form>
  );
}
