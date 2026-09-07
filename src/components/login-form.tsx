"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { HANDLE_RE, hueFromHandle } from "@/lib/text";
import { cn } from "@/lib/format";
import { useT } from "./locale-provider";
import { Avatar, Logo } from "./ui";
import { useToast } from "./toast";

const DEMO = [
  { handle: "aisha", name: "Айша Нурлан" },
  { handle: "daniyar", name: "Данияр Ахмет" },
  { handle: "tomiris", name: "Томирис Сейт" },
];

/** Верхняя граница даты рождения — «не младше 13 лет»; считается один раз при загрузке модуля. */
const MAX_BIRTHDAY = new Date(Date.now() - 13 * 365.25 * 86400_000).toISOString().slice(0, 10);

type Mode = "login" | "register";
type Step = "form" | "code";

/**
 * Вход и регистрация по одноразовому коду.
 * Вход: почта → код. Регистрация: ник, имя, телефон, почта, день рождения (все обязательны) → код на почту.
 * Демо-аккаунты для проверяющих — одним нажатием, без кода.
 */
export function LoginForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);

  // вход
  const [target, setTarget] = useState("");
  // регистрация
  const [reg, setReg] = useState({ handle: "", name: "", phone: "", email: "", birthday: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // шаг с кодом
  const [sentTo, setSentTo] = useState<{ target: string; channel: "sms" | "email"; demoCode?: string; expiresInSec: number } | null>(null);
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!left) return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [left]);

  const validateReg = () => {
    const e: Record<string, string> = {};
    if (!HANDLE_RE.test(reg.handle)) e.handle = t("auth.errHandle");
    if (reg.name.trim().length < 2) e.name = t("auth.errName");
    if (reg.phone.replace(/\D/g, "").length < 10) e.phone = t("auth.errPhone");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(reg.email.trim())) e.email = t("auth.errEmail");
    if (!reg.birthday) e.birthday = t("auth.errBirthday");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const requestCode = async () => {
    setBusy(true);
    try {
      const res = mode === "login"
        ? await api.otpRequest({ target: target.trim() })
        : await api.otpRequest({ register: { ...reg, handle: reg.handle.toLowerCase().trim(), name: reg.name.trim(), phone: reg.phone.trim(), email: reg.email.trim() } });
      setSentTo({ target: res.target, channel: res.channel, demoCode: res.code, expiresInSec: res.expiresInSec });
      setCode(""); setLeft(30); setStep("code");
      toast(res.delivery === "sent" ? t("auth.toastSent") : t("auth.toastDemo"), "success");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) { toast(e instanceof Error ? e.message : t("auth.toastSendFailed"), "error"); }
    finally { setBusy(false); }
  };

  const verify = async (value = code) => {
    if (!sentTo || value.length !== 6) return;
    setBusy(true);
    try {
      const res = await api.otpVerify(sentTo.target, value);
      await qc.invalidateQueries();
      toast(res.created ? t("auth.toastWelcomeNew", { name: res.user.name }) : t("auth.toastWelcomeBack", { name: res.user.name }), "success");
      router.push(res.created ? "/messages/bailanysta" : "/");
    } catch (e) { toast(e instanceof Error ? e.message : t("auth.toastLoginFailed"), "error"); setCode(""); codeRef.current?.focus(); }
    finally { setBusy(false); }
  };

  const demo = async (h: string) => {
    setBusy(true);
    try { const res = await api.login(h); await qc.invalidateQueries(); toast(t("auth.toastWelcomeBack", { name: res.user.name }), "success"); router.push("/"); }
    catch (e) { toast(e instanceof Error ? e.message : t("auth.toastLoginFailed"), "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md pt-4 sm:pt-12">
      <div className="card fade-in p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3"><Logo size={36} /><div><h1 className="font-display text-2xl font-bold">{step === "code" ? t("auth.titleCode") : mode === "login" ? t("auth.titleLogin") : t("auth.titleRegister")}</h1><p className="text-sm text-muted">{step === "code" ? t("auth.subtitleCode") : mode === "login" ? t("auth.subtitleLogin") : t("auth.subtitleRegister")}</p></div></div>

        {step === "form" && (
          <div className="seg mb-5 w-full">
            <button onClick={() => setMode("login")} className={cn("flex-1", mode === "login" && "seg-on")}>{t("auth.tabLogin")}</button>
            <button onClick={() => setMode("register")} className={cn("flex-1", mode === "register" && "seg-on")}>{t("auth.tabRegister")}</button>
          </div>
        )}

        {step === "form" && mode === "login" && (
          <form onSubmit={(e) => { e.preventDefault(); if (target.trim()) requestCode(); }} className="space-y-3">
            <Field id="target" label={t("auth.email")}>
              <input id="target" type="email" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="you@mail.kz" className="input" autoFocus autoComplete="email" inputMode="email" />
            </Field>
            <button type="submit" disabled={!target.trim() || busy} className="btn btn-primary w-full py-3">{busy ? t("auth.sending") : <>{t("auth.getCode")} <ArrowRight size={16} /></>}</button>
            <p className="text-center text-xs text-muted">{t("auth.noAccount")} <button type="button" onClick={() => setMode("register")} className="link-tag">{t("auth.registerLink")}</button></p>
          </form>
        )}

        {step === "form" && mode === "register" && (
          <form onSubmit={(e) => { e.preventDefault(); if (validateReg()) requestCode(); }} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="handle" label={t("auth.handle")} error={errors.handle}>
                <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">@</span>
                  <input id="handle" value={reg.handle} onChange={(e) => setReg({ ...reg, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} placeholder="aisha" className="input pl-9" maxLength={32} autoComplete="username" /></div>
              </Field>
              <Field id="name" label={t("common.name")} error={errors.name}>
                <input id="name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder={t("auth.namePlaceholder")} className="input" maxLength={60} autoComplete="name" />
              </Field>
            </div>
            <Field id="phone" label={t("auth.phone")} error={errors.phone}>
              <input id="phone" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="+7 701 000 00 00" className="input" inputMode="tel" autoComplete="tel" />
            </Field>
            <Field id="email" label={t("auth.email")} error={errors.email}>
              <input id="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} placeholder="you@mail.kz" className="input" inputMode="email" autoComplete="email" />
            </Field>
            <Field id="birthday" label={t("auth.birthday")} error={errors.birthday}>
              <input id="birthday" type="date" value={reg.birthday} onChange={(e) => setReg({ ...reg, birthday: e.target.value })} className="input" max={MAX_BIRTHDAY} autoComplete="bday" />
            </Field>
            <button type="submit" disabled={busy} className="btn btn-primary w-full py-3">{busy ? t("auth.sending") : <>{t("auth.getCode")} <ArrowRight size={16} /></>}</button>
            <p className="text-center text-xs text-muted">{t("auth.hasAccount")} <button type="button" onClick={() => setMode("login")} className="link-tag">{t("auth.loginLink")}</button></p>
          </form>
        )}

        {step === "code" && sentTo && (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-4">
            <p className="text-sm text-ink-2">{t("auth.codeSentTo")} <b>{sentTo.target}</b>. {t("auth.codeValidFor", { count: Math.round(sentTo.expiresInSec / 60) })} {t("auth.codeCheckSpam")}</p>
            {sentTo.demoCode && (
              <div className="rounded-xl border border-saffron/40 bg-saffron-soft p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold"><Sparkles size={14} className="text-saffron" /> {t("auth.demoTitle")}</p>
                <p className="mt-1 text-ink-2">{t("auth.demoText")} <b className="font-mono text-lg tracking-widest">{sentTo.demoCode}</b></p>
              </div>
            )}
            <input ref={codeRef} value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) verify(v); }}
              inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" className="input text-center font-mono text-2xl tracking-[0.5em]" maxLength={6} />
            <button type="submit" disabled={code.length !== 6 || busy} className="btn btn-primary w-full py-3"><ShieldCheck size={16} /> {busy ? t("auth.verifying") : t("auth.confirm")}</button>
            <div className="flex items-center justify-between text-xs text-muted">
              <button type="button" onClick={() => { setStep("form"); setSentTo(null); }} className="flex items-center gap-1 hover:text-ink"><ArrowLeft size={12} /> {t("auth.editData")}</button>
              <button type="button" disabled={left > 0 || busy} onClick={requestCode} className="link-tag disabled:opacity-50 disabled:no-underline">{left > 0 ? t("auth.resendIn", { sec: left }) : t("auth.resend")}</button>
            </div>
          </form>
        )}

        {step === "form" && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />{t("auth.orDemo")}<span className="h-px flex-1 bg-line" /></div>
            <div className="grid gap-2 sm:grid-cols-3">
              {DEMO.map((u) => (
                <button key={u.handle} onClick={() => demo(u.handle)} disabled={busy} className="card flex items-center gap-2.5 p-3 text-left transition hover:border-accent">
                  <Avatar user={{ ...u, hue: hueFromHandle(u.handle) }} size={32} />
                  <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-semibold">{u.name.split(" ")[0]}</span><span className="block text-xs text-muted">@{u.handle}</span></span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="mt-4 px-2 text-center text-xs text-muted">{t("auth.footer")}</p>
    </div>
  );
}

/** Обязательное поле формы с подписью и ошибкой. */
function Field({ id, label, children, error }: { id: string; label: string; children: React.ReactNode; error?: string }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{label} <span className="text-rose">*</span></span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose">{error}</span>}
    </label>
  );
}
