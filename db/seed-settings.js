import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";
import { DEFAULT_DATABASE_URL } from "./config.js";

export const settingDefs = [
  { key: "APP_SECRET", type: "string", defaultValue: "", label: "App Secret", description: "Application secret key", group: "general", isPublic: false },
  { key: "REDIS_ENABLED", type: "boolean", defaultValue: false, label: "Redis Enabled", description: "Enable Redis caching", group: "redis", isPublic: true },
  { key: "REDIS_HOST", type: "string", defaultValue: "localhost", label: "Redis Host", description: "Redis server hostname", group: "redis", isPublic: true },
  { key: "REDIS_PORT", type: "number", defaultValue: 6379, label: "Redis Port", description: "Redis server port", group: "redis", isPublic: true },
  { key: "REDIS_PASSWORD", type: "string", defaultValue: "", label: "Redis Password", description: "Redis server password", group: "redis", isPublic: false },
  { key: "REDIS_TTL", type: "number", defaultValue: 300, label: "Redis TTL", description: "Redis cache TTL in seconds", group: "redis", isPublic: true },
  { key: "RATE_LIMIT_ENABLED", type: "boolean", defaultValue: true, label: "Rate Limit Enabled", description: "Enable rate limiting", group: "rateLimit", isPublic: true },
  { key: "RATE_LIMIT_MAX_REQUESTS", type: "number", defaultValue: 100, label: "Rate Limit Max", description: "Maximum requests per window", group: "rateLimit", isPublic: true },
  { key: "RATE_LIMIT_WINDOW_MS", type: "number", defaultValue: 60000, label: "Rate Limit Window", description: "Rate limit window in milliseconds", group: "rateLimit", isPublic: true },
  { key: "DEBUG_SQL", type: "boolean", defaultValue: false, label: "Debug SQL", description: "Log SQL queries to console", group: "debug", isPublic: true },
];

export async function seedSettings(db) {
  console.log("Seeding settings from environment variables...");

  for (const def of settingDefs) {
    const envValue = process.env[def.key];
    const value = envValue !== undefined ? envValue : String(def.defaultValue);

    await db
      .insert(schema.settings)
      .values({
        key: def.key,
        value,
        type: def.type,
        label: def.label,
        description: def.description,
        group: def.group,
        isPublic: def.isPublic,
      })
      .onConflictDoNothing();

    const source = envValue !== undefined ? "env" : "default";
    const display =
      def.type === "boolean" ? (value === "true" ? "true" : "false") :
      def.isPublic ? value : "***";
    console.log(`  Setting: ${def.key} = ${display} (${source})`);
  }

  console.log("Settings seeded successfully!");
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const client = createClient({ url: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });
  const db = drizzle(client, { schema });
  seedSettings(db).catch(console.error).finally(() => client.close());
}
