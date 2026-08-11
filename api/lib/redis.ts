import Redis from "ioredis";
import type { RedisOptions } from "ioredis";
import { eq } from "drizzle-orm";
import { env } from "./env";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";

let initPromise: Promise<Redis | null> | null = null;

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) return null;
    return Math.min(times * 100, 1000);
  },
};

async function loadRedisUrlFromDb(): Promise<string | undefined> {
  try {
    const db = getDb();
    const row = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "REDIS_URL"))
      .get();
    const url = row?.value?.trim();
    return url || undefined;
  } catch {
    return undefined;
  }
}

export async function getRedis(): Promise<Redis | null> {
  if (!env.redisEnabled) return null;
  if (!initPromise) {
    initPromise = (async () => {
      const dbUrl = await loadRedisUrlFromDb();
      const url = dbUrl ?? env.redisUrl;
      const client = url
        ? new Redis(url, redisOptions)
        : new Redis({
            host: env.redisHost,
            port: env.redisPort,
            password: env.redisPassword || undefined,
            db: env.redisDb,
            ...redisOptions,
          });
      client.on("error", err => {
        console.warn("Redis connection error:", err.message);
      });
      return client;
    })();
  }
  return initPromise;
}

export async function getCache(key: string): Promise<string | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (err) {
    console.warn("Redis getCache error:", err);
    return null;
  }
}

export async function setCache(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    const ttl = ttlSeconds ?? env.cacheTtlSeconds;
    await redis.setex(key, ttl, value);
  } catch (err) {
    console.warn("Redis setCache error:", err);
  }
}

export async function deleteCache(key: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.warn("Redis deleteCache error:", err);
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.warn("Redis invalidateCache error:", err);
  }
}
