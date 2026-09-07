"use client";

import { useState } from "react";
import { Sparkles, Wand2, Hash, Languages, PenLine, X, Image as ImageIcon } from "lucide-react";
import { useMuse } from "@/hooks/use-data";
import type { MuseMode } from "@/lib/types";
import { cn } from "@/lib/format";
import { Skeleton } from "./ui";
import { useT } from "./locale-provider";

/** Режимы Cosmos; название — `muse.mode.<id>`, подсказка без текста — `muse.needs.<id>`. */
const MODES: Array<{ id: MuseMode; icon: React.ReactNode }> = [
  { id: "draft", icon: <PenLine size={14} /> },
  { id: "polish", icon: <Wand2 size={14} /> },
  { id: "hashtags", icon: <Hash size={14} /> },
  { id: "translate", icon: <Languages size={14} /> },
  { id: "caption", icon: <ImageIcon size={14} /> },
];

/** Панель Cosmos внутри редактора: режимы, варианты, вставка одним кликом. */
export function MusePanel({ text, onPick, onClose, hasMedia }: { text: string; onPick: (v: string) => void; onClose: () => void; hasMedia?: boolean }) {
  const [mode, setMode] = useState<MuseMode>(hasMedia ? "caption" : "draft");
  const [lang, setLang] = useState<"kk" | "ru" | "en">("kk");
  const muse = useMuse();
  const { t } = useT();
  const ready = text.trim().length > 0;

  const run = () => { if (ready) muse.mutate({ mode, text: text.trim(), lang: mode === "translate" ? lang : undefined }); };

  return (
    <div className="fade-in mt-3 rounded-xl border border-saffron/30 bg-saffron-soft/40 p-3">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-saffron" />
        <span className="text-sm font-semibold">Cosmos</span>
        <span className="text-xs text-muted">{t("muse.subtitle")}</span>
        <button onClick={onClose} className="btn btn-ghost ml-auto h-7 w-7 p-0" aria-label={t("common.close")}><X size={14} /></button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} className={cn("chip", mode === m.id && "chip-active")}>{m.icon}{t(`muse.mode.${m.id}`)}</button>
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
          {muse.isPending ? t("muse.thinking") : t("muse.suggest")}
        </button>
        {!ready && <span className="text-xs text-muted">{t(`muse.needs.${mode}`)}</span>}
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
            {muse.data.source === "claude" ? t("muse.byClaude") : t("muse.offline", { note: muse.data.note })}
          </p>
        </div>
      )}
    </div>
  );
}
