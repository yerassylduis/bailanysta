import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { DDL, SOFT_MIGRATIONS } from "./ddl";
import { ensureBot, seedIfEmpty } from "./seed";
import fs from "node:fs";
import path from "node:path";

/**
 * Единая точка доступа к БД.
 * - локально: файл SQLite (DATABASE_URL=file:./data/bailanysta.db)
 * - в проде: Turso / libSQL (DATABASE_URL=libsql://..., TURSO_AUTH_TOKEN=...)
 *
 * Клиент кэшируется в globalThis, чтобы hot-reload в dev не плодил соединения.
 */

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Поднимайте при изменении DDL/SOFT_MIGRATIONS: в dev это заставит переинициализировать кэш после hot-reload. */
const SCHEMA_VERSION = 5;

type Cached = { client: Client; db: Db; ready: Promise<void>; version: number };
const g = globalThis as unknown as { __bailanysta?: Cached };

/**
 * Выбор URL базы:
 *  1) DATABASE_URL из окружения (file:… или libsql://…);
 *  2) на Vercel без внешней БД — эфемерный файл в /tmp (данные живут до «холодного» рестарта,
 *     демо-данные сеются заново). Честный компромисс для «деплой в один клик»;
 *  3) локально — ./data/bailanysta.db.
 */
function resolveUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Интеграция Turso из маркетплейса Vercel задаёт TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN).
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL) {
    console.warn("[db] DATABASE_URL не задан: используется эфемерная SQLite в /tmp. Для постоянного хранения подключите Turso.");
    return "file:/tmp/bailanysta.db";
  }
  return "file:./data/bailanysta.db";
}

function createDb() {
  const url = resolveUrl();
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client, { schema });
  const ready: Promise<void> = (async () => {
    if (url.startsWith("file:")) await client.execute("PRAGMA foreign_keys = ON");
    for (const stmt of DDL) await client.execute(stmt);
    for (const stmt of SOFT_MIGRATIONS) {
      try { await client.execute(stmt); } catch (e) {
        if (!/duplicate column/i.test(String(e))) throw e;
      }
    }
    await seedIfEmpty(db);
    await ensureBot(db);
  })().catch((e) => {
    // Не кэшируем неудачную инициализацию: следующий запрос попробует снова.
    g.__bailanysta = undefined;
    throw e;
  });
  return { client, db, ready, version: SCHEMA_VERSION };
}

export async function getDb(): Promise<Db> {
  if (!g.__bailanysta || g.__bailanysta.version !== SCHEMA_VERSION) g.__bailanysta = createDb();
  await g.__bailanysta.ready;
  return g.__bailanysta.db;
}

export { schema };
