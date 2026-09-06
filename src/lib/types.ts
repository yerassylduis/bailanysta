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

export type PostDto = {
  id: string;
  text: string;
  mood: string | null;
  createdAt: string;
  editedAt: string | null;
  author: UserDto;
  tags: string[];
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
};

export type CommentDto = {
  id: string;
  text: string;
  createdAt: string;
  author: UserDto;
};

export type NotificationDto = {
  id: string;
  type: "like" | "comment" | "follow" | "mention";
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

export type MuseMode = "draft" | "polish" | "hashtags" | "translate" | "reply";
export type MuseRequest = { mode: MuseMode; text: string; lang?: "kk" | "ru" | "en" };
export type MuseResponse = { variants: string[]; source: "claude" | "offline"; note?: string };
