"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Bell, Globe, Languages, LogOut, Palette, Settings, ShieldCheck, Sparkles, UserRound, Volume2 } from "lucide-react";
import { useLogout, useMe } from "@/hooks/use-data";
import { playNotify, setSoundEnabled, soundEnabled, subscribeSound } from "@/lib/sound";
import { cosmosEnabled, setCosmosEnabled, subscribePrefs } from "@/lib/prefs";
import { LOCALE_NAMES } from "@/lib/i18n";
import { cn } from "@/lib/format";
import { LangToggle, useT } from "./locale-provider";
import { ThemeToggle } from "./app-shell";
import { Avatar } from "./ui";

/** Раздел «Настройки»: тема, язык, звук, анимация фона, аккаунт. Доступен и без входа. */
export function SettingsView() {
  const { t, locale } = useT();
  const { data } = useMe();
  const me = data?.user ?? null;
  const logout = useLogout();
  const sound = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  const cosmos = useSyncExternalStore(subscribePrefs, cosmosEnabled, () => true);

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Settings size={24} /> {t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("settings.subtitle")}</p>
      </header>

      <Section icon={<Palette size={18} />} title={t("settings.appearance")} hint={t("settings.appearanceHint")}>
        <div className="max-w-xs"><ThemeToggle /></div>
      </Section>

      <Section icon={<Languages size={18} />} title={t("settings.language")} hint={t("settings.languageHint")}>
        <div className="max-w-xs"><LangToggle /></div>
        <p className="mt-2 text-xs text-muted">{LOCALE_NAMES[locale]}</p>
      </Section>

      <Section icon={<Bell size={18} />} title={t("settings.notifications")}>
        <Row title={t("settings.sound")} hint={t("settings.soundHint")}>
          <button onClick={() => playNotify(true)} className="btn btn-ghost gap-1.5 px-2.5 py-1.5 text-xs" disabled={!sound}><Volume2 size={14} /> {t("settings.testSound")}</button>
          <Switch on={sound} onChange={setSoundEnabled} labelOn={t("settings.on")} labelOff={t("settings.off")} />
        </Row>
      </Section>

      <Section icon={<Sparkles size={18} />} title={t("settings.extra")}>
        <Row title={t("settings.cosmos")} hint={t("settings.cosmosHint")}>
          <Switch on={cosmos} onChange={setCosmosEnabled} labelOn={t("settings.on")} labelOff={t("settings.off")} />
        </Row>
      </Section>

      <Section icon={<UserRound size={18} />} title={t("settings.account")} hint={me ? t("settings.accountHint") : t("settings.notLoggedIn")}>
        {me ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar user={me} size={44} />
              <div className="min-w-0 leading-tight">
                <div className="truncate font-semibold">{me.name}</div>
                <div className="truncate text-xs text-muted">@{me.handle}{me.email ? ` · ${me.email}` : ""}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/u/${me.handle}`} className="btn btn-outline gap-1.5 px-3 py-1.5 text-sm"><UserRound size={15} /> {t("settings.openProfile")}</Link>
              {me.isAdmin && <Link href="/admin" className="btn btn-outline gap-1.5 px-3 py-1.5 text-sm"><ShieldCheck size={15} /> {t("settings.adminPanel")}</Link>}
              <button onClick={() => logout.mutate()} disabled={logout.isPending} className="btn btn-ghost gap-1.5 px-3 py-1.5 text-sm text-rose"><LogOut size={15} /> {t("settings.logout")}</button>
            </div>
          </div>
        ) : (
          <Link href="/login" className="btn btn-primary px-4 py-2 text-sm">{t("settings.login")}</Link>
        )}
      </Section>

      <Section icon={<Globe size={18} />} title={t("settings.about")} hint={t("settings.aboutText")}>
        <a href="https://github.com/yerassylduis/bailanysta" target="_blank" rel="noreferrer" className="btn btn-outline px-3 py-1.5 text-sm">{t("settings.github")}</a>
      </Section>
    </div>
  );
}

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bg/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Switch({ on, onChange, labelOn, labelOff }: { on: boolean; onChange: (v: boolean) => void; labelOn: string; labelOff: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center gap-2 text-xs font-semibold text-ink-2">
      <span className={cn("relative inline-block h-6 w-11 rounded-full transition", on ? "bg-accent" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", on ? "left-[22px]" : "left-0.5")} />
      </span>
      <span className="w-12">{on ? labelOn : labelOff}</span>
    </button>
  );
}
