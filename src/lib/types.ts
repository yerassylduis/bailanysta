/** DTO, которыми обмениваются API и клиент. Единый источник правды для обеих сторон. */

export type UserDto = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  hue: number;
  createdAt: string;
};

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
  peer: UserDto;
  lastMessage: { text: string; hasMedia: boolean; mine: boolean; createdAt: string } | null;
  unread: number;
};

export type MessageDto = {
  id: string;
  text: string;
  media: MediaDto | null;
  mine: boolean;
  createdAt: string;
};

export type CommentDto = {
  id: string;
  text: string;
  createdAt: string;
  author: UserDto;
};

export type NotificationDto = {
  id: string;
  type: "like" | "comment" | "follow" | "mention" | "repost" | "quote";
  read: boolean;
  createdAt: string;
  actor: UserDto;
  post: { id: string; excerpt: string } | null;
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
