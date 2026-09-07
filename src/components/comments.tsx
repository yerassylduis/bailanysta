"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, Sparkles, Heart, Reply, X } from "lucide-react";
import { useAddComment, useComments, useLikeComment, useMe, useMuse } from "@/hooks/use-data";
import { COMMENT_MAX } from "@/lib/text";
import { cn, timeAgo } from "@/lib/format";
import type { CommentDto } from "@/lib/types";
import { Avatar, Skeleton } from "./ui";
import { RichText } from "./rich-text";
import { useToast } from "./toast";
import { useT } from "./locale-provider";

/**
 * Комментарии к посту: ветки (ответ на комментарий — один уровень вложенности),
 * лайки комментариев, форма с подсказкой ответа от Cosmos.
 */
export function Comments({ postId, postText }: { postId: string; postText: string }) {
  const { data: me } = useMe();
  const q = useComments(postId);
  const add = useAddComment(postId);
  const like = useLikeComment(postId);
  const muse = useMuse();
  const toast = useToast();
  const { t } = useT();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentDto | null>(null);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    try {
      await add.mutateAsync({ text: body, parentId: replyTo?.id });
      setText(""); setReplyTo(null);
    } catch (e) { toast(e instanceof Error ? e.message : t("posts.error"), "error"); }
  };

  const onLike = (c: CommentDto) => {
    if (!me?.user) return toast(t("posts.loginToLike"));
    like.mutate({ id: c.id, liked: !c.likedByViewer }, { onError: (e) => toast(e.message, "error") });
  };
  const onReply = (c: CommentDto) => {
    if (!me?.user) return toast(t("posts.loginToReply"));
    setReplyTo(c);
    if (!text.startsWith(`@${c.author.handle}`)) setText(`@${c.author.handle} `);
    document.getElementById("comment-input")?.focus();
  };

  // Дерево: корневые комментарии и ответы под ними (ответы на ответы — тоже под корнем, по порядку времени).
  const items = q.data?.items ?? [];
  const byId = new Map(items.map((c) => [c.id, c]));
  const rootOf = (c: CommentDto): string => { let cur = c; let guard = 0; while (cur.parentId && byId.has(cur.parentId) && guard++ < 20) cur = byId.get(cur.parentId)!; return cur.id; };
  const roots = items.filter((c) => !c.parentId || !byId.has(c.parentId));
  const replies = new Map<string, CommentDto[]>();
  for (const c of items) if (c.parentId && byId.has(c.parentId)) { const r = rootOf(c); replies.set(r, [...(replies.get(r) ?? []), c]); }

  return (
    <section id="comments" className="card p-5">
      <h2 className="font-display text-base font-bold">{t("posts.commentsTitle")} {q.data ? <span className="text-muted">· {items.length}</span> : null}</h2>

      {me?.user ? (
        <div className="mt-4 flex gap-3">
          <Avatar user={me.user} size={34} />
          <div className="flex-1">
            {replyTo && (
              <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-accent-soft px-2.5 py-1 text-xs">
                <Reply size={12} className="text-accent" /> {t("posts.replyFor")} <b>{replyTo.author.name}</b>: <span className="truncate text-muted">{replyTo.text.slice(0, 50)}</span>
                <button onClick={() => { setReplyTo(null); setText(""); }} className="ml-auto flex h-5 w-5 items-center justify-center rounded-full hover:bg-bg-2" aria-label={t("posts.cancelReply")}><X size={12} /></button>
              </div>
            )}
            <textarea id="comment-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={COMMENT_MAX} rows={2}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); if (e.key === "Escape" && replyTo) { setReplyTo(null); setText(""); } }}
              placeholder={replyTo ? t("posts.replyPlaceholder") : t("posts.commentPlaceholder")} className="input resize-none" />
            {muse.data && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {muse.data.variants.map((v, i) => <button key={i} onClick={() => setText((replyTo ? `@${replyTo.author.handle} ` : "") + v)} className="chip text-left normal-case">{v}</button>)}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => muse.mutate({ mode: "reply", text: replyTo ? replyTo.text : postText })} disabled={muse.isPending} className="btn btn-ghost px-3 py-1.5 text-xs text-saffron">
                <Sparkles size={14} /> {muse.isPending ? t("posts.cosmosThinking") : t("posts.suggestReply")}
              </button>
              <span className="ml-auto text-xs text-muted">{COMMENT_MAX - text.length}</span>
              <button onClick={submit} disabled={!text.trim() || add.isPending} className="btn btn-primary px-3 py-1.5 text-xs"><Send size={14} /> {t("common.send")}</button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("posts.loginToComment.before")}<Link href="/login" className="link-tag">{t("posts.loginToComment.link")}</Link>{t("posts.loginToComment.after")}</p>
      )}

      <ul className="mt-5 space-y-4">
        {q.isPending && [0, 1].map((i) => <li key={i} className="flex gap-3"><Skeleton className="h-8 w-8 rounded-full!" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-full" /></div></li>)}
        {roots.map((c) => (
          <li key={c.id}>
            <ul className="space-y-3">
              <CommentItem c={c} byId={byId} rootId={c.id} onLike={onLike} onReply={onReply} />
              {(replies.get(c.id) ?? []).map((r) => <CommentItem key={r.id} c={r} isReply byId={byId} rootId={c.id} onLike={onLike} onReply={onReply} />)}
            </ul>
          </li>
        ))}
        {q.data && !items.length && <li className="text-sm text-muted">{t("posts.noComments")}</li>}
      </ul>
    </section>
  );
}

/**
 * Один комментарий. Вынесен из Comments намеренно: компонент, объявленный внутри рендера,
 * пересоздаётся на каждом нажатии клавиши в форме — список моргал и «прыгал».
 */
function CommentItem({ c, isReply, byId, rootId, onLike, onReply }: {
  c: CommentDto; isReply?: boolean; byId: Map<string, CommentDto>; rootId: string;
  onLike: (c: CommentDto) => void; onReply: (c: CommentDto) => void;
}) {
  const { t, locale } = useT();
  const parent = c.parentId ? byId.get(c.parentId) : undefined;
  return (
    <li className={cn("flex gap-3", isReply && "ml-6 border-l-2 border-line pl-3 sm:ml-10")}>
      <Link href={`/u/${c.author.handle}`}><Avatar user={c.author} size={isReply ? 28 : 32} /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <Link href={`/u/${c.author.handle}`} className="font-semibold hover:underline">{c.author.name}</Link>
          <span className="text-xs text-muted">@{c.author.handle} · {timeAgo(c.createdAt, locale)}</span>
          {isReply && parent && parent.id !== rootId && <span className="text-xs text-muted">· {t("posts.inReplyTo", { handle: parent.author.handle })}</span>}
        </div>
        <RichText text={c.text} className="mt-0.5 text-[15px] leading-relaxed" />
        <div className="mt-1 flex items-center gap-1 text-xs">
          <button onClick={() => onLike(c)} aria-pressed={c.likedByViewer} className={cn("btn btn-ghost gap-1 px-2 py-1 text-xs", c.likedByViewer ? "text-rose" : "hover:text-rose")}>
            <Heart size={14} fill={c.likedByViewer ? "currentColor" : "none"} /> <span className="tabular-nums">{c.likeCount || ""}</span>
          </button>
          <button onClick={() => onReply(c)} className="btn btn-ghost gap-1 px-2 py-1 text-xs hover:text-accent"><Reply size={14} /> {t("posts.reply")}</button>
        </div>
      </div>
    </li>
  );
}
