"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { PENDING_KEY, prependToAllFeed, useFeed, usePendingPosts, type FeedFilter } from "@/hooks/use-data";
import { useT } from "./locale-provider";
import { PostCard } from "./post-card";
import { EmptyState, FeedSkeleton, PostSkeleton } from "./ui";

/** Бесконечная лента: курсорная пагинация + IntersectionObserver + скелетоны. */
export function Feed({ filter, live, emptyTitle, emptyText, emptyAction }: { filter: FeedFilter; live?: boolean; emptyTitle?: string; emptyText?: string; emptyAction?: React.ReactNode }) {
  const { t } = useT();
  const q = useFeed(filter);
  const qc = useQueryClient();
  const { data: pending } = usePendingPosts();
  const sentinel = useRef<HTMLDivElement>(null);

  /** Показать посты, накопившиеся по SSE, пока читали ниже верха. */
  const showPending = () => {
    prependToAllFeed(qc, pending);
    qc.setQueryData(PENDING_KEY, []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
  if (q.isError) return <EmptyState title={t("feed.loadFailed")} text={q.error.message} action={<button onClick={() => q.refetch()} className="btn btn-outline">{t("common.retry")}</button>} />;

  const items = q.data.pages.flatMap((p) => p.items);
  if (!items.length) return <EmptyState title={emptyTitle ?? t("common.nothing")} text={emptyText} action={emptyAction} />;

  return (
    <div className="space-y-4">
      {live && pending.length > 0 && (
        <div className="sticky top-2 z-30 flex justify-center">
          <button onClick={showPending} className="btn btn-primary fade-in shadow-card"><ArrowUp size={16} /> {t("feed.newPosts", { count: pending.length })}</button>
        </div>
      )}
      {items.map((p) => <PostCard key={p.id} post={p} />)}
      <div ref={sentinel} />
      {q.isFetchingNextPage && <PostSkeleton />}
      {!q.hasNextPage && items.length > 5 && <p className="py-6 text-center text-xs text-muted">{t("feed.theEnd")}</p>}
    </div>
  );
}
