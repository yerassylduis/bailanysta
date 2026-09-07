import type { CallDto, CommentDto, ConversationDto, GraphDto, MeDto, MediaDto, MessageDto, MuseRequest, MuseResponse, NotificationDto, Page, PostDto, SignalDto, SignalType, TrendingTag, UserDto, UserProfileDto } from "./types";

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
  me: () => request<{ user: MeDto | null; unread: number; unreadMessages: number }>("/api/auth/me"),
  /** Быстрый вход по нику — только демо-аккаунты */
  login: (handle: string) => request<{ user: UserDto; created: boolean }>("/api/auth/login", { method: "POST", body: JSON.stringify({ handle }) }),
  /** Код для входа (target) или регистрации (register + via) */
  otpRequest: (body: { target?: string; register?: { handle: string; name: string; phone: string; email: string; birthday: string } }) =>
    request<{ delivery: "sent" | "screen"; code?: string; expiresInSec: number; target: string; channel: "sms" | "email" }>("/api/auth/otp/request", { method: "POST", body: JSON.stringify(body) }),
  otpVerify: (target: string, code: string) => request<{ user: MeDto; created: boolean }>("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ target, code }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  updateProfile: (patch: { name?: string; bio?: string; avatarMediaId?: string | null; coverMediaId?: string | null; coverPreset?: number | null; phone?: string; email?: string; birthday?: string }) =>
    request<{ user: MeDto }>("/api/auth/me", { method: "PATCH", body: JSON.stringify(patch) }),

  posts: (f: { scope?: string; author?: string; q?: string; tag?: string; mood?: string; cursor?: string | null; limit?: number }) =>
    request<Page<PostDto>>(`/api/posts${qs(f)}`),
  post: (id: string) => request<PostDto>(`/api/posts/${id}`),
  createPost: (body: { text: string; mood: string | null; mediaIds: string[] }) => request<PostDto>("/api/posts", { method: "POST", body: JSON.stringify(body) }),
  updatePost: (id: string, body: { text?: string; mood?: string | null; mediaIds?: string[] }) => request<PostDto>(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  repost: (id: string, text?: string) => request<PostDto>(`/api/posts/${id}/repost`, { method: "POST", body: JSON.stringify({ text }) }),
  undoRepost: (id: string) => request<{ repostCount: number; repostedByViewer: boolean }>(`/api/posts/${id}/repost`, { method: "DELETE" }),
  bookmark: (id: string, bookmarked: boolean) => request<{ bookmarkedByViewer: boolean }>(`/api/posts/${id}/bookmark`, { method: "PUT", body: JSON.stringify({ bookmarked }) }),

  /** Загрузка файла — единственный не-JSON запрос. */
  upload: async (file: File | Blob, dims?: { width: number; height: number }, onProgress?: (p: number) => void) => {
    const fd = new FormData();
    fd.append("file", file, file instanceof File ? file.name : "upload");
    if (dims) { fd.append("width", String(dims.width)); fd.append("height", String(dims.height)); }
    return new Promise<MediaDto>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        try {
          const j = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(j); else reject(new ApiError(xhr.status, j.error ?? xhr.statusText));
        } catch { reject(new ApiError(xhr.status, "Не удалось загрузить файл")); }
      };
      xhr.onerror = () => reject(new ApiError(0, "Сеть недоступна"));
      xhr.send(fd);
    });
  },

  conversations: () => request<{ items: ConversationDto[] }>("/api/messages"),
  messages: (handle: string, after?: string) => request<{ peer: UserDto; items: MessageDto[] }>(`/api/messages/${handle}${qs({ after })}`),
  sendMessage: (handle: string, body: { text?: string; mediaId?: string }) => request<MessageDto>(`/api/messages/${handle}`, { method: "POST", body: JSON.stringify(body) }),
  createGroup: (title: string, handles: string[]) => request<ConversationDto>("/api/messages/groups", { method: "POST", body: JSON.stringify({ title, handles }) }),
  groupMessages: (id: string, after?: string) => request<{ conversation: ConversationDto; items: MessageDto[] }>(`/api/messages/c/${id}${qs({ after })}`),
  sendGroupMessage: (id: string, body: { text?: string; mediaId?: string }) => request<MessageDto>(`/api/messages/c/${id}`, { method: "POST", body: JSON.stringify(body) }),
  addGroupMember: (id: string, handle: string) => request<ConversationDto>(`/api/messages/c/${id}/members`, { method: "POST", body: JSON.stringify({ handle }) }),
  leaveGroup: (id: string) => request<{ ok: true }>(`/api/messages/c/${id}/leave`, { method: "POST" }),

  calls: () => request<{ items: CallDto[] }>("/api/calls"),
  createCall: (title?: string) => request<CallDto>("/api/calls", { method: "POST", body: JSON.stringify({ title }) }),
  call: (id: string) => request<{ call: CallDto; chat: SignalDto[] }>(`/api/calls/${id}`),
  joinCall: (id: string) => request<CallDto>(`/api/calls/${id}/join`, { method: "POST" }),
  leaveCall: (id: string) => request<{ ok: true }>(`/api/calls/${id}/leave`, { method: "POST" }),
  iceServers: () => request<{ iceServers: RTCIceServer[] }>("/api/calls/ice"),
  inviteToCall: (id: string, handle: string) => request<{ ok: true; invited: string }>(`/api/calls/${id}/invite`, { method: "POST", body: JSON.stringify({ handle }) }),
  signal: (id: string, type: SignalType, to: string | null, payload: unknown) => request<{ id: string; createdAt: string }>(`/api/calls/${id}/signal`, { method: "POST", body: JSON.stringify({ type, to, payload }) }),
  deletePost: (id: string) => request<{ ok: true }>(`/api/posts/${id}`, { method: "DELETE" }),
  like: (id: string, liked: boolean) => request<{ likeCount: number; likedByViewer: boolean }>(`/api/posts/${id}/like`, { method: "PUT", body: JSON.stringify({ liked }) }),

  comments: (id: string) => request<{ items: CommentDto[] }>(`/api/posts/${id}/comments`),
  addComment: (id: string, text: string, parentId?: string) => request<CommentDto>(`/api/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ text, parentId }) }),
  likeComment: (id: string, liked: boolean) => request<{ likeCount: number; likedByViewer: boolean }>(`/api/comments/${id}/like`, { method: "PUT", body: JSON.stringify({ liked }) }),

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
