import type { Context, Next } from "hono";
import { env } from "./env";
import { getRedis } from "./redis";

// In-memory store for rate limiting when Redis is disabled
const memoryStore = new Map<string, { count: number; resetTime: number }>();

function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function checkMemoryRateLimit(
  store: Map<string, { count: number; resetTime: number }>,
  key: string,
  now: number,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const record = store.get(key);
  if (!record || now > record.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime };
}

async function checkRedisRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const redis = getRedis();
  const now = Date.now();
  const windowMs = env.rateLimitWindowMs;
  const maxRequests = env.rateLimitMaxRequests;
  const key = `ratelimit:${ip}`;

  if (!redis) {
    return checkMemoryRateLimit(memoryStore, key, now, windowMs, maxRequests);
  }

  try {
    const pipeline = redis.pipeline();
    pipeline.get(key);
    pipeline.ttl(key);
    const results = await pipeline.exec();
    const count = parseInt((results?.[0]?.[1] as string) || "0", 10);
    const ttl = (results?.[1]?.[1] as number) || 0;

    if (count === 0) {
      await redis.setex(key, Math.ceil(windowMs / 1000), "1");
      return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
    }

    if (count >= maxRequests) {
      return { allowed: false, remaining: 0, resetTime: now + ttl * 1000 };
    }

    await redis.incr(key);
    return { allowed: true, remaining: maxRequests - count - 1, resetTime: now + ttl * 1000 };
  } catch {
    console.warn("Redis rate-limit check failed, falling back to in-memory store");
    return checkMemoryRateLimit(memoryStore, key, now, windowMs, maxRequests);
  }
}

export async function rateLimitMiddleware(c: Context, next: Next) {
  if (!env.rateLimitEnabled) {
    await next();
    return;
  }

  const ip = getClientIp(c);
  const result = await checkRedisRateLimit(ip);

  c.header("X-RateLimit-Limit", String(env.rateLimitMaxRequests));
  c.header("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
  c.header("X-RateLimit-Reset", String(Math.ceil(result.resetTime / 1000)));

  if (!result.allowed) {
    return c.json(
      {
        error: "Too many requests",
        message: `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)}s`,
      },
      429
    );
  }

  await next();
}
