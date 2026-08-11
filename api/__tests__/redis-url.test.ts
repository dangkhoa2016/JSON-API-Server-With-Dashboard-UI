import { it, expect, vi, beforeAll, beforeEach } from "vitest";
import { getDb } from "../queries/connection";
import { sql } from "drizzle-orm";

const envState = vi.hoisted(() => ({
  redisEnabled: true,
  cacheTtlSeconds: 60,
  databaseUrl: "file::memory:?cache=shared",
  redisHost: "localhost",
  redisPort: 6379,
  redisPassword: "",
  redisDb: 0,
  redisUrl: "",
}));

let constructorArgs: any[] = [];

vi.mock("ioredis", () => ({
  default: function MockRedis(...args: any[]) {
    constructorArgs = args;
    return { on: vi.fn() };
  },
}));

vi.mock("../lib/env", () => ({ env: envState }));

beforeAll(async () => {
  const db = getDb();
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'string',
      label TEXT,
      description TEXT,
      "group" TEXT,
      is_public INTEGER NOT NULL DEFAULT 0
    )
  `);
});

beforeEach(async () => {
  const db = getDb();
  await db.run(sql`DELETE FROM settings`);
  vi.resetModules();
  constructorArgs = [];
});

it("uses DB REDIS_URL when present", async () => {
  const db = getDb();
  await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public)
    VALUES ('REDIS_URL', 'redis://db-url:6379/0', 'string', 'Redis URL', '', 'redis', 0)`);
  envState.redisUrl = "redis://env-url:6379/0";

  const { getRedis } = await import("../lib/redis");
  await getRedis();

  expect(constructorArgs[0]).toBe("redis://db-url:6379/0");
});

it("falls back to env REDIS_URL when DB has none", async () => {
  envState.redisUrl = "redis://env-url:6379/0";

  const { getRedis } = await import("../lib/redis");
  await getRedis();

  expect(constructorArgs[0]).toBe("redis://env-url:6379/0");
});

it("builds from parts when no REDIS_URL is set", async () => {
  envState.redisUrl = "";

  const { getRedis } = await import("../lib/redis");
  await getRedis();

  expect(constructorArgs[0]).toMatchObject({
    host: "localhost",
    port: 6379,
    db: 0,
  });
});
