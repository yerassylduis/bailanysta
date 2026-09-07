"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Heart, MessageCircle, UserPlus, AtSign, CheckCheck, Repeat2, Quote, Reply, ThumbsUp, Video } from "lucide-react";
import { useMarkRead, useMe, useNotifications } from "@/hooks/use-data";
import { Avatar, EmptyState, Skeleton } from "./ui";
import { cn, timeAgo } from "@/lib/format";
import type { NotificationDto } from "@/lib/types";
import { useT } from "./locale-provider";

/** Иконки по типу события; текст — ключ notifications.type.<type>. */
const ICON: Record<NotificationDto["type"], React.ReactNode> = {
  like: <Heart size={14} className="text-rose" fill="currentColor" />,
  comment: <MessageCircle size={14} className="text-accent" />,
  follow: <UserPlus size={14} className="text-saffron" />,
  mention: <AtSign size={14} className="text-accent" />,
  repost: <Repeat2 size={14} className="text-accent" />,
  quote: <Quote size={14} className="text-saffron" />,
  reply: <Reply size={14} className="text-accent" />,
  comment_like: <ThumbsUp size={14} className="text-rose" />,
  call_invite: <Video size={14} className="text-accent" />,
};

/** Уведомления: обновляются раз в 20 секунд; при открытии страницы отмечаются прочитанными. */
export function NotificationsView() {
  const { data: me, isPending: mePending } = useMe();
  const q = useNotifications(!!me?.user);
  const mark = useMarkRead();
  const { t, locale } = useT();

  useEffect(() => {
    if (q.data && q.data.unread > 0 && !mark.isPending) {
      const t = setTimeout(() => mark.mutate(), 1200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.unread]);

  if (!mePending && !me?.user) return <EmptyState title={t("notifications.onlyForOwn")} text={t("notifications.loginText")} action={<Link href="/login" className="btn btn-primary">{t("nav.login")}</Link>} />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{t("nav.notifications")}</h1>
        {q.data?.unread ? <button onClick={() => mark.mutate()} className="btn btn-ghost text-xs"><CheckCheck size={14} /> {t("notifications.markAll")}</button> : null}
      </header>
      {q.isPending ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl!" />)}</div>
      ) : !q.data?.items.length ? (
        <EmptyState title={t("notifications.quiet")} text={t("notifications.quietText")} />
      ) : (
        <ul className="space-y-2">
          {q.data.items.map((n) => {
            const icon = ICON[n.type] ?? <AtSign size={14} />;
            const text = n.type in ICON ? t(`notifications.type.${n.type}`) : t("notifications.type.unknown");
            const href = n.link ?? (n.post ? `/post/${n.post.id}` : `/u/${n.actor.handle}`);
            return (
              <li key={n.id}>
                <Link href={href} className={cn("card fade-in flex items-start gap-3 p-3.5 transition hover:border-line-strong", !n.read && "border-accent/40 bg-accent-soft/40")}>
                  <div className="relative"><Avatar user={n.actor} size={40} /><span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-elev shadow-card">{icon}</span></div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p><span className="font-semibold">{n.actor.name}</span> <span className="text-ink-2">{text}</span> <span className="text-xs text-muted">· {timeAgo(n.createdAt, locale)}</span></p>
                    {n.post && <p className="mt-0.5 truncate text-muted">«{n.post.excerpt}»</p>}
                    {n.type === "call_invite" && n.link && <span className="btn btn-primary mt-2 px-3 py-1 text-xs"><Video size={13} /> {t("notifications.join")}</span>}
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
