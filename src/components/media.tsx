"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Play, ImagePlus, Film } from "lucide-react";
import type { MediaDto } from "@/lib/types";
import type { Attachment } from "@/hooks/use-upload";
import { cn } from "@/lib/format";

/* ------------------------------ Сетка медиа ------------------------------ */

/** 1 файл — во всю ширину с сохранением пропорций; 2 — пополам; 3 — 1 большой + 2; 4 — 2×2. */
export function MediaGrid({ media, className }: { media: MediaDto[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!media.length) return null;
  const n = media.length;

  const tile = (m: MediaDto, i: number, extra?: string) => (
    <button key={m.id} type="button" onClick={(e) => { e.stopPropagation(); if (m.kind === "image") setOpen(i); }}
      className={cn("relative block overflow-hidden bg-bg-2 focus:outline-none", extra)} aria-label={m.kind === "image" ? "Открыть фото" : "Видео"}>
      {m.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" />
      ) : (
        <VideoPlayer media={m} />
      )}
    </button>
  );

  if (n === 1) {
    const m = media[0];
    const ratio = m.width && m.height ? Math.min(Math.max(m.width / m.height, 0.6), 2) : 16 / 10;
    return (
      <div className={cn("overflow-hidden rounded-xl border border-line", className)} style={{ aspectRatio: String(ratio) }}>
        {tile(m, 0, "h-full w-full")}
        {open !== null && <Lightbox media={media} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-1 overflow-hidden rounded-xl border border-line", n === 3 ? "grid-cols-2 grid-rows-2" : "grid-cols-2", className)} style={{ aspectRatio: n === 2 ? "2 / 1.1" : "1 / 0.9" }}>
      {media.slice(0, 4).map((m, i) => tile(m, i, n === 3 && i === 0 ? "row-span-2 h-full" : "h-full"))}
      {open !== null && <Lightbox media={media} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </div>
  );
}

export function VideoPlayer({ media, autoPlayOnClick = true }: { media: MediaDto; autoPlayOnClick?: boolean }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative h-full w-full bg-black" onClick={(e) => e.stopPropagation()}>
      <video src={media.url} controls={playing} playsInline preload="metadata" className="h-full w-full object-contain"
        onPlay={() => setPlaying(true)} onClick={(e) => { if (!playing && autoPlayOnClick) { (e.currentTarget as HTMLVideoElement).play(); } }} />
      {!playing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow-lg"><Play size={24} fill="currentColor" className="ml-1" /></span>
        </span>
      )}
    </div>
  );
}

/* ------------------------------- Лайтбокс -------------------------------- */

export function Lightbox({ media, index, onClose, onIndex }: { media: MediaDto[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const images = media.filter((m) => m.kind === "image");
  const cur = images[Math.min(index, images.length - 1)];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [index, images.length, onClose, onIndex]);
  if (!cur) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }} role="dialog" aria-label="Просмотр фото">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cur.url} alt="" className="max-h-[92vh] max-w-[96vw] rounded-lg object-contain shadow-2xl fade-in" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30" aria-label="Закрыть"><X size={20} /></button>
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length); }} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30" aria-label="Назад"><ChevronLeft size={22} /></button>
          <button onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length); }} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30" aria-label="Вперёд"><ChevronRight size={22} /></button>
          <span className="absolute bottom-4 rounded-full bg-white/15 px-3 py-1 text-xs text-white">{index + 1} / {images.length}</span>
        </>
      )}
    </div>
  );
}

/* --------------------------- Вложения в редакторе -------------------------- */

export function AttachButton({ onFiles, disabled, accept = "image/*,video/*", className, label = "Фото или видео" }: { onFiles: (f: FileList) => void; disabled?: boolean; accept?: string; className?: string; label?: string }) {
  return (
    <label className={cn("btn btn-ghost cursor-pointer gap-1.5 px-3 text-accent", disabled && "pointer-events-none opacity-50", className)} title={label}>
      <ImagePlus size={18} /><span className="hidden sm:inline">{label}</span>
      <input type="file" accept={accept} multiple className="hidden" disabled={disabled} onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
    </label>
  );
}

export function AttachmentPreviews({ items, onRemove }: { items: Attachment[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div className={cn("mt-3 grid gap-2", items.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
      {items.map((a) => (
        <div key={a.localId} className={cn("relative overflow-hidden rounded-xl border border-line bg-bg-2", items.length === 1 ? "max-h-80" : "aspect-square")}>
          {a.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.preview} alt="" className={cn("h-full w-full object-cover", items.length === 1 && "max-h-80 object-contain")} />
          ) : (
            <div className="relative flex h-full min-h-48 w-full items-center justify-center bg-black">
              {/* видео можно посмотреть до публикации: controls + звук */}
              <video src={a.preview} className="max-h-80 w-full object-contain" controls playsInline preload="metadata" />
              <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white"><Film size={12} /> видео</span>
            </div>
          )}
          {!a.media && !a.error && (
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30"><div className="h-full bg-accent transition-all" style={{ width: `${Math.max(5, a.progress * 100)}%` }} /></div>
          )}
          {a.error && <div className="absolute inset-0 flex items-center justify-center bg-rose/80 p-2 text-center text-xs font-semibold text-white">{a.error}</div>}
          <button type="button" onClick={() => onRemove(a.localId)} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80" aria-label="Убрать"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
