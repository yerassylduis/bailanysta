"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Feed } from "./feed";
import { PostEditor } from "./post-editor";
import { useMe } from "@/hooks/use-data";
import { MOODS } from "@/lib/text";
import { cn } from "@/lib/format";
import { Logo } from "./ui";
import { ArrowRight, Sparkles, Flame } from "lucide-react";

/** Главная: приветствие для гостей, редактор, вкладки «Все / Подписки», фильтр по настроению. */
export function HomeFeed() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data, isPending } = useMe();
  const me = data?.user;
  const sc = sp.get("scope");
  const scope = sc === "following" && me ? "following" : sc === "hot" ? "hot" : "all";
  const mood = sp.get("mood") ?? undefined;
  const compose = sp.get("compose") === "1";

  const setParam = (k: string, v?: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    p.delete("compose");
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  return (
    <div className="space-y-5">
      {!isPending && !me && (
        <section className="card relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent-soft blur-3xl" />
          <div className="absolute -bottom-12 right-24 h-40 w-40 rounded-full bg-saffron-soft blur-3xl" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent"><Logo size={18} /> Expert Bailanysta</div>
            <h1 className="font-display text-3xl font-bold leading-[1.1] sm:text-4xl">Байланыс —<br />это связь между людьми.</h1>
            <p className="mt-3 max-w-md text-[15px] text-ink-2">Уютная сеть: посты с настроением, фото и видео, личные сообщения, созвездие подписок и ИИ-соавтор Cosmos. Без паролей — просто выберите ник.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/login" className="btn btn-primary">Войти по нику <ArrowRight size={16} /></Link>
              <Link href="/explore" className="btn btn-outline">Смотреть созвездие</Link>
            </div>
          </div>
        </section>
      )}

      {me && <PostEditor autoFocus={compose} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="seg">
          <button onClick={() => setParam("scope")} className={cn(scope === "all" && "seg-on")}>Все</button>
          <button onClick={() => me ? setParam("scope", "following") : router.push("/login")} className={cn(scope === "following" && "seg-on")}>Подписки</button>
          <button onClick={() => setParam("scope", "hot")} className={cn("flex items-center gap-1", scope === "hot" && "seg-on")}><Flame size={14} className={scope === "hot" ? "text-rose" : ""} /> Горячее</button>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 sm:ml-auto sm:mx-0 sm:px-0">
          {MOODS.map((m) => (
            <button key={m.id} onClick={() => setParam("mood", mood === m.id ? undefined : m.id)} className={cn("chip shrink-0", mood === m.id && "chip-active")} title={m.hint}>{m.emoji} {m.label}</button>
          ))}
        </div>
      </div>

      <Feed
        filter={{ scope, mood }}
        emptyTitle={scope === "following" ? "В подписках пока тихо" : scope === "hot" ? "За неделю ещё ничего не разгорелось" : "Постов с таким настроением ещё нет"}
        emptyText={scope === "following" ? "Подпишитесь на кого-нибудь в созвездии — и лента оживёт." : "Станьте первым, кто задаст этот тон."}
        emptyAction={scope === "following" ? <Link href="/explore" className="btn btn-primary"><Sparkles size={16} /> Открыть созвездие</Link> : undefined}
      />
    </div>
  );
}
