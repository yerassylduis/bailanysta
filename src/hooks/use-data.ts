"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Page, PostDto, UserProfileDto } from "@/lib/types";

/**
 * Все хуки данных в одном месте. Ключи запросов — тоже здесь, чтобы
 * инвалидация и оптимистичные обновления не расползались по компонентам.
 */
export const keys = {
  me: ["me"] as const,
  feed: (f: Record<string, string | undefined>) => ["posts", f] as const,
  post: (id: string) => ["post", id] as const,
  comments: (id: string) => ["comments", id] as const,
  profile: (h: string) => ["profile", h] as const,
  notifications: ["notifications"] as const,
  trending: ["trending"] as const,
  suggested: ["suggested"] as const,
  graph: ["graph"] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: api.me, staleTime: 60_000 });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => { qc.clear(); router.push("/"); router.refresh(); },
  });
}

export type FeedFilter = { scope?: "all" | "following"; author?: string; q?: string; tag?: string; mood?: string };

export function useFeed(filter: FeedFilter, enabled = true) {
  const clean = Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) as Record<string, string | undefined>;
  return useInfiniteQuery({
    queryKey: keys.feed(clean),
    queryFn: ({ pageParam }) => api.posts({ ...clean, cursor: pageParam, limit: 10 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}

export function usePost(id: string) {
  return useQuery({ queryKey: keys.post(id), queryFn: () => api.post(id) });
}

export function useComments(id: string, enabled = true) {
  return useQuery({ queryKey: keys.comments(id), queryFn: () => api.comments(id), enabled });
}

/** Меняет пост во всех кэшах — в лентах (infinite) и в карточке поста. */
function patchPostEverywhere(qc: ReturnType<typeof useQueryClient>, id: string, fn: (p: PostDto) => PostDto) {
  qc.setQueriesData<InfiniteData<Page<PostDto>>>({ queryKey: ["posts"] }, (data) =>
    data ? { ...data, pages: data.pages.map((pg) => ({ ...pg, items: pg.items.map((p) => (p.id === id ? fn(p) : p)) })) } : data);
  qc.setQueryData<PostDto>(keys.post(id), (p) => (p ? fn(p) : p));
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) => api.like(id, liked),
    onMutate: async ({ id, liked }) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      patchPostEverywhere(qc, id, (p) => ({ ...p, likedByViewer: liked, likeCount: p.likeCount + (liked ? 1 : -1) }));
    },
    onSuccess: (res, { id }) => patchPostEverywhere(qc, id, (p) => ({ ...p, likeCount: res.likeCount, likedByViewer: res.likedByViewer })),
    onError: (_e, { id, liked }) => patchPostEverywhere(qc, id, (p) => ({ ...p, likedByViewer: !liked, likeCount: p.likeCount + (liked ? -1 : 1) })),
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPost,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["posts"] }); qc.invalidateQueries({ queryKey: keys.trending }); qc.invalidateQueries({ queryKey: ["profile"] }); },
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; text?: string; mood?: string | null }) => api.updatePost(id, body),
    onSuccess: (post) => { patchPostEverywhere(qc, post.id, () => post); qc.invalidateQueries({ queryKey: keys.trending }); },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePost(id),
    onSuccess: (_r, id) => {
      qc.setQueriesData<InfiniteData<Page<PostDto>>>({ queryKey: ["posts"] }, (data) =>
        data ? { ...data, pages: data.pages.map((pg) => ({ ...pg, items: pg.items.filter((p) => p.id !== id) })) } : data);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.addComment(postId, text),
    onSuccess: (c) => {
      qc.setQueryData<{ items: typeof c[] }>(keys.comments(postId), (d) => ({ items: [...(d?.items ?? []), c] }));
      patchPostEverywhere(qc, postId, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
    },
  });
}

export function useProfile(handle: string) {
  return useQuery({ queryKey: keys.profile(handle), queryFn: () => api.profile(handle), retry: false });
}

export function useFollow(handle: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (follow: boolean) => api.follow(handle, follow),
    onMutate: (follow) => {
      qc.setQueryData<UserProfileDto>(keys.profile(handle), (p) =>
        p ? { ...p, viewerFollows: follow, stats: { ...p.stats, followers: p.stats.followers + (follow ? 1 : -1) } } : p);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.profile(handle) }); qc.invalidateQueries({ queryKey: keys.suggested }); qc.invalidateQueries({ queryKey: keys.graph }); qc.invalidateQueries({ queryKey: ["posts", { scope: "following" }] }); },
    onError: () => qc.invalidateQueries({ queryKey: keys.profile(handle) }),
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({ queryKey: keys.notifications, queryFn: api.notifications, enabled, refetchInterval: 20_000 });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markRead,
    onSuccess: () => {
      qc.setQueryData<Awaited<ReturnType<typeof api.notifications>>>(keys.notifications, (d) => d ? { unread: 0, items: d.items.map((n) => ({ ...n, read: true })) } : d);
      qc.setQueryData<Awaited<ReturnType<typeof api.me>>>(keys.me, (d) => (d ? { ...d, unread: 0 } : d));
    },
  });
}

export const useTrending = () => useQuery({ queryKey: keys.trending, queryFn: api.trending, staleTime: 60_000 });
export const useSuggested = () => useQuery({ queryKey: keys.suggested, queryFn: api.suggested, staleTime: 60_000 });
export const useGraph = () => useQuery({ queryKey: keys.graph, queryFn: api.graph, staleTime: 60_000 });
export const useMuse = () => useMutation({ mutationFn: api.muse });
