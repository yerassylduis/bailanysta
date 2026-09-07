"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Heart, MessageCircle, UserPlus, AtSign, CheckCheck, Repeat2, Quote, Reply, ThumbsUp, Video } from "lucide-react";
import { useMarkRead, useMe, useNotifications } from "@/hooks/use-data";
import { Avatar, EmptyState, Skeleton } from "./ui";
import { cn, timeAgo } from "@/lib/format";
import type { NotificationDto } from "@/lib/types";

const META: Record<NotificationDto["type"], { icon: React.ReactNode; text: string }> = {
  like: { icon: <Heart size={14} className="text-rose" fill="currentColor" />, text: "оценил(а) ваш пост" },
  comment: { icon: <MessageCircle size={14} className="text-accent" />, text: "ответил(а) на ваш пост" },
  follow: { icon: <UserPlus size={14} className="text-saffron" />, text: "подписался(ась) на вас" },
  mention: { icon: <AtSign size={14} className="text-accent" />, text: "упомянул(а) вас" },
  repost: { icon: <Repeat2 size={14} className="text-accent" />, text: "репостнул(а) ваш пост" },
  quote: { icon: <Quote size={14} className="text-saffron" />, text: "процитировал(а) ваш пост" },
  reply: { icon: <Reply size={14} className="text-accent" />, text: "ответил(а) на ваш комментарий" },
  comment_like: { icon: <ThumbsUp size={14} className="text-rose" />, text: "оценил(а) ваш комментарий" },
  call_invite: { icon: <Video size={14} className="text-accent" />, text: "приглашает вас в созвон" },
};

/** Уведомления: обновляются раз в 20 секунд; при открытии страницы отмечаются прочитанными. */
export function NotificationsView() {
  const { data: me, isPending: mePending } = useMe();
  const q = useNotifications(!!me?.user);
  const mark = useMarkRead();

  useEffect(() => {
    if (q.data && q.data.unread > 0 && !mark.isPending) {
      const t = setTimeout(() => mark.mutate(), 1200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.unread]);

  if (!mePending && !me?.user) return <EmptyState title="Уведомления только для своих" text="Войдите, чтобы видеть лайки, ответы и новых подписчиков." action={<Link href="/login" className="btn btn-primary">Войти</Link>} />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Уведомления</h1>
        {q.data?.unread ? <button onClick={() => mark.mutate()} className="btn btn-ghost text-xs"><CheckCheck size={14} /> Прочитать все</button> : null}
      </header>
      {q.isPending ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl!" />)}</div>
      ) : !q.data?.items.length ? (
        <EmptyState title="Пока тихо" text="Когда кто-то оценит или ответит на ваш пост, вы узнаете об этом здесь." />
      ) : (
        <ul className="space-y-2">
          {q.data.items.map((n) => {
            const m = META[n.type] ?? { icon: <AtSign size={14} />, text: "— новое событие" };
            const href = n.link ?? (n.post ? `/post/${n.post.id}` : `/u/${n.actor.handle}`);
            return (
              <li key={n.id}>
                <Link href={href} className={cn("card fade-in flex items-start gap-3 p-3.5 transition hover:border-line-strong", !n.read && "border-accent/40 bg-accent-soft/40")}>
                  <div className="relative"><Avatar user={n.actor} size={40} /><span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-elev shadow-card">{m.icon}</span></div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p><span className="font-semibold">{n.actor.name}</span> <span className="text-ink-2">{m.text}</span> <span className="text-xs text-muted">· {timeAgo(n.createdAt)}</span></p>
                    {n.post && <p className="mt-0.5 truncate text-muted">«{n.post.excerpt}»</p>}
                    {n.type === "call_invite" && n.link && <span className="btn btn-primary mt-2 px-3 py-1 text-xs"><Video size={13} /> Присоединиться</span>}
                  </div>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
