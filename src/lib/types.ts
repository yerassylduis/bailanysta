/** DTO, которыми обмениваются API и клиент. Единый источник правды для обеих сторон. */

export type UserDto = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  hue: number;
  avatarUrl: string | null;
  /** URL обложки или "preset:N" */
  cover: string | null;
  createdAt: string;
};

/** Приватные данные своего профиля (видит только владелец). */
export type MeDto = UserDto & { phone: string | null; email: string | null; birthday: string | null };

export type UserProfileDto = UserDto & {
  stats: { posts: number; followers: number; following: number; likesReceived: number };
  viewerFollows: boolean;
  isViewer: boolean;
};

export type MediaDto = {
  id: string;
  kind: "image" | "video";
  mime: string;
  url: string;
  width: number | null;
  height: number | null;
};

export type PostDto = {
  id: string;
  text: string;
  mood: string | null;
  createdAt: string;
  editedAt: string | null;
  author: UserDto;
  tags: string[];
  media: MediaDto[];
  /** Исходный пост для репоста/цитаты (один уровень вложенности). null, если исходник удалён. */
  repostOf: PostDto | null;
  isRepost: boolean;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  likedByViewer: boolean;
  repostedByViewer: boolean;
  bookmarkedByViewer: boolean;
};

export type ConversationDto = {
  id: string;
  kind: "dm" | "group";
  /** Собеседник — для личного диалога */
  peer: UserDto | null;
  /** Название и участники — для группы */
  title: string | null;
  members: UserDto[];
  ownerId: string | null;
  lastMessage: { text: string; hasMedia: boolean; mine: boolean; createdAt: string; fromName?: string } | null;
  unread: number;
};

export type MessageDto = {
  id: string;
  text: string;
  media: MediaDto | null;
  mine: boolean;
  createdAt: string;
  /** Автор — нужен в группах */
  from: UserDto;
};

/* --------------------------------- звонки -------------------------------- */

export type CallDto = {
  id: string;
  title: string;
  host: UserDto;
  createdAt: string;
  endedAt: string | null;
  participants: Array<UserDto & { joinedAt: string; online: boolean }>;
};

export type SignalType = "join" | "leave" | "offer" | "answer" | "ice" | "chat" | "state";
export type SignalDto = {
  id: string;
  type: SignalType;
  from: UserDto;
  to: string | null;
  payload: unknown;
  createdAt: string;
};

export type CommentDto = {
  id: string;
  text: string;
  createdAt: string;
  author: UserDto;
  parentId: string | null;
  likeCount: number;
  likedByViewer: boolean;
};

export type NotificationDto = {
  id: string;
  type: "like" | "comment" | "follow" | "mention" | "repost" | "quote" | "reply" | "comment_like" | "call_invite";
  read: boolean;
  createdAt: string;
  actor: UserDto;
  post: { id: string; excerpt: string } | null;
  /** Ссылка-действие: для call_invite — страница созвона */
  link: string | null;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

export type TrendingTag = { tag: string; count: number };

export type GraphDto = {
  nodes: Array<UserDto & { posts: number; followers: number }>;
  links: Array<{ source: string; target: string }>;
};

export type MuseMode = "draft" | "polish" | "hashtags" | "translate" | "reply" | "caption";
export type MuseRequest = { mode: MuseMode; text: string; lang?: "kk" | "ru" | "en" };
export type MuseResponse = { variants: string[]; source: "claude" | "offline"; note?: string };
