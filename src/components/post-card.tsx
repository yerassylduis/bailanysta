"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, MessageCircle, MoreHorizontal, Pencil, Trash2, Share2 } from "lucide-react";
import type { PostDto } from "@/lib/types";
import { moodById } from "@/lib/text";
import { cn, timeAgo } from "@/lib/format";
import { useDeletePost, useMe, useToggleLike } from "@/hooks/use-data";
import { useRouter } from "next/navigation";
import { Avatar } from "./ui";
import { RichText } from "./rich-text";
import { PostEditor } from "./post-editor";
import { useToast } from "./toast";

const MOOD_COLOR: Record<string, string> = { zhalyn: "var(--rose)", tynysh: "var(--accent)", idea: "var(--saffron)", oi: "#8b7cf6" };

/**
 * Карточка поста. Цветная полоска слева — настроение поста.
 * Лайк — оптимистичный; редактирование — прямо в карточке.
 */
export function PostCard({ post, detail }: { post: PostDto; detail?: boolean }) {
  const { data } = useMe();
  const me = data?.user;
  const like = useToggleLike();
  const del = useDeletePost();
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pop, setPop] = useState(false);
  const mood = moodById(post.mood);
  const own = me?.id === post.author.id;

  const onLike = () => {
    if (!me) return toast("Войдите, чтобы ставить лайки");
    if (!post.likedByViewer) { setPop(true); setTimeout(() => setPop(false), 400); }
    like.mutate({ id: post.id, liked: !post.likedByViewer });
  };

  const onDelete = async () => {
    setMenu(false);
    if (!confirm("Удалить пост? Это действие нельзя отменить.")) return;
    try {
      await del.mutateAsync(post.id);
      toast("Пост удалён", "success");
      if (detail) router.push("/");
    } catch (e) { toast(e instanceof Error ? e.message : "Не удалось удалить", "error"); }
  };

  const share = async () => {
    const url = `${location.origin}/post/${post.id}`;
    try { await navigator.clipboard.writeText(url); toast("Ссылка скопирована", "success"); } catch { toast(url); }
  };

  return (
    <article className={cn("card fade-in relative overflow-hidden p-5", !detail && "transition hover:border-line-strong")}>
      {mood && <span className="absolute inset-y-0 left-0 w-1" style={{ background: MOOD_COLOR[mood.id] }} aria-hidden />}
      <header className="flex items-start gap-3">
        <Link href={`/u/${post.author.handle}`}><Avatar user={post.author} size={42} /></Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link href={`/u/${post.author.handle}`} className="truncate font-semibold hover:underline">{post.author.name}</Link>
            <span className="truncate text-sm text-muted">@{post.author.handle}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <Link href={`/post/${post.id}`} className="hover:underline" title={new Date(post.createdAt).toLocaleString("ru-RU")}>{timeAgo(post.createdAt)}</Link>
            {post.editedAt && <span>· изменено</span>}
            {mood && <span className="chip py-0.5 text-[11px]" style={{ color: MOOD_COLOR[mood.id] }}>{mood.emoji} {mood.label}</span>}
          </div>
        </div>
        {own && (
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="btn btn-ghost h-8 w-8 p-0" aria-label="Действия"><MoreHorizontal size={18} /></button>
            {menu && (
              <div className="card absolute right-0 top-9 z-10 w-44 p-1.5 text-sm" onMouseLeave={() => setMenu(false)}>
                <button onClick={() => { setEditing(true); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-bg-2"><Pencil size={15} /> Редактировать</button>
                <button onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-rose hover:bg-rose-soft"><Trash2 size={15} /> Удалить</button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="mt-3.5">
        {editing ? (
          <PostEditor post={post} onDone={() => setEditing(false)} />
        ) : detail ? (
          <RichText text={post.text} className="text-[17px] leading-relaxed" />
        ) : (
          /* div, а не Link: внутри текста уже есть ссылки на #теги и @людей, а <a> в <a> запрещён */
          <div role="link" tabIndex={0} className="cursor-pointer"
            onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) router.push(`/post/${post.id}`); }}
            onKeyDown={(e) => { if (e.key === "Enter") router.push(`/post/${post.id}`); }}>
            <RichText text={post.text} className="text-[15.5px] leading-relaxed" />
          </div>
        )}
      </div>

      <footer className="mt-4 flex items-center gap-1 text-sm">
        <button onClick={onLike} aria-pressed={post.likedByViewer}
          className={cn("btn btn-ghost gap-1.5 px-3 py-1.5", post.likedByViewer ? "text-rose" : "hover:text-rose")}>
          <Heart size={18} className={cn(pop && "like-pop")} fill={post.likedByViewer ? "currentColor" : "none"} />
          <span className="tabular-nums">{post.likeCount || ""}</span>
        </button>
        <Link href={`/post/${post.id}#comments`} className="btn btn-ghost gap-1.5 px-3 py-1.5 hover:text-accent">
          <MessageCircle size={18} /><span className="tabular-nums">{post.commentCount || ""}</span>
        </Link>
        <button onClick={share} className="btn btn-ghost ml-auto gap-1.5 px-3 py-1.5" aria-label="Поделиться"><Share2 size={17} /></button>
      </footer>
    </article>
  );
}
