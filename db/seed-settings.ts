import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

interface SettingDef {
  key: string;
  type: "string" | "number" | "boolean";
  label: string;
  description: string;
  group: string;
  isPublic: boolean;
}

export const settingDefs: SettingDef[] = [
  { key: "APP_SECRET", type: "string", label: "App Secret", description: "Application secret key", group: "general", isPublic: false },
  { key: "REDIS_ENABLED", type: "boolean", label: "Redis Enabled", description: "Enable Redis caching", group: "redis", isPublic: true },
  { key: "REDIS_HOST", type: "string", label: "Redis Host", description: "Redis server hostname", group: "redis", isPublic: true },
  { key: "REDIS_PORT", type: "number", label: "Redis Port", description: "Redis server port", group: "redis", isPublic: true },
  { key: "REDIS_PASSWORD", type: "string", label: "Redis Password", description: "Redis server password", group: "redis", isPublic: false },
  { key: "REDIS_TTL", type: "number", label: "Redis TTL", description: "Redis cache TTL in seconds", group: "redis", isPublic: true },
  { key: "RATE_LIMIT_ENABLED", type: "boolean", label: "Rate Limit Enabled", description: "Enable rate limiting", group: "rateLimit", isPublic: true },
  { key: "RATE_LIMIT_MAX_REQUESTS", type: "number", label: "Rate Limit Max", description: "Maximum requests per window", group: "rateLimit", isPublic: true },
  { key: "RATE_LIMIT_WINDOW_MS", type: "number", label: "Rate Limit Window", description: "Rate limit window in milliseconds", group: "rateLimit", isPublic: true },
  { key: "DEBUG_SQL", type: "boolean", label: "Debug SQL", description: "Log SQL queries to console", group: "debug", isPublic: true },
];

export async function seedSettings(db: ReturnType<typeof drizzle<typeof schema>>) {
  console.log("Seeding settings from environment variables...");

  for (const def of settingDefs) {
    const envValue = process.env[def.key];
    if (envValue === undefined) {
      console.log(`  Skip: ${def.key} (not set in .env)`);
      continue;
    }

    await db
      .insert(schema.settings)
      .values({
        key: def.key,
        value: envValue,
        type: def.type,
        label: def.label,
        description: def.description,
        group: def.group,
        isPublic: def.isPublic,
      })
      .onConflictDoNothing();

    const display =
      def.type === "boolean" ? (envValue === "true" ? "true" : "false") :
      def.isPublic ? envValue : "***";
    console.log(`  Setting: ${def.key} = ${display}`);
  }

  console.log("Settings seeded successfully!");
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const client = createClient({ url: process.env.DATABASE_URL || "file:./local.db" });
  const db = drizzle(client, { schema });
  seedSettings(db).catch(console.error).finally(() => client.close());
}
