"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Plus, LogIn, Users, Radio } from "lucide-react";
import { useCalls, useCreateCall, useMe } from "@/hooks/use-data";
import { Avatar, EmptyState, Skeleton } from "./ui";
import { useToast } from "./toast";
import { timeAgo, plural } from "@/lib/format";

/** Раздел «Байланыс»: создать созвон, войти по коду, список моих созвонов. */
export function CallsView() {
  const { data: me, isPending } = useMe();
  const calls = useCalls(!!me?.user);
  const create = useCreateCall();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");

  if (!isPending && !me?.user) return <EmptyState title="Созвоны только для своих" text="Войдите, чтобы созваниваться с друзьями: видео, экран, чат и запись." action={<Link href="/login" className="btn btn-primary">Войти</Link>} />;

  const onCreate = async () => {
    try { const c = await create.mutateAsync(title.trim() || undefined); router.push(`/calls/${c.id}`); }
    catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "error"); }
  };
  const onJoin = () => {
    const id = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^.*\/calls\//, "");
    if (id) router.push(`/calls/${id}`);
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Expert Байланыс</p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Созвоны с друзьями</h1>
        <p className="mt-1.5 max-w-xl text-sm text-ink-2">Видео и звук напрямую между браузерами, демонстрация экрана, чат внутри звонка и запись встречи файлом. Создайте комнату и отправьте ссылку.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><Plus size={18} className="text-accent" /> Новый созвон</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название (необязательно)" className="input mt-3" maxLength={80} onKeyDown={(e) => { if (e.key === "Enter") onCreate(); }} />
          <button onClick={onCreate} disabled={create.isPending} className="btn btn-primary mt-3 w-full py-3"><Video size={18} /> Создать и войти</button>
        </section>
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><LogIn size={18} className="text-saffron" /> Войти по коду</h2>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="abc-def-ghk или ссылка" className="input mt-3 font-mono" onKeyDown={(e) => { if (e.key === "Enter") onJoin(); }} />
          <button onClick={onJoin} disabled={!code.trim()} className="btn btn-outline mt-3 w-full py-3">Присоединиться</button>
        </section>
      </div>

      <section>
        <h2 className="mb-3 px-1 font-display text-sm font-bold uppercase tracking-wider text-muted">Мои созвоны</h2>
        {calls.isPending ? <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl!" />)}</div> : !calls.data?.items.length ? (
          <p className="card p-5 text-sm text-muted">Пока не было ни одного созвона. Создайте первый — это бесплатно и без установки.</p>
        ) : (
          <ul className="space-y-2">
            {calls.data.items.map((c) => {
              const online = c.participants.filter((p) => p.online);
              const live = !c.endedAt && online.length > 0;
              return (
                <li key={c.id}>
                  <Link href={`/calls/${c.id}`} className="card flex items-center gap-3 p-3.5 transition hover:border-accent">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${live ? "bg-rose-soft text-rose" : "bg-accent-soft text-accent"}`}>{live ? <Radio size={20} /> : <Video size={20} />}</span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="flex items-center gap-2 text-sm font-semibold"><span className="truncate">{c.title}</span><span className="font-mono text-[11px] text-muted">{c.id}</span>{live && <span className="chip py-0 text-[10px] text-rose">в эфире</span>}</span>
                      <span className="block truncate text-xs text-muted">{c.host.name} · {timeAgo(c.createdAt)}{c.endedAt ? " · завершён" : ""} · {c.participants.length} {plural(c.participants.length, "участник", "участника", "участников")}</span>
                    </span>
                    <span className="hidden -space-x-2 sm:flex">{c.participants.slice(0, 4).map((p) => <Avatar key={p.id} user={p} size={26} className="ring-2 ring-elev" />)}</span>
                    <Users size={16} className="text-muted sm:hidden" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
