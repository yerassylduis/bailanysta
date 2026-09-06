import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/bailanysta.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
