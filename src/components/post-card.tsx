"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, MoreHorizontal, Pencil, Trash2, Share2, Repeat2, Quote, Bookmark, Link2, MessageSquareText } from "lucide-react";
import type { PostDto } from "@/lib/types";
import { moodById, POST_MAX } from "@/lib/text";
import { cn, fmtDateTime, timeAgo } from "@/lib/format";
import { useBookmark, useDeletePost, useMe, useRepost, useToggleLike, useUndoRepost } from "@/hooks/use-data";
import { Avatar } from "./ui";
import { RichText } from "./rich-text";
import { PostEditor } from "./post-editor";
import { MediaGrid } from "./media";
import { useToast } from "./toast";
import { useT } from "./locale-provider";

const MOOD_COLOR: Record<string, string> = { zhalyn: "var(--rose)", tynysh: "var(--accent)", idea: "var(--saffron)", oi: "var(--violet)" };

/**
 * Карточка поста. Полоска слева — настроение. Поддерживает медиа, репосты и цитаты,
 * оптимистичные лайки/закладки, правку прямо в карточке.
 */
export function PostCard({ post, detail }: { post: PostDto; detail?: boolean }) {
  const { data } = useMe();
  const me = data?.user;
  const like = useToggleLike();
  const del = useDeletePost();
  const repost = useRepost();
  const undo = useUndoRepost();
  const bookmark = useBookmark();
  const toast = useToast();
  const { t, locale } = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<"more" | "repost" | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [pop, setPop] = useState(false);

  // Чистый репост показываем как исходный пост с плашкой «X репостнул(а)».
  const shown = post.isRepost && post.repostOf ? post.repostOf : post;
  const mood = moodById(shown.mood);
  const own = me?.id === shown.author.id;
  const ownRepostRow = me?.id === post.author.id && post.isRepost;

  const need = (key: string) => { toast(t(key)); return false; };

  const onLike = () => {
    if (!me) return need("posts.loginToLike");
    if (!shown.likedByViewer) { setPop(true); setTimeout(() => setPop(false), 400); }
    like.mutate({ id: shown.id, liked: !shown.likedByViewer });
  };
  const onRepost = () => {
    if (!me) return need("posts.loginToRepost");
    setMenu(null);
    if (shown.repostedByViewer) undo.mutate(shown.id, { onSuccess: () => toast(t("posts.repostRemoved")) , onError: (e) => toast(e.message, "error") });
    else repost.mutate({ id: shown.id }, { onSuccess: () => toast(t("posts.reposted"), "success"), onError: (e) => toast(e.message, "error") });
  };
  const onBookmark = () => {
    if (!me) return need("posts.loginToBookmark");
    bookmark.mutate({ id: shown.id, on: !shown.bookmarkedByViewer }, { onSuccess: (r) => toast(r.bookmarkedByViewer ? t("posts.bookmarked") : t("posts.unbookmarked")) });
  };
  const onDelete = async () => {
    setMenu(null);
    if (!confirm(t("posts.deleteConfirm"))) return;
    try {
      await del.mutateAsync(ownRepostRow ? post.id : shown.id);
      toast(t("posts.deleted"), "success");
      if (detail) router.push("/");
    } catch (e) { toast(e instanceof Error ? e.message : t("posts.deleteFailed"), "error"); }
  };
  const share = async () => {
    const url = `${location.origin}/post/${shown.id}`;
    if (navigator.share) { try { await navigator.share({ title: t("posts.shareTitle", { name: shown.author.name }), text: shown.text.slice(0, 120), url }); return; } catch {} }
    try { await navigator.clipboard.writeText(url); toast(t("posts.linkCopied"), "success"); } catch { toast(url); }
  };
  const goTo = (e: React.MouseEvent) => { if (!detail && !(e.target as HTMLElement).closest("a,button,video")) router.push(`/post/${shown.id}`); };

  return (
    <article className={cn("card fade-in relative overflow-hidden p-4 sm:p-5", !detail && "transition hover:border-line-strong")}>
      {mood && <span className="absolute inset-y-0 left-0 w-1" style={{ background: MOOD_COLOR[mood.id] }} aria-hidden />}

      {post.isRepost && (
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Repeat2 size={14} className="text-accent" />
          <Link href={`/u/${post.author.handle}`} className="hover:underline">{me?.id === post.author.id ? t("posts.youReposted") : t("posts.repostedBy", { name: post.author.name })}</Link>
          <span>· {timeAgo(post.createdAt, locale)}</span>
        </p>
      )}

      <header className="flex items-start gap-3">
        <Link href={`/u/${shown.author.handle}`}><Avatar user={shown.author} size={42} /></Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link href={`/u/${shown.author.handle}`} className="truncate font-semibold hover:underline">{shown.author.name}</Link>
            <span className="truncate text-sm text-muted">@{shown.author.handle}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Link href={`/post/${shown.id}`} className="hover:underline" title={fmtDateTime(shown.createdAt, locale)}>{timeAgo(shown.createdAt, locale)}</Link>
            {shown.editedAt && <span>· {t("posts.edited")}</span>}
            {mood && <span className="chip py-0.5 text-[11px]" style={{ color: MOOD_COLOR[mood.id] }}>{mood.emoji} {t(`posts.mood.${mood.id}`)}</span>}
          </div>
        </div>
        {(own || ownRepostRow) && (
          <div className="relative">
            <button onClick={() => setMenu(menu === "more" ? null : "more")} className="btn btn-ghost btn-icon h-8 w-8" aria-label={t("posts.actions")}><MoreHorizontal size={18} /></button>
            {menu === "more" && (
              <div className="card absolute right-0 top-9 z-10 w-48 p-1.5 text-sm" onMouseLeave={() => setMenu(null)}>
                {own && <button onClick={() => { setEditing(true); setMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-bg-2"><Pencil size={15} /> {t("posts.editPost")}</button>}
                <button onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose hover:bg-rose-soft"><Trash2 size={15} /> {ownRepostRow ? t("posts.removeRepost") : t("common.delete")}</button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="mt-3 cursor-pointer" onClick={goTo}>
        {editing ? (
          <PostEditor post={shown} onDone={() => setEditing(false)} />
        ) : (
          <>
            {shown.text && <RichText text={shown.text} className={detail ? "text-[17px] leading-relaxed" : "text-[15.5px] leading-relaxed"} />}
            {shown.media.length > 0 && <MediaGrid media={shown.media} className="mt-3" />}
            {!post.isRepost && post.repostOf && <QuotedPost post={post.repostOf} />}
          </>
        )}
      </div>

      <footer className="mt-3 flex items-center gap-0.5 text-sm">
        <button onClick={onLike} aria-pressed={shown.likedByViewer} className={cn("btn btn-ghost gap-1.5 px-2.5 py-1.5", shown.likedByViewer ? "text-rose" : "hover:text-rose")}>
          <Heart size={18} className={cn(pop && "like-pop")} fill={shown.likedByViewer ? "currentColor" : "none"} />
          <span className="tabular-nums">{shown.likeCount || ""}</span>
        </button>
        <Link href={`/post/${shown.id}#comments`} className="btn btn-ghost gap-1.5 px-2.5 py-1.5 hover:text-accent">
          <MessageCircle size={18} /><span className="tabular-nums">{shown.commentCount || ""}</span>
        </Link>
        <div className="relative">
          <button onClick={() => (me ? setMenu(menu === "repost" ? null : "repost") : need("posts.loginToRepost"))} aria-pressed={shown.repostedByViewer}
            className={cn("btn btn-ghost gap-1.5 px-2.5 py-1.5", shown.repostedByViewer ? "text-accent" : "hover:text-accent")}>
            <Repeat2 size={18} /><span className="tabular-nums">{shown.repostCount || ""}</span>
          </button>
          {menu === "repost" && (
            <div className="card absolute bottom-10 left-0 z-10 w-48 p-1.5 text-sm" onMouseLeave={() => setMenu(null)}>
              <button onClick={onRepost} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-bg-2"><Repeat2 size={15} /> {shown.repostedByViewer ? t("posts.removeRepost") : t("posts.repost")}</button>
              <button onClick={() => { setMenu(null); setQuoting(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-bg-2"><Quote size={15} /> {t("posts.quote")}</button>
            </div>
          )}
        </div>
        <button onClick={onBookmark} aria-pressed={shown.bookmarkedByViewer} className={cn("btn btn-ghost btn-icon ml-auto h-9 w-9", shown.bookmarkedByViewer ? "text-saffron" : "hover:text-saffron")} aria-label={t("posts.bookmark")}>
          <Bookmark size={18} fill={shown.bookmarkedByViewer ? "currentColor" : "none"} />
        </button>
        <button onClick={share} className="btn btn-ghost btn-icon h-9 w-9" aria-label={t("posts.share")}><Share2 size={17} /></button>
      </footer>

      {quoting && <QuoteDialog post={shown} onClose={() => setQuoting(false)} />}
    </article>
  );
}

/** Встроенный исходник для цитаты. */
export function QuotedPost({ post }: { post: PostDto }) {
  const { locale } = useT();
  return (
    <Link href={`/post/${post.id}`} className="mt-3 block rounded-xl border border-line-strong bg-bg/60 p-3 transition hover:border-accent" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 text-xs">
        <Avatar user={post.author} size={20} />
        <span className="font-semibold">{post.author.name}</span>
        <span className="text-muted">@{post.author.handle} · {timeAgo(post.createdAt, locale)}</span>
      </div>
      {post.text && <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed" style={{ overflowWrap: "anywhere" }}>{post.text}</p>}
      {post.media.length > 0 && <MediaGrid media={post.media} className="mt-2 max-h-64" />}
    </Link>
  );
}

/** Плашка на месте удалённого исходника. */
export function DeletedQuote() {
  const { t } = useT();
  return <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-line-strong p-3 text-sm text-muted"><Link2 size={14} /> {t("posts.sourceDeleted")}</div>;
}

function QuoteDialog({ post, onClose }: { post: PostDto; onClose: () => void }) {
  const [text, setText] = useState("");
  const repost = useRepost();
  const toast = useToast();
  const { t } = useT();
  const left = POST_MAX - text.length;
  const submit = () => {
    if (!text.trim()) return;
    repost.mutate({ id: post.id, text: text.trim() }, {
      onSuccess: () => { toast(t("posts.quotePublished"), "success"); onClose(); },
      onError: (e) => toast(e.message, "error"),
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="card fade-in w-full max-w-lg rounded-b-none p-4 sm:rounded-b-xl2 sm:p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("posts.quote")}>
        <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-display text-base font-bold"><MessageSquareText size={18} className="text-accent" /> {t("posts.quote")}</h3><button onClick={onClose} className="btn btn-ghost btn-icon h-8 w-8"><span className="sr-only">{t("common.close")}</span>✕</button></div>
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={POST_MAX + 20}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
          placeholder={t("posts.quotePlaceholder")} className="input resize-none text-[15px]" />
        <QuotedPost post={post} />
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className={cn("text-xs tabular-nums", left < 0 ? "text-rose" : "text-muted")}>{left}</span>
          <button onClick={submit} disabled={!text.trim() || left < 0 || repost.isPending} className="btn btn-primary"><Quote size={15} /> {t("posts.publish")}</button>
        </div>
      </div>
    </div>
  );
}
