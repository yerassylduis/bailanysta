import type { CommentDto, GraphDto, MuseRequest, MuseResponse, NotificationDto, Page, PostDto, TrendingTag, UserDto, UserProfileDto } from "./types";

/** Тонкий типизированный клиент к собственному API. Единственная точка fetch на клиенте. */

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
  });
  if (!res.ok) {
    let msg = res.statusText;
    let details: unknown;
    try {
      const j = await res.json();
      msg = j.error ?? msg;
      details = j.details;
    } catch {}
    throw new ApiError(res.status, msg, details);
  }
  return res.json() as Promise<T>;
}

const qs = (o: Record<string, string | number | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  me: () => request<{ user: UserDto | null; unread: number }>("/api/auth/me"),
  login: (handle: string, name?: string) => request<{ user: UserDto; created: boolean }>("/api/auth/login", { method: "POST", body: JSON.stringify({ handle, name }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  updateProfile: (patch: { name?: string; bio?: string }) => request<{ user: UserDto }>("/api/auth/me", { method: "PATCH", body: JSON.stringify(patch) }),

  posts: (f: { scope?: string; author?: string; q?: string; tag?: string; mood?: string; cursor?: string | null; limit?: number }) =>
    request<Page<PostDto>>(`/api/posts${qs(f)}`),
  post: (id: string) => request<PostDto>(`/api/posts/${id}`),
  createPost: (body: { text: string; mood: string | null }) => request<PostDto>("/api/posts", { method: "POST", body: JSON.stringify(body) }),
  updatePost: (id: string, body: { text?: string; mood?: string | null }) => request<PostDto>(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePost: (id: string) => request<{ ok: true }>(`/api/posts/${id}`, { method: "DELETE" }),
  like: (id: string, liked: boolean) => request<{ likeCount: number; likedByViewer: boolean }>(`/api/posts/${id}/like`, { method: "PUT", body: JSON.stringify({ liked }) }),

  comments: (id: string) => request<{ items: CommentDto[] }>(`/api/posts/${id}/comments`),
  addComment: (id: string, text: string) => request<CommentDto>(`/api/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),

  profile: (handle: string) => request<UserProfileDto>(`/api/users/${handle}`),
  follow: (handle: string, follow: boolean) => request<{ followers: number; viewerFollows: boolean }>(`/api/users/${handle}/follow`, { method: "PUT", body: JSON.stringify({ follow }) }),
  searchUsers: (q: string) => request<{ items: UserDto[] }>(`/api/users/search${qs({ q })}`),
  suggested: () => request<{ items: Array<UserDto & { followers: number }> }>("/api/users/suggested"),

  notifications: () => request<{ items: NotificationDto[]; unread: number }>("/api/notifications"),
  markRead: () => request<{ ok: true }>("/api/notifications", { method: "POST" }),

  trending: () => request<{ items: TrendingTag[] }>("/api/tags/trending"),
  graph: () => request<GraphDto>("/api/graph"),
  muse: (body: MuseRequest) => request<MuseResponse>("/api/ai/muse", { method: "POST", body: JSON.stringify(body) }),
};
