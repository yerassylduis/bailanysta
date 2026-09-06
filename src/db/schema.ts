import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

/**
 * Схема данных Bailanysta.
 * Все даты хранятся как ISO-строки (UTC) — просто, читаемо, переносимо между SQLite и Turso.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  /** Индекс палитры аватара (0..7) — генерируется из handle. */
  hue: integer("hue").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** Настроение поста: жалын | тыныш | идея | ой | null */
    mood: text("mood"),
    createdAt: text("created_at").notNull(),
    editedAt: text("edited_at"),
  },
  (t) => [index("posts_author_idx").on(t.authorId), index("posts_created_idx").on(t.createdAt)],
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
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("comments_post_idx").on(t.postId)],
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
    type: text("type").notNull(), // like | comment | follow | mention
    postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
    read: integer("read").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.read)],
);

export type User = typeof users.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
