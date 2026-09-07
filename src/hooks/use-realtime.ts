"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api-client";
import type { NotificationDto, UserDto } from "@/lib/types";
import { keys } from "./use-data";

/**
 * Подписка на /api/events (SSE). Обновляет счётчики в шапке, инвалидирует списки,
 * показывает всплывашки о новых событиях и число непрочитанных в заголовке вкладки.
 */
const TEXT: Record<NotificationDto["type"], string> = {
  like: "оценил(а) ваш пост", comment: "ответил(а) на ваш пост", follow: "подписался(ась) на вас",
  mention: "упомянул(а) вас", repost: "репостнул(а) ваш пост", quote: "процитировал(а) ваш пост",
};

type MeData = Awaited<ReturnType<typeof api.me>>;

export function useRealtime(enabled: boolean, toast: (text: string, kind?: "info" | "success" | "error") => void) {
  const qc = useQueryClient();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);
  const baseTitle = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const es = new EventSource("/api/events");

    const setCounts = (unread?: number, unreadMessages?: number) => {
      qc.setQueryData<MeData>(keys.me, (d) => (d ? { ...d, unread: unread ?? d.unread, unreadMessages: unreadMessages ?? d.unreadMessages } : d));
      // бейдж в заголовке вкладки
      if (baseTitle.current === null) baseTitle.current = document.title.replace(/^\(\d+\)\s*/, "");
      const total = (unread ?? 0) + (unreadMessages ?? 0);
      const clean = document.title.replace(/^\(\d+\)\s*/, "");
      document.title = total > 0 ? `(${total}) ${clean}` : clean;
    };

    es.addEventListener("counts", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { unread: number; unreadMessages: number };
      setCounts(d.unread, d.unreadMessages);
    });

    es.addEventListener("notifications", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { items: NotificationDto[]; unread: number; unreadMessages: number };
      setCounts(d.unread, d.unreadMessages);
      qc.invalidateQueries({ queryKey: keys.notifications });
      // лайк/комментарий/репост меняют счётчики на постах — обновим ленты и открытый пост
      qc.invalidateQueries({ queryKey: ["posts"] });
      for (const n of d.items) { if (n.post) qc.invalidateQueries({ queryKey: keys.post(n.post.id) }); }
      if (d.items.some((n) => n.type === "follow")) qc.invalidateQueries({ queryKey: ["profile"] });
      if (!pathRef.current.startsWith("/notifications")) {
        for (const n of d.items.slice(-3)) toast(`${n.actor.name} ${TEXT[n.type] ?? "— новое событие"}`, "success");
      }
    });

    es.addEventListener("messages", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { items: Array<{ from: UserDto; text: string }>; unreadMessages: number };
      setCounts(undefined, d.unreadMessages);
      qc.invalidateQueries({ queryKey: keys.conversations });
      for (const m of d.items.slice(-3)) {
        qc.invalidateQueries({ queryKey: keys.messages(m.from.handle) });
        if (!pathRef.current.startsWith(`/messages/${m.from.handle}`)) toast(`💬 ${m.from.name}: ${m.text.slice(0, 60)}`);
      }
    });

    // EventSource переподключается сам; логируем только для отладки
    es.onerror = () => { /* reconnect handled by browser */ };
    return () => es.close();
  }, [enabled, qc, toast]);
}
