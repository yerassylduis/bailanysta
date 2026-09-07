"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, Sparkles } from "lucide-react";
import { useAddComment, useComments, useMe, useMuse } from "@/hooks/use-data";
import { COMMENT_MAX } from "@/lib/text";
import { timeAgo } from "@/lib/format";
import { Avatar, Skeleton } from "./ui";
import { RichText } from "./rich-text";
import { useToast } from "./toast";

/** Комментарии к посту + форма. Cosmos умеет предложить варианты ответа. */
export function Comments({ postId, postText }: { postId: string; postText: string }) {
  const { data: me } = useMe();
  const q = useComments(postId);
  const add = useAddComment(postId);
  const muse = useMuse();
  const toast = useToast();
  const [text, setText] = useState("");

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    try { await add.mutateAsync(t); setText(""); } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "error"); }
  };

  return (
    <section id="comments" className="card p-5">
      <h2 className="font-display text-base font-bold">Комментарии {q.data ? <span className="text-muted">· {q.data.items.length}</span> : null}</h2>

      {me?.user ? (
        <div className="mt-4 flex gap-3">
          <Avatar user={me.user} size={34} />
          <div className="flex-1">
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={COMMENT_MAX} rows={2}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
              placeholder="Ответить…" className="input resize-none" />
            {muse.data && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {muse.data.variants.map((v, i) => <button key={i} onClick={() => setText(v)} className="chip text-left normal-case">{v}</button>)}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => muse.mutate({ mode: "reply", text: postText })} disabled={muse.isPending} className="btn btn-ghost px-3 py-1.5 text-xs text-saffron">
                <Sparkles size={14} /> {muse.isPending ? "Cosmos думает…" : "Подсказать ответ"}
              </button>
              <span className="ml-auto text-xs text-muted">{COMMENT_MAX - text.length}</span>
              <button onClick={submit} disabled={!text.trim() || add.isPending} className="btn btn-primary px-3 py-1.5 text-xs"><Send size={14} /> Отправить</button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted"><Link href="/login" className="link-tag">Войдите</Link>, чтобы комментировать.</p>
      )}

      <ul className="mt-5 space-y-4">
        {q.isPending && [0, 1].map((i) => <li key={i} className="flex gap-3"><Skeleton className="h-8 w-8 rounded-full!" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-full" /></div></li>)}
        {q.data?.items.map((c) => (
          <li key={c.id} className="fade-in flex gap-3">
            <Link href={`/u/${c.author.handle}`}><Avatar user={c.author} size={32} /></Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 text-sm">
                <Link href={`/u/${c.author.handle}`} className="font-semibold hover:underline">{c.author.name}</Link>
                <span className="text-xs text-muted">@{c.author.handle} · {timeAgo(c.createdAt)}</span>
              </div>
              <RichText text={c.text} className="mt-0.5 text-[15px] leading-relaxed" />
            </div>
          </li>
        ))}
        {q.data && !q.data.items.length && <li className="text-sm text-muted">Пока никто не ответил. Будьте первым.</li>}
      </ul>
    </section>
  );
}
