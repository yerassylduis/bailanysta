"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Feed } from "./feed";
import { PostEditor } from "./post-editor";
import { useMe } from "@/hooks/use-data";
import { MOODS } from "@/lib/text";
import { cn } from "@/lib/format";
import { Logo } from "./ui";
import { useT } from "./locale-provider";
import { ArrowRight, Sparkles, Flame } from "lucide-react";

/** Главная: приветствие для гостей, редактор, вкладки «Все / Подписки», фильтр по настроению. */
export function HomeFeed() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useT();
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
            <h1 className="font-display text-3xl font-bold leading-[1.1] sm:text-4xl">{t("feed.heroTitle1")}<br />{t("feed.heroTitle2")}</h1>
            <p className="mt-3 max-w-md text-[15px] text-ink-2">{t("feed.heroText")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/login" className="btn btn-primary">{t("feed.loginByHandle")} <ArrowRight size={16} /></Link>
              <Link href="/explore" className="btn btn-outline">{t("feed.seeConstellation")}</Link>
            </div>
          </div>
        </section>
      )}

      {me && <PostEditor autoFocus={compose} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="seg">
          <button onClick={() => setParam("scope")} className={cn(scope === "all" && "seg-on")}>{t("common.all")}</button>
          <button onClick={() => me ? setParam("scope", "following") : router.push("/login")} className={cn(scope === "following" && "seg-on")}>{t("feed.following")}</button>
          <button onClick={() => setParam("scope", "hot")} className={cn("flex items-center gap-1", scope === "hot" && "seg-on")}><Flame size={14} className={scope === "hot" ? "text-rose" : ""} /> {t("feed.hot")}</button>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 sm:ml-auto sm:mx-0 sm:px-0">
          {MOODS.map((m) => (
            <button key={m.id} onClick={() => setParam("mood", mood === m.id ? undefined : m.id)} className={cn("chip shrink-0", mood === m.id && "chip-active")} title={t(`posts.moodHint.${m.id}`)}>{m.emoji} {t(`posts.mood.${m.id}`)}</button>
          ))}
        </div>
      </div>

      <Feed
        filter={{ scope, mood }}
        live={scope === "all" && !mood}
        emptyTitle={scope === "following" ? t("feed.emptyFollowing") : scope === "hot" ? t("feed.emptyHot") : t("feed.emptyMood")}
        emptyText={scope === "following" ? t("feed.emptyFollowingText") : t("feed.emptyText")}
        emptyAction={scope === "following" ? <Link href="/explore" className="btn btn-primary"><Sparkles size={16} /> {t("feed.openConstellation")}</Link> : undefined}
      />
    </div>
  );
}
