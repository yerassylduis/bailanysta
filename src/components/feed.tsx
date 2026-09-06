"use client";

import { useEffect, useRef } from "react";
import { useFeed, type FeedFilter } from "@/hooks/use-data";
import { PostCard } from "./post-card";
import { EmptyState, FeedSkeleton, PostSkeleton } from "./ui";

/** Бесконечная лента: курсорная пагинация + IntersectionObserver + скелетоны. */
export function Feed({ filter, emptyTitle = "Пока пусто", emptyText, emptyAction }: { filter: FeedFilter; emptyTitle?: string; emptyText?: string; emptyAction?: React.ReactNode }) {
  const q = useFeed(filter);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q, q.hasNextPage, q.isFetchingNextPage]);

  if (q.isPending) return <FeedSkeleton />;
  if (q.isError) return <EmptyState title="Не удалось загрузить ленту" text={q.error.message} action={<button onClick={() => q.refetch()} className="btn btn-outline">Повторить</button>} />;

  const items = q.data.pages.flatMap((p) => p.items);
  if (!items.length) return <EmptyState title={emptyTitle} text={emptyText} action={emptyAction} />;

  return (
    <div className="space-y-4">
      {items.map((p) => <PostCard key={p.id} post={p} />)}
      <div ref={sentinel} />
      {q.isFetchingNextPage && <PostSkeleton />}
      {!q.hasNextPage && items.length > 5 && <p className="py-6 text-center text-xs text-muted">Это всё. Степь большая, но лента закончилась.</p>}
    </div>
  );
}
