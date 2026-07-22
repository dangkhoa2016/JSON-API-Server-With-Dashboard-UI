import type { Context, Next } from "hono";
import type { ClientErrorStatusCode } from "hono/utils/http-status";
import { env } from "../env";
import { getRedis } from "../redis";
import { checkCircuitBreaker, recordFailure, recordSuccess, getCircuitBreaker, resetCircuitBreaker as resetCB } from "./circuitBreaker";
import { createInMemoryStore, triggerCleanup } from "./memStore";
import { getClientIp, getRequestCost, normalizeIp } from "./ipUtils";
import { expandIpv6, createCidrMatcher, isTrustedProxy } from "./cidr";

const DEFAULT_WINDOW_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const BLOCK_DURATIONS_SEC = [300, 1200, 3600];

const memStore = createInMemoryStore();

export function cleanupExpiredEntries(): void {
  triggerCleanup(memStore);
}

const cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);

function stopCleanup(): void {
  clearInterval(cleanupTimer);
}

function memFallback(ip: string, max: number, windowMs: number) {
  const now = Date.now();
  let entry = memStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    const prevViolation = entry ? (entry.violationCount || 0) : 0;
    entry = { count: 0, resetAt: now + windowMs, violationCount: prevViolation };
  }
  entry.count = (entry.count || 0) + 1;
  let limited = false;
  let resetSeconds: number;
  if (entry.count > max) {
    entry.violationCount = (entry.violationCount || 0) + 1;
    const idx = Math.min(entry.violationCount - 1, BLOCK_DURATIONS_SEC.length - 1);
    const blockSec = BLOCK_DURATIONS_SEC[idx];
    entry.resetAt = now + blockSec * 1000;
    limited = true;
    resetSeconds = Math.ceil(blockSec);
  } else {
    resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
  }
  memStore.set(ip, entry);
  return {
    count: entry.count,
    remaining: Math.max(0, max - entry.count),
    reset: Math.floor(entry.resetAt / 1000),
    retryAfter: limited ? resetSeconds : 0,
    limited,
    violationCount: entry.violationCount,
  };
}

interface RedisPipeline {
  get: (key: string) => unknown;
  ttl: (key: string) => unknown;
  exec: () => Promise<Array<[null, string | null] | [null, number]>>;
}

interface RedisLike {
  pipeline: () => RedisPipeline;
  setex: (key: string, ttl: number, value: string | number) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
}

async function checkRedis(
  redis: RedisLike,
  ip: string,
  max: number,
  windowSec: number,
  retryDelayMs: number | null = null
) {
  checkCircuitBreaker();

  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const countKey = `rl:${ip}`;
      const pipeline = redis.pipeline();
      pipeline.get(countKey);
      pipeline.ttl(countKey);
      const results = await pipeline.exec();

      const countStr = results[0][1];
      const ttlVal = results[1][1];

      const count = countStr !== null ? parseInt(countStr, 10) : 0;
      const ttl = ttlVal !== null && ttlVal > 0 ? ttlVal : windowSec;

      let newCount: number;

      if (count === 0) {
        await redis.setex(countKey, ttl, 1);
        newCount = 1;
      } else {
        await redis.incr(countKey);
        newCount = count + 1;
      }

      const limited = newCount > max;

      recordSuccess();
      return {
        count: newCount,
        remaining: Math.max(0, max - newCount),
        reset: ttl,
        retryAfter: limited ? ttl : 0,
        limited,
      };
    } catch (err) {
      retries++;
      recordFailure();
      if (retries >= maxRetries) {
        throw new Error('Max retries exceeded', { cause: err });
      }
      const delay = retryDelayMs !== null ? retryDelayMs : 100 * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /* v8 ignore next */
  throw new Error('Max retries exceeded');
}

function isExemptRoute(path: string, exemptRoutes: string[] = ['/health', '/status', '/favicon.ico']): boolean {
  return exemptRoutes.includes(path);
}

export function createRateLimiter({
  enabled = true,
  max = 100,
  windowMs = DEFAULT_WINDOW_MS,
  exemptRoutes = ['/health', '/status', '/favicon.ico'],
  logger = console,
  retryDelayMs = null,
}: {
  enabled?: boolean;
  max?: number;
  windowMs?: number;
  exemptRoutes?: string[];
  logger?: typeof console;
  retryDelayMs?: number | null;
} = {}) {

  const windowSec = Math.floor(windowMs / 1000);

  if (!enabled) return async (_c: Context, next: Next) => { await next(); };

  return async function rateLimiter(c: Context, next: Next) {
    const path = c.req.path;
    if (isExemptRoute(path, exemptRoutes)) {
      await next();
      return;
    }

    const ip = getClientIp(c);
    const cost = getRequestCost(c.req.method);
    const effectiveMax = Math.max(1, Math.floor(max / cost));

    let info;
    let usingRedis = false;
    try {
      const redis = getRedis();
      if (redis) {
        info = await checkRedis(redis, ip, effectiveMax, windowSec, retryDelayMs);
        usingRedis = true;
      } else {
        info = memFallback(ip, effectiveMax, windowMs);
      }
    } catch (err) {
      logger.error('Redis error, falling back to memory', (err as Error).message);
      info = memFallback(ip, effectiveMax, windowMs);
    }

    c.header('X-RateLimit-Limit', String(effectiveMax));
    c.header('X-RateLimit-Remaining', String(info.remaining));
    c.header('X-RateLimit-Reset', String(info.reset));
    c.header('X-RateLimit-Store', usingRedis ? 'redis' : 'memory');

    if (info.limited) {
      logger.warn('Rate limit exceeded', { ip, path, retryAfter: info.retryAfter });
      c.header('Retry-After', String(info.retryAfter));
      return c.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Max ${max} requests per ${windowSec}s window.`,
          retryAfter: info.retryAfter,
        },
        429 as ClientErrorStatusCode
      );
    }

    await next();
  };
}

export const rateLimitMiddleware = createRateLimiter({
  enabled: env.rateLimitEnabled,
  max: env.rateLimitMaxRequests,
  windowMs: env.rateLimitWindowMs,
});

export {
  memFallback,
  checkRedis,
  getClientIp,
  getRequestCost,
  isExemptRoute,
  normalizeIp,
  expandIpv6,
  createCidrMatcher,
  isTrustedProxy,
  getCircuitBreaker,
  resetCB as resetCircuitBreaker,
  stopCleanup,
  triggerCleanup,
};

export function getMemStore() { return memStore; }

export function resetMemStore() {
  memStore.clear();
}
