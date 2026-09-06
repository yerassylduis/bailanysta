"use client";

import { useState } from "react";
import { Sparkles, Wand2, Hash, Languages, PenLine, X, Image as ImageIcon } from "lucide-react";
import { useMuse } from "@/hooks/use-data";
import type { MuseMode } from "@/lib/types";
import { cn } from "@/lib/format";
import { Skeleton } from "./ui";

const MODES: Array<{ id: MuseMode; label: string; icon: React.ReactNode; needsText: string }> = [
  { id: "draft", label: "Набросок → пост", icon: <PenLine size={14} />, needsText: "Напишите тему или пару слов — Муза развернёт их в пост." },
  { id: "polish", label: "Отполировать", icon: <Wand2 size={14} />, needsText: "Вставьте текст, который хотите улучшить." },
  { id: "hashtags", label: "Хэштеги", icon: <Hash size={14} />, needsText: "Нужен текст поста, чтобы подобрать теги." },
  { id: "translate", label: "Перевести", icon: <Languages size={14} />, needsText: "Нужен текст для перевода." },
  { id: "caption", label: "Подпись к медиа", icon: <ImageIcon size={14} />, needsText: "Опишите фото или видео парой слов — Муза придумает подпись." },
];

/** Панель Музы внутри редактора: режимы, варианты, вставка одним кликом. */
export function MusePanel({ text, onPick, onClose, hasMedia }: { text: string; onPick: (v: string) => void; onClose: () => void; hasMedia?: boolean }) {
  const [mode, setMode] = useState<MuseMode>(hasMedia ? "caption" : "draft");
  const [lang, setLang] = useState<"kk" | "ru" | "en">("kk");
  const muse = useMuse();
  const ready = text.trim().length > 0;

  const run = () => { if (ready) muse.mutate({ mode, text: text.trim(), lang: mode === "translate" ? lang : undefined }); };

  return (
    <div className="fade-in mt-3 rounded-xl border border-saffron/30 bg-saffron-soft/40 p-3">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-saffron" />
        <span className="text-sm font-semibold">Муза</span>
        <span className="text-xs text-muted">· ИИ-соавтор</span>
        <button onClick={onClose} className="btn btn-ghost ml-auto h-7 w-7 p-0" aria-label="Закрыть"><X size={14} /></button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} className={cn("chip", mode === m.id && "chip-active")}>{m.icon}{m.label}</button>
        ))}
        {mode === "translate" && (
          <div className="ml-1 flex gap-1">
            {(["kk", "ru", "en"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={cn("chip uppercase", lang === l && "chip-active")}>{l}</button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button onClick={run} disabled={!ready || muse.isPending} className="btn btn-primary px-3 py-1.5 text-xs" style={{ background: "var(--saffron)", color: "#1d1a16" }}>
          {muse.isPending ? "Муза думает…" : "Предложить варианты"}
        </button>
        {!ready && <span className="text-xs text-muted">{MODES.find((m) => m.id === mode)?.needsText}</span>}
      </div>

      {muse.isPending && <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
      {muse.isError && <p className="mt-3 text-xs text-rose">{muse.error.message}</p>}
      {muse.data && (
        <div className="mt-3 space-y-2">
          {muse.data.variants.map((v, i) => (
            <button key={i} onClick={() => onPick(mode === "hashtags" ? `${text.trim()} ${v}`.trim() : v)}
              className="block w-full rounded-lg border border-line bg-elev p-3 text-left text-sm leading-relaxed transition hover:border-saffron">
              {v}
            </button>
          ))}
          <p className="text-[11px] text-muted">
            {muse.data.source === "claude" ? "Сгенерировано Claude · вызов идёт с сервера" : `Офлайн-режим · ${muse.data.note}. Чтобы включить настоящий ИИ, добавьте ANTHROPIC_API_KEY в .env.local и перезапустите сервер.`}
          </p>
        </div>
      )}
    </div>
  );
}
