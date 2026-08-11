import type { Context, Next } from "hono";
import type { ClientErrorStatusCode } from "hono/utils/http-status";
import { getDb } from "../../queries/connection";
import { settings } from "@db/schema";
import { inArray } from "drizzle-orm";
import { env } from "../env";
import { getRedis } from "../redis";
import {
  checkCircuitBreaker,
  recordFailure,
  recordSuccess,
  getCircuitBreaker,
  resetCircuitBreaker as resetCB,
} from "./circuitBreaker";
import { createInMemoryStore, triggerCleanup } from "./memStore";
import {
  getClientIp,
  getRequestCost,
  normalizeIp,
  resolveClientIpFromHeaders,
} from "./ipUtils";
import { expandIpv6, createCidrMatcher, isTrustedProxy } from "./cidr";

const DEFAULT_WINDOW_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const BLOCK_DURATIONS_SEC = [300, 1200, 3600];
const BLOCK_DECAY_MULTIPLIER = 2;

const memStore = createInMemoryStore();

export function cleanupExpiredEntries(): void {
  triggerCleanup(memStore);
}

let cleanupTimer: ReturnType<typeof setInterval> | undefined;

function startCleanup(): void {
  if (!cleanupTimer)
    cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

function stopCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = undefined;
  }
}

function memFallback(ip: string, max: number, windowMs: number) {
  const now = Date.now();
  let entry = memStore.get(ip);

  if (
    !entry ||
    (entry.windowResetAt <= now &&
      entry.blockedUntil <= now &&
      entry.violationResetAt <= now)
  ) {
    entry = {
      count: 0,
      windowResetAt: now + windowMs,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: 0,
    };
  }

  if (entry.blockedUntil > now) {
    const blockSec = Math.ceil((entry.blockedUntil - now) / 1000);
    memStore.set(ip, entry);
    return {
      count: entry.count,
      remaining: 0,
      reset: Math.floor(entry.blockedUntil / 1000),
      retryAfter: blockSec,
      limited: true,
      violationCount: entry.violationCount,
    };
  }

  if (entry.windowResetAt <= now) {
    entry.windowResetAt = now + windowMs;
    entry.count = 0;
  }

  entry.count = (entry.count || 0) + 1;
  let limited = false;
  let resetSeconds: number;
  if (entry.count > max) {
    entry.violationCount = (entry.violationCount || 0) + 1;
    const idx = Math.min(
      entry.violationCount - 1,
      BLOCK_DURATIONS_SEC.length - 1
    );
    const blockSec = BLOCK_DURATIONS_SEC[idx];
    entry.blockedUntil = now + blockSec * 1000;
    entry.violationResetAt = now + blockSec * 1000 * BLOCK_DECAY_MULTIPLIER;
    limited = true;
    resetSeconds = Math.ceil(blockSec);
  } else {
    resetSeconds = Math.ceil((entry.windowResetAt - now) / 1000);
  }
  memStore.set(ip, entry);
  return {
    count: entry.count,
    remaining: Math.max(0, max - entry.count),
    reset: Math.floor((entry.blockedUntil || entry.windowResetAt) / 1000),
    retryAfter: limited ? resetSeconds : 0,
    limited,
    violationCount: entry.violationCount,
  };
}

interface RedisLike {
  eval: (
    script: string,
    numkeys: number,
    ...args: (string | number)[]
  ) => Promise<unknown>;
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

  while (true) {
    try {
      const countKey = `rl:${ip}`;
      const windowMs = windowSec * 1000;

      const luaScript = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        local ttl = redis.call('PTTL', KEYS[1])
        return {count, ttl}
      `;

      const raw = await redis.eval(luaScript, 1, countKey, windowMs);
      if (!Array.isArray(raw) || raw.length !== 2)
        throw new Error("Invalid Redis rate-limit response");
      const [newCount, ttlMs] = raw.map(Number);
      if (
        !Number.isFinite(newCount) ||
        newCount < 0 ||
        !Number.isFinite(ttlMs) ||
        ttlMs < 0
      ) {
        throw new Error("Invalid Redis rate-limit response");
      }
      const ttl = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : windowSec;

      const limited = newCount > max;

      recordSuccess();
      return {
        count: newCount,
        remaining: Math.max(0, max - newCount),
        reset: Math.floor(Date.now() / 1000) + ttl,
        retryAfter: limited ? ttl : 0,
        limited,
      };
    } catch (err) {
      retries++;
      recordFailure();
      if (retries >= maxRetries) {
        throw new Error("Max retries exceeded", { cause: err });
      }
      const delay =
        retryDelayMs !== null ? retryDelayMs : 100 * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function isExemptRoute(
  path: string,
  exemptRoutes: string[] = ["/health", "/status", "/favicon.ico"]
): boolean {
  return exemptRoutes.includes(path);
}

export function createRateLimiter({
  enabled = true,
  max = 100,
  windowMs = DEFAULT_WINDOW_MS,
  exemptRoutes = ["/health", "/status", "/favicon.ico"],
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

  if (!enabled)
    return async (_c: Context, next: Next) => {
      await next();
    };

  return async function rateLimiter(c: Context, next: Next) {
    const path = c.req.path;
    if (isExemptRoute(path, exemptRoutes)) {
      await next();
      return;
    }

    const ip = getClientIp(c, env.trustedProxyCidrs);
    const cost = getRequestCost(c.req.method);
    const effectiveMax = Math.max(1, Math.floor(max / cost));

    let info;
    let usingRedis = false;
    try {
      const redis = await getRedis();
      if (redis) {
        info = await checkRedis(
          redis,
          ip,
          effectiveMax,
          windowSec,
          retryDelayMs
        );
        usingRedis = true;
      } else {
        info = memFallback(ip, effectiveMax, windowMs);
      }
    } catch (err) {
      logger.error(
        "Redis error, falling back to memory",
        (err as Error).message
      );
      info = memFallback(ip, effectiveMax, windowMs);
    }

    c.header("X-RateLimit-Limit", String(effectiveMax));
    c.header("X-RateLimit-Remaining", String(info.remaining));
    c.header("X-RateLimit-Reset", String(info.reset));
    c.header("X-RateLimit-Store", usingRedis ? "redis" : "memory");

    if (info.limited) {
      logger.warn("Rate limit exceeded", {
        ip,
        path,
        retryAfter: info.retryAfter,
      });
      c.header("Retry-After", String(info.retryAfter));
      return c.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Max ${max} requests per ${windowSec}s window.`,
          retryAfter: info.retryAfter,
        },
        429 as ClientErrorStatusCode
      );
    }

    await next();
  };
}

let configCache: { enabled: boolean; max: number; windowMs: number } | null =
  null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL_MS = 10_000;

async function loadDbConfig(): Promise<{
  enabled: boolean;
  max: number;
  windowMs: number;
}> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(settings)
      .where(
        inArray(settings.key, [
          "RATE_LIMIT_ENABLED",
          "RATE_LIMIT_MAX_REQUESTS",
          "RATE_LIMIT_WINDOW_MS",
        ])
      )
      .all();
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    return {
      enabled:
        map.RATE_LIMIT_ENABLED !== undefined
          ? map.RATE_LIMIT_ENABLED === "true"
          : env.rateLimitEnabled,
      max:
        map.RATE_LIMIT_MAX_REQUESTS !== undefined
          ? parseInt(map.RATE_LIMIT_MAX_REQUESTS, 10) ||
            env.rateLimitMaxRequests
          : env.rateLimitMaxRequests,
      windowMs:
        map.RATE_LIMIT_WINDOW_MS !== undefined
          ? parseInt(map.RATE_LIMIT_WINDOW_MS, 10) || env.rateLimitWindowMs
          : env.rateLimitWindowMs,
    };
  } catch {
    return {
      enabled: env.rateLimitEnabled,
      max: env.rateLimitMaxRequests,
      windowMs: env.rateLimitWindowMs,
    };
  }
}

function getCachedConfigSync(): {
  enabled: boolean;
  max: number;
  windowMs: number;
} | null {
  if (configCache && Date.now() - configCacheTime < CONFIG_CACHE_TTL_MS)
    return configCache;
  return null;
}

async function getConfig(): Promise<{
  enabled: boolean;
  max: number;
  windowMs: number;
}> {
  const cached = getCachedConfigSync();
  if (cached) return cached;
  configCache = await loadDbConfig();
  configCacheTime = Date.now();
  return configCache;
}

export const rateLimitMiddleware = async (c: Context, next: Next) => {
  const cfg = await getConfig();
  if (!cfg.enabled) {
    await next();
    return;
  }
  return createRateLimiter({
    enabled: true,
    max: cfg.max,
    windowMs: cfg.windowMs,
  })(c, next);
};

export {
  memFallback,
  checkRedis,
  getClientIp,
  getRequestCost,
  isExemptRoute,
  normalizeIp,
  resolveClientIpFromHeaders,
  expandIpv6,
  createCidrMatcher,
  isTrustedProxy,
  getCircuitBreaker,
  resetCB as resetCircuitBreaker,
  startCleanup,
  stopCleanup,
  triggerCleanup,
};

export function getMemStore() {
  return memStore;
}

export function resetMemStore() {
  memStore.clear();
}

export function resetConfigCache() {
  configCache = null;
  configCacheTime = 0;
}
