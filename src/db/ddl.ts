/**
 * DDL, применяемая при старте (idempotent: IF NOT EXISTS).
 * Держим её рядом со schema.ts: это осознанный компромисс — проект должен
 * запускаться командой `npm run dev` без отдельного шага миграций.
 */
export const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    handle TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    hue INTEGER NOT NULL DEFAULT 0,
    avatar_url TEXT,
    cover TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    mood TEXT,
    repost_of_id TEXT,
    created_at TEXT NOT NULL,
    edited_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_id)`,
  `CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at)`,
  `CREATE TABLE IF NOT EXISTS post_tags (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (post_id, tag)
  )`,
  `CREATE INDEX IF NOT EXISTS post_tags_tag_idx ON post_tags(tag)`,
  `CREATE TABLE IF NOT EXISTS likes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id)
  )`,
  `CREATE INDEX IF NOT EXISTS likes_post_idx ON likes(post_id)`,
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    parent_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id)`,
  `CREATE TABLE IF NOT EXISTS comment_likes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, comment_id)
  )`,
  `CREATE INDEX IF NOT EXISTS comment_likes_comment_idx ON comment_likes(comment_id)`,
  `CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (follower_id, followee_id)
  )`,
  `CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows(followee_id)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
    link TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id, read)`,
  `CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS post_media (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, media_id)
  )`,
  `CREATE TABLE IF NOT EXISTS bookmarks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id)
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_group INTEGER NOT NULL DEFAULT 0,
    title TEXT,
    owner_id TEXT,
    last_message_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS conv_pair_idx ON conversations(user_a, user_b)`,
  `CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS conv_members_user_idx ON conversation_members(user_id)`,
  `CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    ended_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS call_participants (
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    left_at TEXT,
    PRIMARY KEY (call_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS call_signals (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id TEXT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS call_signals_call_idx ON call_signals(call_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT '',
    media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS msg_conv_idx ON messages(conversation_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS conversation_reads (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TEXT NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
  )`,
];

/**
 * Мягкие миграции для уже существующих баз: добавляем колонки, если их нет.
 * Ошибка «duplicate column» игнорируется вызывающей стороной.
 */
export const SOFT_MIGRATIONS: string[] = [
  `ALTER TABLE posts ADD COLUMN repost_of_id TEXT`,
  `ALTER TABLE users ADD COLUMN avatar_url TEXT`,
  `ALTER TABLE users ADD COLUMN cover TEXT`,
  `ALTER TABLE comments ADD COLUMN parent_id TEXT`,
  `ALTER TABLE notifications ADD COLUMN link TEXT`,
  `ALTER TABLE conversations ADD COLUMN is_group INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE conversations ADD COLUMN title TEXT`,
  `ALTER TABLE conversations ADD COLUMN owner_id TEXT`,
  // в старых базах индекс пары был UNIQUE — группам это мешает (владелец = user_a = user_b)
  `DROP INDEX IF EXISTS conv_pair_idx`,
  `CREATE INDEX IF NOT EXISTS conv_pair_idx ON conversations(user_a, user_b)`,
  // индексы на добавленные колонки — только после ALTER
  `CREATE INDEX IF NOT EXISTS posts_repost_idx ON posts(repost_of_id)`,
];
