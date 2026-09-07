import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

/**
 * Схема данных Expert Bailanysta.
 * Все даты хранятся как ISO-строки (UTC) — просто, читаемо, переносимо между SQLite и Turso.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  /** Индекс палитры аватара (0..7) — генерируется из handle. */
  hue: integer("hue").notNull().default(0),
  /** Загруженный аватар (URL медиа) — если null, показываются инициалы. */
  avatarUrl: text("avatar_url"),
  /** Обложка профиля: URL медиа или "preset:N" — один из встроенных градиентов. */
  cover: text("cover"),
  /** Контакты для входа по коду: телефон в формате E.164, почта в нижнем регистре. */
  phone: text("phone"),
  email: text("email"),
  /** День рождения, ISO-дата YYYY-MM-DD */
  birthday: text("birthday"),
  /** Роль: user | admin */
  role: text("role").notNull().default("user"),
  /** Бан: до какого момента (ISO) или "forever"; null — не забанен */
  bannedUntil: text("banned_until"),
  banReason: text("ban_reason"),
  /** Галактика (группа/отдел) в созвездии; назначается по сообществу подписок, дальше хранится. */
  galaxyId: text("galaxy_id"),
  createdAt: text("created_at").notNull(),
});

/** Галактика — именованная группа людей в созвездии с общим аватаром. */
export const galaxies = sqliteTable("galaxies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Связь между галактиками с описанием, чем они связаны. */
export const galaxyLinks = sqliteTable("galaxy_links", {
  id: text("id").primaryKey(),
  fromId: text("from_id").notNull().references(() => galaxies.id, { onDelete: "cascade" }),
  toId: text("to_id").notNull().references(() => galaxies.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Журнал действий администраторов. */
export const adminLog = sqliteTable("admin_log", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id"),
  details: text("details"),
  createdAt: text("created_at").notNull(),
});

/** Одноразовые коды входа/регистрации. Храним только хэш кода. */
export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    /** нормализованный телефон или почта */
    target: text("target").notNull(),
    channel: text("channel").notNull(), // sms | email
    purpose: text("purpose").notNull(), // login | register
    codeHash: text("code_hash").notNull(),
    /** для регистрации — JSON с данными будущего профиля */
    payload: text("payload"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("otp_target_idx").on(t.target, t.createdAt)],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** Настроение поста: жалын | тыныш | идея | ой | null */
    mood: text("mood"),
    /** Репост/цитата: ссылка на исходный пост. Пустой text + repostOfId = чистый репост. */
    repostOfId: text("repost_of_id"),
    createdAt: text("created_at").notNull(),
    editedAt: text("edited_at"),
  },
  (t) => [index("posts_author_idx").on(t.authorId), index("posts_created_idx").on(t.createdAt), index("posts_repost_idx").on(t.repostOfId)],
);

/** Медиафайлы (фото/видео). Сам файл лежит в хранилище (диск или Vercel Blob), здесь — метаданные и URL. */
export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // image | video
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  width: integer("width"),
  height: integer("height"),
  url: text("url").notNull(),
  createdAt: text("created_at").notNull(),
});

export const postMedia = sqliteTable(
  "post_media",
  {
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    mediaId: text("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.mediaId] })],
);

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

/**
 * Диалоги. Личный: userA < userB (пара уникальна). Групповой: isGroup=1, title, ownerId,
 * участники — в conversation_members (userA/userB дублируют владельца, чтобы не ломать старые запросы).
 */
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userA: text("user_a").notNull().references(() => users.id, { onDelete: "cascade" }),
    userB: text("user_b").notNull().references(() => users.id, { onDelete: "cascade" }),
    isGroup: integer("is_group").notNull().default(0),
    title: text("title"),
    ownerId: text("owner_id"),
    lastMessageAt: text("last_message_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("conv_pair_idx").on(t.userA, t.userB)],
);

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: text("joined_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conv_members_user_idx").on(t.userId)],
);

/* ------------------------------ Звонки ---------------------------------- */

/** Комната звонка «Байланыс». id — короткий код, он же в ссылке. */
export const calls = sqliteTable("calls", {
  id: text("id").primaryKey(),
  hostId: text("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: text("created_at").notNull(),
  endedAt: text("ended_at"),
});

export const callParticipants = sqliteTable(
  "call_participants",
  {
    callId: text("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: text("joined_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    leftAt: text("left_at"),
  },
  (t) => [primaryKey({ columns: [t.callId, t.userId] })],
);

/** Сигналы WebRTC и чат звонка: offer/answer/ice адресные (toId), join/leave/chat — всем (toId null). */
export const callSignals = sqliteTable(
  "call_signals",
  {
    id: text("id").primaryKey(),
    callId: text("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
    fromId: text("from_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    toId: text("to_id"),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("call_signals_call_idx").on(t.callId, t.createdAt)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull().default(""),
    mediaId: text("media_id").references(() => media.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("msg_conv_idx").on(t.conversationId, t.createdAt)],
);

/** Отметка «прочитано до»: одна строка на участника диалога. */
export const conversationReads = sqliteTable(
  "conversation_reads",
  {
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: text("last_read_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] })],
);

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tag] }), index("post_tags_tag_idx").on(t.tag)],
);

export const likes = sqliteTable(
  "likes",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index("likes_post_idx").on(t.postId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** Ответ на другой комментарий (один уровень вложенности в UI). */
    parentId: text("parent_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("comments_post_idx").on(t.postId)],
);

export const commentLikes = sqliteTable(
  "comment_likes",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    commentId: text("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] }), index("comment_likes_comment_idx").on(t.commentId)],
);

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] }), index("follows_followee_idx").on(t.followeeId)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    /** Получатель */
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Кто совершил действие */
    actorId: text("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // like | comment | follow | mention | repost | quote | reply | comment_like | call_invite
    postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
    /** Ссылка-действие (например, /calls/abc-def-ghk для приглашения в созвон) */
    link: text("link"),
    read: integer("read").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.read)],
);

export type User = typeof users.$inferSelect;
export type Galaxy = typeof galaxies.$inferSelect;
export type GalaxyLink = typeof galaxyLinks.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Message = typeof messages.$inferSelect;
