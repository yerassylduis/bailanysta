"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, FileSpreadsheet, FileArchive, File as FileIcon, Presentation, Loader2, X, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/format";
import type { MediaDto } from "@/lib/types";
import { useT } from "./locale-provider";

export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function iconFor(mime: string, name: string | null) {
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv" || ["xls", "xlsx", "csv"].includes(ext)) return { Icon: FileSpreadsheet, tone: "bg-[#e8f5ec] text-[#1f7a3a] dark:bg-[#1f7a3a]/25 dark:text-[#7fd49a]" };
  if (mime.includes("presentation") || mime.includes("powerpoint") || ["ppt", "pptx"].includes(ext)) return { Icon: Presentation, tone: "bg-[#fdebe3] text-[#c2410c] dark:bg-[#c2410c]/25 dark:text-[#fdba74]" };
  if (mime.includes("zip") || ext === "zip") return { Icon: FileArchive, tone: "bg-[#efeaff] text-[#6d28d9] dark:bg-[#6d28d9]/25 dark:text-[#c4b5fd]" };
  if (mime === "application/pdf" || ext === "pdf") return { Icon: FileText, tone: "bg-rose-soft text-rose" };
  if (mime.includes("word") || ["doc", "docx"].includes(ext)) return { Icon: FileText, tone: "bg-[#e6f0fb] text-[#1d4ed8] dark:bg-[#1d4ed8]/25 dark:text-[#93c5fd]" };
  return { Icon: FileIcon, tone: "bg-accent-soft text-accent" };
}

/** Документ в чате: иконка по типу, имя, размер, скачивание. */
export function FileCard({ media, compact }: { media: MediaDto; compact?: boolean }) {
  const { t } = useT();
  const { Icon, tone } = iconFor(media.mime, media.name);
  const name = media.name ?? `${t("emoji.file")}.${media.url.split(".").pop()}`;
  return (
    <a href={media.url} download={media.name ?? undefined} target="_blank" rel="noreferrer"
      className={cn("flex w-[280px] max-w-full items-center gap-3 rounded-2xl border border-line bg-elev px-3 py-2.5 text-ink shadow-sm transition hover:border-line-strong", compact && "w-full")} title={t("emoji.download")}>
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tone)}><Icon size={22} /></span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block text-[11px] text-muted">{(name.split(".").pop() ?? "").toUpperCase()} · {fmtBytes(media.size)}</span>
      </span>
      <Download size={16} className="shrink-0 text-muted" />
    </a>
  );
}

/** Пикер GIF (Tenor через наш сервер). Выбор → сервер скачивает GIF и отдаёт обычное медиа → onPick(media). */
export function GifPicker({ onPick, disabled }: { onPick: (m: MediaDto) => Promise<void> | void; disabled?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const id = setTimeout(() => setDebounced(q.trim()), 350); return () => clearTimeout(id); }, [q]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const gifs = useQuery({ queryKey: ["gifs", debounced], queryFn: () => api.gifs(debounced), enabled: open, staleTime: 60_000 });
  const pick = async (url: string, id: string) => {
    setSending(id);
    try { const m = await api.uploadFromUrl(url); await onPick(m); setOpen(false); } finally { setSending(null); }
  };
  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={disabled} className={cn("btn btn-ghost btn-icon shrink-0 text-[11px] font-extrabold tracking-wide", open ? "bg-accent-soft text-accent" : "text-accent")} title={t("emoji.gif")} aria-label={t("emoji.gif")} aria-expanded={open}>GIF</button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-line bg-elev p-2 shadow-lg" role="dialog" aria-label={t("emoji.gif")}>
          <div className="mb-2 flex items-center gap-1.5">
            <Search size={14} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("emoji.gifSearch")} className="input h-8 flex-1 text-sm" autoFocus />
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-icon h-8 w-8" aria-label={t("common.close")}><X size={14} /></button>
          </div>
          {gifs.data?.disabled ? <p className="p-3 text-xs text-muted">{t("emoji.gifUnavailable")}</p>
            : gifs.isPending ? <div className="grid h-40 place-items-center text-muted"><Loader2 size={18} className="animate-spin" /></div>
            : !gifs.data?.items.length ? <p className="p-3 text-center text-xs text-muted">{t("emoji.gifEmpty")}</p>
            : (
              <div className="grid max-h-72 grid-cols-3 gap-1 overflow-y-auto">
                {gifs.data.items.map((g) => (
                  <button key={g.id} type="button" onClick={() => pick(g.url, g.id)} disabled={!!sending} className="relative aspect-square overflow-hidden rounded-lg bg-bg-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.preview} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {sending === g.id && <span className="absolute inset-0 grid place-items-center bg-black/50 text-white"><Loader2 size={18} className="animate-spin" /></span>}
                  </button>
                ))}
              </div>
            )}
          {sending && <p className="mt-1 text-center text-[11px] text-muted">{t("emoji.gifSending")}</p>}
        </div>
      )}
    </div>
  );
}
