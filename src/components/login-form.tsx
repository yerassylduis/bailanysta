"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { HANDLE_RE, hueFromHandle } from "@/lib/text";
import { Avatar, Logo } from "./ui";
import { useToast } from "./toast";

const DEMO = [
  { handle: "aisha", name: "Айша Нурлан", hue: 0 },
  { handle: "daniyar", name: "Данияр Ахмет", hue: 0 },
  { handle: "tomiris", name: "Томирис Сейт", hue: 0 },
];

/** Вход по нику: существующий — войдёт, новый — создастся. Демо-аккаунты одним кликом. */
export function LoginForm() {
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const valid = HANDLE_RE.test(handle);

  const go = async (h: string, n?: string) => {
    setBusy(true);
    try {
      const res = await api.login(h, n);
      await qc.invalidateQueries();
      toast(res.created ? `Добро пожаловать, ${res.user.name}! Профиль создан.` : `С возвращением, ${res.user.name}!`, "success");
      // Новичка встречает помощник в чате, знакомого пользователя — лента.
      router.push(res.created ? "/messages/bailanysta" : "/");
    } catch (e) { toast(e instanceof Error ? e.message : "Не удалось войти", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md pt-6 sm:pt-16">
      <div className="card fade-in p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3"><Logo size={36} /><div><h1 className="font-display text-2xl font-bold">Войти в Bailanysta</h1><p className="text-sm text-muted">Без пароля. Ник — это и есть вы.</p></div></div>
        <form onSubmit={(e) => { e.preventDefault(); if (valid) go(handle, name); }} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Ник</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">@</span>
              <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="aisha" className="input pl-9" autoFocus autoComplete="username" maxLength={32} />
            </div>
            <span className="mt-1 block text-xs text-muted">2–32 символа: латиница, цифры, «_». Если ника нет — создадим профиль.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Имя (для новых)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как вас называть?" className="input" maxLength={60} />
          </label>
          <button type="submit" disabled={!valid || busy} className="btn btn-primary w-full py-3">
            {busy ? "Секунду…" : <>Войти <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />или попробуйте демо<span className="h-px flex-1 bg-line" /></div>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEMO.map((u) => (
            <button key={u.handle} onClick={() => go(u.handle)} disabled={busy} className="card flex items-center gap-2.5 p-3 text-left transition hover:border-accent">
              <Avatar user={{ ...u, hue: hueFromHandle(u.handle) }} size={32} />
              <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-semibold">{u.name.split(" ")[0]}</span><span className="block text-xs text-muted">@{u.handle}</span></span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 px-2 text-center text-xs text-muted">Сессия — подписанная HMAC cookie. Мы сознательно отказались от паролей: это учебный проект, а барьер входа должен быть нулевым.</p>
    </div>
  );
}
