"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Send, X, CalendarHeart } from "lucide-react";
import { MOODS, POST_MAX, type MoodId } from "@/lib/text";
import { cn } from "@/lib/format";
import { dailyTopic } from "@/lib/daily";
import { useCreatePost, useMe, useUpdatePost } from "@/hooks/use-data";
import { useUpload } from "@/hooks/use-upload";
import type { PostDto } from "@/lib/types";
import { Avatar } from "./ui";
import { MusePanel } from "./muse-panel";
import { AttachButton, AttachmentPreviews } from "./media";
import { useToast } from "./toast";

/**
 * Редактор поста: создание и правка. Текст, настроение, до 4 фото или 1 видео, Cosmos, тема дня.
 * Отправка — ⌘/Ctrl+Enter, вставка файлов — из буфера обмена или перетаскиванием.
 */
export function PostEditor({ post, onDone, autoFocus }: { post?: PostDto; onDone?: () => void; autoFocus?: boolean }) {
  const { data } = useMe();
  const me = data?.user;
  const [text, setText] = useState(post?.text ?? "");
  const [mood, setMood] = useState<MoodId | null>((post?.mood as MoodId) ?? null);
  const [muse, setMuse] = useState(false);
  const [drag, setDrag] = useState(false);
  const upload = useUpload();
  const create = useCreatePost();
  const update = useUpdatePost();
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const busy = create.isPending || update.isPending;
  const left = POST_MAX - text.length;
  const topic = dailyTopic();

  // При правке подтягиваем уже прикреплённые медиа как «загруженные».
  useEffect(() => {
    if (post?.media.length) {
      upload.setItems(post.media.map((m) => ({ localId: m.id, kind: m.kind, preview: m.url, progress: 1, media: m, error: null })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.max(el.scrollHeight, 56) + "px";
  }, [text]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const hasContent = text.trim().length > 0 || upload.mediaIds.length > 0;
  const canSubmit = hasContent && left >= 0 && !busy && !upload.uploading;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      if (post) {
        await update.mutateAsync({ id: post.id, text: text.trim(), mood, mediaIds: upload.mediaIds });
        toast("Пост обновлён", "success");
      } else {
        await create.mutateAsync({ text: text.trim(), mood, mediaIds: upload.mediaIds });
        setText(""); setMood(null); setMuse(false); upload.reset();
        toast("Опубликовано ✨", "success");
      }
      onDone?.();
    } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "error"); }
  };

  if (!me) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">Войдите, чтобы писать посты и общаться.</p>
        <Link href="/login" className="btn btn-primary">Войти по нику</Link>
      </div>
    );
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length) { e.preventDefault(); upload.add(files); }
  };

  return (
    <div
      className={cn(!post && "card p-4", drag && "ring-2 ring-accent")}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) upload.add(e.dataTransfer.files); }}
    >
      <div className="flex gap-3">
        {!post && <Avatar user={me} size={42} className="hidden sm:flex" />}
        <div className="min-w-0 flex-1">
          <textarea
            ref={ref} value={text} onChange={(e) => setText(e.target.value)} onPaste={onPaste}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); if (e.key === "Escape" && post) onDone?.(); }}
            placeholder={post ? "" : "Что нового в степи? #теги, @упоминания, фото или видео…"}
            className="w-full resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-muted"
            rows={2} maxLength={POST_MAX + 50}
          />
          <AttachmentPreviews items={upload.items} onRemove={upload.remove} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {MOODS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMood(mood === m.id ? null : m.id)}
                className={cn("chip", mood === m.id && "chip-active")} title={m.hint}>{m.emoji} {m.label}</button>
            ))}
          </div>
          {!post && !text && (
            <button type="button" onClick={() => { setText(`${topic.q} #${topic.tag} `); ref.current?.focus(); }}
              className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-saffron/50 bg-saffron-soft/50 px-3 py-2 text-left text-xs text-ink-2 transition hover:border-saffron">
              <CalendarHeart size={14} className="shrink-0 text-saffron" /><span><b>Тема дня:</b> {topic.q} <span className="text-saffron">#{topic.tag}</span></span>
            </button>
          )}
        </div>
      </div>

      {muse && <MusePanel text={text} hasMedia={upload.items.length > 0} onPick={(v) => { setText(v); setMuse(false); ref.current?.focus(); }} onClose={() => setMuse(false)} />}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
        <AttachButton onFiles={upload.add} disabled={busy} />
        <button type="button" onClick={() => setMuse((m) => !m)} className={cn("btn btn-ghost gap-1.5 px-3 text-saffron", muse && "bg-saffron-soft")} title="Cosmos — ИИ-соавтор">
          <Sparkles size={17} /><span className="hidden sm:inline">Cosmos</span>
        </button>
        <span className={cn("ml-auto text-xs tabular-nums", left < 0 ? "font-semibold text-rose" : left < 40 ? "text-saffron" : "text-muted")}>{left}</span>
        {post && <button type="button" onClick={onDone} className="btn btn-ghost px-3"><X size={16} /> Отмена</button>}
        <button type="button" onClick={submit} disabled={!canSubmit} className="btn btn-primary">
          {busy || upload.uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send size={16} />}
          {upload.uploading ? "Загрузка…" : post ? "Сохранить" : "Опубликовать"}
        </button>
      </div>
    </div>
  );
}
