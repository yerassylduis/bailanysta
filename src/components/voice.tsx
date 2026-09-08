"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, X, Play, Pause } from "lucide-react";
import { cn } from "@/lib/format";
import type { MediaDto } from "@/lib/types";
import { useT } from "./locale-provider";

/**
 * Голосовые сообщения: запись через MediaRecorder (Opus в WebM, в Safari — AAC в MP4) и плеер
 * с полосой прогресса и скоростью 1× / 1,5× / 2× (выбор запоминается в браузере).
 */
const SPEED_KEY = "bl_voice_speed";
const SPEEDS = [1, 1.5, 2] as const;
const SPEED_EVENT = "bl-voice-speed";
function readSpeed() { try { const v = Number(localStorage.getItem(SPEED_KEY)); return (SPEEDS as readonly number[]).includes(v) ? v : 1; } catch { return 1; } }
function subscribeSpeed(cb: () => void) { window.addEventListener(SPEED_EVENT, cb); return () => window.removeEventListener(SPEED_EVENT, cb); }
function setSpeed(v: number) { try { localStorage.setItem(SPEED_KEY, String(v)); } catch {} window.dispatchEvent(new Event(SPEED_EVENT)); }

export function pickAudioMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}

/** Обёртка над performance.now(): вызывается только в обработчиках, но компилятор React строг к «нечистым» вызовам в теле компонента. */
const nowMs = () => performance.now();

export const fmtClock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** Кнопка микрофона: нажатие начинает запись, повторное — останавливает и отдаёт blob наверх. */
export function VoiceRecorder({ onRecorded, disabled, maxMs = 5 * 60_000 }: { onRecorded: (blob: Blob, durationMs: number) => Promise<void> | void; disabled?: boolean; maxMs?: number }) {
  const { t } = useT();
  const [state, setState] = useState<"idle" | "recording" | "sending">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; start: number; timer: number; ctx?: AudioContext; raf: number; cancelled: boolean } | null>(null);

  useEffect(() => () => { const r = rec.current; if (r) { r.cancelled = true; try { r.mr.stop(); } catch {} r.stream.getTracks().forEach((x) => x.stop()); clearInterval(r.timer); cancelAnimationFrame(r.raf); r.ctx?.close().catch(() => {}); } }, []);

  const start = async () => {
    setErr(null);
    const mime = pickAudioMime();
    if (!mime) { setErr(t("emoji.noRecorder")); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setErr(t("emoji.micDenied")); return; }
    const mr = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 48_000 });
    const r: NonNullable<typeof rec.current> = { mr, stream, chunks: [], start: nowMs(), timer: 0, raf: 0, cancelled: false };
    rec.current = r;
    mr.ondataavailable = (e) => { if (e.data.size) r.chunks.push(e.data); };
    mr.onstop = async () => {
      clearInterval(r.timer); cancelAnimationFrame(r.raf);
      stream.getTracks().forEach((x) => x.stop()); r.ctx?.close().catch(() => {});
      rec.current = null;
      const duration = nowMs() - r.start;
      if (r.cancelled || duration < 400 || !r.chunks.length) { setState("idle"); setElapsed(0); return; }
      setState("sending");
      try { await onRecorded(new Blob(r.chunks, { type: mime.split(";")[0] }), Math.round(duration)); } finally { setState("idle"); setElapsed(0); }
    };
    // индикатор громкости
    try {
      const ctx = new AudioContext(); r.ctx = ctx;
      const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => { an.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) { const d = (v - 128) / 128; sum += d * d; } setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3)); r.raf = requestAnimationFrame(tick); };
      r.raf = requestAnimationFrame(tick);
    } catch {}
    r.timer = window.setInterval(() => { const e = nowMs() - r.start; setElapsed(e); if (e >= maxMs) stop(); }, 200);
    mr.start(250);
    setState("recording");
  };
  const stop = () => { const r = rec.current; if (r && r.mr.state !== "inactive") r.mr.stop(); };
  const cancel = () => { const r = rec.current; if (r) { r.cancelled = true; stop(); } };

  if (state === "recording") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-rose-soft px-2.5 py-1.5" role="status" aria-live="polite">
        <span className="relative flex h-3 w-3 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-rose" /></span>
        <span className="text-xs font-semibold text-rose">{t("emoji.recording")}</span>
        <span className="font-mono text-xs tabular-nums text-ink-2">{fmtClock(elapsed)}</span>
        <span className="mx-1 flex h-4 flex-1 items-end gap-0.5 overflow-hidden" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => <span key={i} className="w-1 rounded-sm bg-rose/70 transition-[height] duration-100" style={{ height: `${Math.max(15, Math.min(100, level * 100 * (0.5 + Math.sin(i * 1.3 + elapsed / 120) * 0.5 + 0.5)))}%` }} />)}
        </span>
        <button type="button" onClick={cancel} className="btn btn-ghost btn-icon h-8 w-8 shrink-0" title={t("emoji.cancelRecording")} aria-label={t("emoji.cancelRecording")}><X size={16} /></button>
        <button type="button" onClick={stop} className="btn btn-primary btn-icon h-8 w-8 shrink-0" title={t("emoji.stopAndSend")} aria-label={t("emoji.stopAndSend")}><Square size={14} /></button>
      </div>
    );
  }
  return (
    <div className="relative shrink-0">
      <button type="button" onClick={start} disabled={disabled || state === "sending"} className={cn("btn btn-ghost btn-icon text-accent", state === "sending" && "animate-pulse")} title={t("emoji.voice")} aria-label={t("emoji.voice")}>
        <Mic size={20} />
      </button>
      {err && <span className="absolute bottom-full left-0 mb-1 whitespace-nowrap rounded-lg bg-rose px-2 py-1 text-[11px] text-white" role="alert">{err}</span>}
    </div>
  );
}

/** Псевдо-волна: детерминированные высоты столбиков из id — одинаковая у отправителя и получателя. */
function waveBars(seed: string, n = 36): number[] {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const out: number[] = [];
  for (let i = 0; i < n; i++) { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; const v = ((h >>> 0) % 1000) / 1000; out.push(0.25 + 0.75 * (0.5 + 0.5 * Math.sin(i / 3.1)) * (0.4 + 0.6 * v)); }
  return out;
}

/**
 * Плеер голосового — самостоятельная карточка в контрастных цветах (не наследует цвет пузыря):
 * шафрановая кнопка, волна с заливкой прогресса, длительность и скорость 1×/1,5×/2×.
 */
export function AudioMessage({ media }: { media: MediaDto; mine?: boolean }) {
  const { t } = useT();
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState((media.durationMs ?? 0) / 1000);
  const speed = useSyncExternalStore(subscribeSpeed, readSpeed, () => 1);
  const bars = waveBars(media.id);

  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed]);

  const toggle = () => { const a = ref.current; if (!a) return; if (a.paused) { a.playbackRate = speed; a.play().catch(() => {}); } else a.pause(); };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => { const a = ref.current; if (!a || !dur) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur; };
  const cycle = () => setSpeed(SPEEDS[(SPEEDS.indexOf(speed as typeof SPEEDS[number]) + 1) % SPEEDS.length]);
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div className="flex w-[280px] max-w-full items-center gap-3 rounded-2xl border border-line bg-elev px-3 py-2.5 text-ink shadow-sm" data-testid="voice-message">
      <audio ref={ref} src={media.url} preload="metadata"
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDur(d); }}
        onDurationChange={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDur(d); }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPos(0); }} />
      <button type="button" onClick={toggle} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-saffron text-[#1a1a1a] shadow-card transition hover:brightness-105 active:scale-95" aria-label={playing ? t("emoji.pause") : t("emoji.play")}>
        {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="relative flex h-8 w-full cursor-pointer items-center gap-[2px]" onClick={seek} role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t("emoji.voice")}>
          {bars.map((b, i) => {
            const on = (i / bars.length) * 100 < pct;
            return <span key={i} className={cn("flex-1 rounded-full transition-colors", on ? "bg-accent" : "bg-line-strong")} style={{ height: `${Math.round(b * 100)}%`, minWidth: 2 }} />;
          })}
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-muted">
          <span className="font-semibold text-ink-2">{fmtClock((playing || pos > 0 ? pos : dur) * 1000)}</span>
          <button type="button" onClick={cycle} className="rounded-md bg-accent-soft px-2 py-0.5 font-bold text-accent" title={t("emoji.speed")}>{speed === 1 ? "1×" : speed === 1.5 ? "1,5×" : "2×"}</button>
        </div>
      </div>
    </div>
  );
}
