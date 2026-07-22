import Redis from "ioredis";
import { env } from "./env";

let redisInstance: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.redisEnabled) return null;
  if (!redisInstance) {
    redisInstance = new Redis({
      host: env.redisHost,
      port: env.redisPort,
      password: env.redisPassword || undefined,
      db: env.redisDb,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
    });
    redisInstance.on("error", (err) => {
      console.warn("Redis connection error:", err.message);
    });
  }
  return redisInstance;
}

export async function getCache(key: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (err) {
    console.warn("Redis getCache error:", err);
    return null;
  }
}

export async function setCache(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const ttl = ttlSeconds ?? env.cacheTtlSeconds;
    await redis.setex(key, ttl, value);
  } catch (err) {
    console.warn("Redis setCache error:", err);
  }
}

export async function deleteCache(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.warn("Redis deleteCache error:", err);
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.warn("Redis invalidateCache error:", err);
  }
}
