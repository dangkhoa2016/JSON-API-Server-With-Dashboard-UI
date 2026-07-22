import type { Context, Next } from "hono";
import type { ClientErrorStatusCode } from "hono/utils/http-status";
import { env } from "./env";
import { getRedis } from "./redis";

const DEFAULT_WINDOW_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const BLOCK_DURATIONS_SEC = [300, 1200, 3600];
const BLOCK_TRACKING_KEY_PREFIX = "rl:block:";
const MAX_MEM_ENTRIES = 10000;

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailure: number;
  resetTimeout: number;
}

const circuitBreaker: CircuitBreakerState = {
  isOpen: false,
  failureCount: 0,
  lastFailure: 0,
  resetTimeout: 30000,
};

const TRUSTED_PROXIES = ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

const REQUEST_COST: Record<string, number> = {
  GET: 1,
  HEAD: 1,
  POST: 2,
  PUT: 2,
  PATCH: 2,
  DELETE: 3,
};

interface MemEntry {
  count: number;
  resetAt: number;
  violationCount: number;
}

function expandIpv6(ip: string): string {
  const full = ip.includes('::')
    ? ip.replace('::', ':' + '0'.repeat(8 * 2 - (ip.split(':').length - 1) * 4) + ':')
    : ip;
  return full.split(':').map(h => h.padStart(4, '0')).join('');
}

function createCidrMatcher(cidr: string): (testIp: string) => boolean {
  const [ip, bits] = cidr.split('/');
  const maskBits = parseInt(bits!, 10);
  const isV6 = ip.includes(':');
  if (isV6) {
    const hex = expandIpv6(ip);
    const networkBytes = Buffer.from(hex.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
    const maskBytes = Buffer.alloc(16, 0);
    for (let i = 0; i < maskBits; i++) maskBytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
    return (testIp: string): boolean => {
      const testHex = expandIpv6(testIp);
      const testBytes = Buffer.from(testHex.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
      for (let i = 0; i < 16; i++) {
        if ((testBytes[i] & maskBytes[i]) !== (networkBytes[i] & maskBytes[i])) return false;
      }
      return true;
    };
  }
  const mask = ~(2 ** (32 - maskBits) - 1) >>> 0;
  const ipParts = ip.split('.').map(Number);
  const networkInt = ((ipParts[0] << 24 | ipParts[1] << 16 | ipParts[2] << 8 | ipParts[3]) & mask) >>> 0;
  return (testIp: string): boolean => {
    const testParts = testIp.split('.').map(Number);
    const testInt = (testParts[0] << 24 | testParts[1] << 16 | testParts[2] << 8 | testParts[3]) >>> 0;
    return (testInt & mask) >>> 0 === networkInt;
  };
}

function isTrustedProxy(ip: string | null | undefined): boolean {
  if (!ip || ip === 'unknown') return false;
  return TRUSTED_PROXIES.some(cidr => {
    try {
      if (!cidr.includes('/')) return ip === cidr;
      const matcher = createCidrMatcher(cidr);
      return matcher(ip);
    } catch /* v8 ignore next */ {
      return false;
    }
  });
}

function createInMemoryStore() {
  const mem = new Map<string, MemEntry>();
  function touch(key: string) {
    const v = mem.get(key);
    if (!v) return;
    mem.delete(key);
    mem.set(key, v);
  }
  function ensureLimit() {
    while (mem.size > MAX_MEM_ENTRIES) {
      const firstKey = mem.keys().next().value!;
      mem.delete(firstKey);
    }
  }
  return {
    get: (k: string) => { touch(k); return mem.get(k); },
    set: (k: string, v: MemEntry) => { mem.set(k, v); ensureLimit(); },
    delete: (k: string) => mem.delete(k),
    entries: () => mem.entries(),
    size: () => mem.size,
    clear: () => mem.clear(),
  };
}

const memStore = createInMemoryStore();

function triggerCleanup() {
  const now = Date.now();
  for (const [ip, entry] of memStore.entries()) {
    if (entry.resetAt <= now) memStore.delete(ip);
  }
}

const cleanupTimer = setInterval(triggerCleanup, CLEANUP_INTERVAL_MS);

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

function normalizeIp(ip: string | null | undefined): string {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.startsWith('::ffff:')) return ip.substring(7);
  return ip.toLowerCase();
}

function getClientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for') || '';
  const ips = xff.split(',').map(ip => normalizeIp(ip.trim())).filter(ip => ip && ip !== 'unknown');
  const remoteAddress = normalizeIp(
    (c.env as { incoming?: { socket?: { remoteAddress?: string } } | undefined })?.incoming?.socket?.remoteAddress ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
  if (isTrustedProxy(remoteAddress)) {
    return ips[0] || remoteAddress;
  }
  if (remoteAddress === 'unknown' && ips.length > 0) {
    return ips[0];
  }
  return remoteAddress;
}

function getRequestCost(method: string): number {
  return REQUEST_COST[method] || 1;
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
  if (circuitBreaker.isOpen) {
    if (Date.now() - circuitBreaker.lastFailure > circuitBreaker.resetTimeout) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
    } else {
      throw new Error('Circuit breaker open - Redis unavailable');
    }
  }

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

      circuitBreaker.failureCount = 0;
      return {
        count: newCount,
        remaining: Math.max(0, max - newCount),
        reset: ttl,
        retryAfter: limited ? ttl : 0,
        limited,
      };
    } catch (err) {
      retries++;
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailure = Date.now();
      if (circuitBreaker.failureCount >= 3) {
        circuitBreaker.isOpen = true;
      }
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

function createRateLimiter({
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

function getCircuitBreaker(): CircuitBreakerState {
  return circuitBreaker;
}

function resetCircuitBreaker(): void {
  circuitBreaker.isOpen = false;
  circuitBreaker.failureCount = 0;
  circuitBreaker.lastFailure = 0;
}

function getMemStore() {
  return memStore;
}

function resetMemStore(): void {
  memStore.clear();
}

export const rateLimitMiddleware = createRateLimiter({
  enabled: env.rateLimitEnabled,
  max: env.rateLimitMaxRequests,
  windowMs: env.rateLimitWindowMs,
});

export {
  createRateLimiter,
  memFallback,
  checkRedis,
  getClientIp,
  isTrustedProxy,
  getRequestCost,
  isExemptRoute,
  normalizeIp,
  expandIpv6,
  createCidrMatcher,
  triggerCleanup,
  stopCleanup,
  getCircuitBreaker,
  resetCircuitBreaker,
  getMemStore,
  resetMemStore,
};
