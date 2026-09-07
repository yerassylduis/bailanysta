"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api-client";
import type { NotificationDto, PostDto, UserDto } from "@/lib/types";
import { PENDING_KEY, isPlainAllFeed, keys, patchPostEverywhere, prependToAllFeed, removePostEverywhere } from "./use-data";
import { ApiError } from "@/lib/api-client";
import { playNotify } from "@/lib/sound";

/**
 * Подписка на /api/events (SSE). Обновляет счётчики в шапке, инвалидирует списки,
 * показывает всплывашки о новых событиях и число непрочитанных в заголовке вкладки.
 */
const TEXT: Record<NotificationDto["type"], string> = {
  like: "оценил(а) ваш пост", comment: "ответил(а) на ваш пост", follow: "подписался(ась) на вас",
  mention: "упомянул(а) вас", repost: "репостнул(а) ваш пост", quote: "процитировал(а) ваш пост",
  reply: "ответил(а) на ваш комментарий", comment_like: "оценил(а) ваш комментарий",
};

type MeData = Awaited<ReturnType<typeof api.me>>;

export function useRealtime(enabled: boolean, toast: (text: string, kind?: "info" | "success" | "error") => void) {
  const qc = useQueryClient();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);
  const baseTitle = useRef<string | null>(null);
  /** id уже озвученных событий — на случай повторной доставки при переподключении потока. */
  const seen = useRef(new Set<string>());
  const fresh = (ids: string[]) => {
    const n = ids.filter((id) => !seen.current.has(id));
    for (const id of n) seen.current.add(id);
    if (seen.current.size > 500) seen.current = new Set([...seen.current].slice(-250));
    return n.length > 0;
  };

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
      if (d.items.some((n) => n.type === "follow")) qc.invalidateQueries({ queryKey: ["profile"] });
      if (fresh(d.items.map((n) => n.id))) playNotify();
      if (!pathRef.current.startsWith("/notifications")) {
        for (const n of d.items.slice(-3)) toast(`${n.actor.name} ${TEXT[n.type] ?? "— новое событие"}`, "success");
      }
    });

    es.addEventListener("messages", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { items: Array<{ id: string; from: UserDto; text: string; conversationId: string; group: { id: string; title: string } | null }>; unreadMessages: number };
      setCounts(undefined, d.unreadMessages);
      qc.invalidateQueries({ queryKey: keys.conversations });
      if (fresh(d.items.map((m) => m.id))) playNotify();
      for (const m of d.items.slice(-3)) {
        if (m.group) {
          qc.invalidateQueries({ queryKey: keys.groupMessages(m.group.id) });
          if (!pathRef.current.startsWith(`/messages/g/${m.group.id}`)) toast(`👥 ${m.group.title} · ${m.from.name}: ${m.text.slice(0, 50)}`);
        } else {
          qc.invalidateQueries({ queryKey: keys.messages(m.from.handle) });
          if (!pathRef.current.startsWith(`/messages/${m.from.handle}`)) toast(`💬 ${m.from.name}: ${m.text.slice(0, 60)}`);
        }
      }
    });

    // Новые посты: свои пропускаем (уже в кэше через мутацию); чужие — в общую ленту сразу,
    // если пользователь у верха страницы, иначе в «ожидающие» (кнопка «N новых постов»).
    es.addEventListener("posts", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { items: PostDto[] };
      const me = qc.getQueryData<MeData>(keys.me)?.user;
      const items = d.items.filter((p) => p.author.id !== me?.id);
      if (!items.length) return;
      const onHome = pathRef.current === "/" && !location.search.includes("scope=") && !location.search.includes("mood=");
      if (onHome && window.scrollY < 300) prependToAllFeed(qc, items);
      else qc.setQueryData<PostDto[]>(PENDING_KEY, (prev = []) => [...items.filter((p) => !prev.some((x) => x.id === p.id)), ...prev]);
      // остальные ленты (подписки, горячее, теги, профили) — перечитать при следующем показе или сразу, если на экране
      qc.invalidateQueries({ queryKey: ["posts"], predicate: (q) => !isPlainAllFeed(q.queryKey) });
      qc.invalidateQueries({ queryKey: keys.trending });
    });

    // Активность: перечитываем затронутые посты и патчим их во всех кэшах; удалённые — убираем.
    es.addEventListener("activity", async (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { postIds: string[] };
      await Promise.all(d.postIds.slice(0, 20).map(async (id) => {
        try {
          const fresh = await api.post(id);
          patchPostEverywhere(qc, id, () => fresh);
          if (pathRef.current === `/post/${id}`) qc.invalidateQueries({ queryKey: keys.comments(id) });
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) removePostEverywhere(qc, id);
        }
      }));
    });

    // EventSource переподключается сам; логируем только для отладки
    es.onerror = () => { /* reconnect handled by browser */ };
    return () => es.close();
  }, [enabled, qc, toast]);
}
