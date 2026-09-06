"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X } from "lucide-react";
import { MOODS, POST_MAX, type MoodId } from "@/lib/text";
import { cn } from "@/lib/format";
import { useCreatePost, useMe, useUpdatePost } from "@/hooks/use-data";
import type { PostDto } from "@/lib/types";
import { Avatar } from "./ui";
import { MusePanel } from "./muse-panel";
import { useToast } from "./toast";
import Link from "next/link";

/**
 * Редактор поста: и для создания, и для правки (если передан post).
 * Внутри — выбор настроения, счётчик, кнопка Музы. Отправка — ⌘/Ctrl+Enter.
 */
export function PostEditor({ post, onDone, autoFocus }: { post?: PostDto; onDone?: () => void; autoFocus?: boolean }) {
  const { data } = useMe();
  const me = data?.user;
  const [text, setText] = useState(post?.text ?? "");
  const [mood, setMood] = useState<MoodId | null>((post?.mood as MoodId) ?? null);
  const [muse, setMuse] = useState(false);
  const create = useCreatePost();
  const update = useUpdatePost();
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const busy = create.isPending || update.isPending;
  const left = POST_MAX - text.length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.max(el.scrollHeight, 56) + "px";
  }, [text]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const submit = async () => {
    const t = text.trim();
    if (!t || left < 0 || busy) return;
    try {
      if (post) {
        await update.mutateAsync({ id: post.id, text: t, mood });
        toast("Пост обновлён", "success");
      } else {
        await create.mutateAsync({ text: t, mood });
        setText(""); setMood(null); setMuse(false);
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

  return (
    <div className={cn(!post && "card p-4")}>
      <div className="flex gap-3">
        {!post && <Avatar user={me} size={42} />}
        <div className="min-w-0 flex-1">
          <textarea
            ref={ref} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); if (e.key === "Escape" && post) onDone?.(); }}
            placeholder={post ? "" : "Что нового в степи? Теги #так, упоминания @так…"}
            className="w-full resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-muted"
            rows={2} maxLength={POST_MAX + 50}
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {MOODS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMood(mood === m.id ? null : m.id)}
                className={cn("chip", mood === m.id && "chip-active")} title={m.hint}>{m.emoji} {m.label}</button>
            ))}
          </div>
        </div>
      </div>

      {muse && <MusePanel text={text} onPick={(v) => { setText(v); setMuse(false); ref.current?.focus(); }} onClose={() => setMuse(false)} />}

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <button type="button" onClick={() => setMuse((m) => !m)} className={cn("btn btn-ghost gap-1.5 px-3 text-saffron", muse && "bg-saffron-soft")} title="Муза — ИИ-соавтор">
          <Sparkles size={17} /> Муза
        </button>
        <span className={cn("ml-auto text-xs tabular-nums", left < 0 ? "text-rose font-semibold" : left < 40 ? "text-saffron" : "text-muted")}>{left}</span>
        {post && <button type="button" onClick={onDone} className="btn btn-ghost px-3"><X size={16} /> Отмена</button>}
        <button type="button" onClick={submit} disabled={!text.trim() || left < 0 || busy} className="btn btn-primary">
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send size={16} />}
          {post ? "Сохранить" : "Опубликовать"}
        </button>
      </div>
    </div>
  );
}
