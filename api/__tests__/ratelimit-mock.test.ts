import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/env", () => ({
  env: {
    rateLimitEnabled: true,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 3,
    redisEnabled: false,
    cacheEnabled: false,
  },
}));

vi.mock("../lib/redis", () => ({
  getRedis: () => null,
}));

import {
  createRateLimiter,
  memFallback,
  getClientIp,
  isTrustedProxy,
  getRequestCost,
  isExemptRoute,
  normalizeIp,
  expandIpv6,
  createCidrMatcher,
  resetCircuitBreaker,
  getMemStore,
  resetMemStore,
  triggerCleanup,
} from "../lib/ratelimit";

function createMockContext(ip?: string, opts: { remoteAddr?: string; xRealIp?: string; path?: string; method?: string } = {}) {
  const headers = new Map<string, string>();
  if (ip) headers.set("x-forwarded-for", ip);
  if (opts.xRealIp) headers.set("x-real-ip", opts.xRealIp);
  const remoteAddr = opts.remoteAddr !== undefined ? opts.remoteAddr : ip ? '127.0.0.1' : '';
  const env = remoteAddr ? { incoming: { socket: { remoteAddress: remoteAddr } } } : {} as any;

  return {
    req: {
      header: (name: string) => headers.get(name.toLowerCase()) ?? null,
      raw: new Request("http://test.com"),
      path: opts.path || "/test",
      method: opts.method || "GET",
    },
    env,
    header: vi.fn(),
    json: vi.fn().mockReturnValue({} as any),
    body: vi.fn(),
    newResponse: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    res: new Response(),
    event: {} as any,
    executionCtx: {} as any,
    var: {},
    pretty: vi.fn(),
    redirect: vi.fn(),
    notFound: vi.fn(),
  } as any;
}

describe("Rate Limiter Middleware - Memory mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
    resetMemStore();
    vi.useRealTimers();
  });

  describe("createRateLimiter", () => {
    it("should skip when disabled", async () => {
      const limiter = createRateLimiter({ enabled: false });
      const next = vi.fn();
      await limiter({} as any, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should skip exempt routes", async () => {
      const limiter = createRateLimiter({ exemptRoutes: ['/health'] });
      const next = vi.fn();
      await limiter(createMockContext(undefined, { path: '/health' }), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should use effectiveMax for POST requests", async () => {
      const limiter = createRateLimiter({ max: 100 });
      const c = createMockContext("127.0.0.1", { method: "POST" });
      await limiter(c, vi.fn());
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", "50");
    });

    it("should use effectiveMax for DELETE requests", async () => {
      const limiter = createRateLimiter({ max: 30 });
      const c = createMockContext("127.0.0.1", { method: "DELETE" });
      await limiter(c, vi.fn());
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
    });

    it("should use effectiveMax for PATCH requests", async () => {
      const limiter = createRateLimiter({ max: 100 });
      const c = createMockContext("127.0.0.1", { method: "PATCH" });
      await limiter(c, vi.fn());
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", "50");
    });

    it("should handle invalid IP", async () => {
      const logger = { warn: vi.fn(), error: vi.fn() };
      const limiter = createRateLimiter({ logger: logger as any });
      const c = createMockContext(undefined, { remoteAddr: "" });
      const next = vi.fn();
      await limiter(c, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should call next when not rate limited", async () => {
      const limiter = createRateLimiter({ max: 100 });
      const c = createMockContext("127.0.0.1");
      const next = vi.fn();
      await limiter(c, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should set X-RateLimit-Store to memory", async () => {
      const limiter = createRateLimiter();
      const c = createMockContext("127.0.0.1");
      await limiter(c, vi.fn());
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Store", "memory");
    });

    it("should reject requests exceeding rate limit with 429", async () => {
      const limiter = createRateLimiter({ max: 1 });
      const c1 = createMockContext("5.6.7.8");
      await limiter(c1, vi.fn());

      const c2 = createMockContext("5.6.7.8");
      const next = vi.fn();
      await limiter(c2, next);
      expect(next).not.toHaveBeenCalled();
      expect(c2.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Too many requests" }),
        429
      );
    });

    it("should set correct headers when rate limited", async () => {
      const limiter = createRateLimiter({ max: 1 });
      await limiter(createMockContext("1.2.3.4"), vi.fn());
      const c2 = createMockContext("1.2.3.4");
      await limiter(c2, vi.fn());
      expect(c2.header).toHaveBeenCalledWith("X-RateLimit-Limit", "1");
      expect(c2.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
      expect(c2.header).toHaveBeenCalledWith("Retry-After", expect.any(String));
    });
  });

  describe("createRateLimiter - flow control", () => {
    it("should allow 3 requests and block the 4th with max=3", async () => {
      const limiter = createRateLimiter({ max: 3 });
      const ip = "9.9.9.9";

      for (let i = 0; i < 3; i++) {
        const c = createMockContext(ip);
        const next = vi.fn();
        await limiter(c, next);
        expect(next).toHaveBeenCalledTimes(1);
      }

      const c4 = createMockContext(ip);
      const next4 = vi.fn();
      await limiter(c4, next4);
      expect(next4).not.toHaveBeenCalled();
      expect(c4.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Too many requests" }),
        429
      );
    });

    it("should use x-forwarded-for header for client IP", async () => {
      const limiter = createRateLimiter({ max: 3 });
      const c = createMockContext("10.0.0.1");
      const next = vi.fn();
      await limiter(c, next);
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("memFallback", () => {
    beforeEach(() => {
      resetMemStore();
      vi.useFakeTimers();
    });

    it("should reset count on new window", () => {
      const info1 = memFallback('127.0.0.1', 10, 60000);
      expect(info1.count).toBe(1);
      vi.advanceTimersByTime(61000);
      const info2 = memFallback('127.0.0.1', 10, 60000);
      expect(info2.count).toBe(1);
    });

    it("should increase count within window", () => {
      const info1 = memFallback('127.0.0.1', 10, 60000);
      expect(info1.count).toBe(1);
      const info2 = memFallback('127.0.0.1', 10, 60000);
      expect(info2.count).toBe(2);
    });

    it("should set limited=true when rate limit exceeded", () => {
      memFallback('127.0.0.1', 1, 60000);
      const info2 = memFallback('127.0.0.1', 1, 60000);
      expect(info2.limited).toBe(true);
    });

    it("should track remaining requests", () => {
      const info1 = memFallback('127.0.0.1', 10, 60000);
      expect(info1.remaining).toBe(9);
      const info2 = memFallback('127.0.0.1', 10, 60000);
      expect(info2.remaining).toBe(8);
    });

    it("should increment violationCount on violation", () => {
      const info1 = memFallback('127.0.0.1', 1, 60000);
      expect(info1.violationCount).toBe(0);
      const info2 = memFallback('127.0.0.1', 1, 60000);
      expect(info2.violationCount).toBe(1);
      const info3 = memFallback('127.0.0.1', 1, 60000);
      expect(info3.violationCount).toBe(2);
    });

    it("should carry over violationCount after window expires", () => {
      memFallback('127.0.0.1', 1, 60000);
      const info2 = memFallback('127.0.0.1', 1, 60000);
      expect(info2.violationCount).toBe(1);
      vi.advanceTimersByTime(301000);
      const info3 = memFallback('127.0.0.1', 1, 60000);
      expect(info3.violationCount).toBe(1);
    });

    it("should use escalating retryAfter values", () => {
      memFallback('127.0.0.1', 1, 60000);
      const info2 = memFallback('127.0.0.1', 1, 60000);
      expect(info2.retryAfter).toBe(300);
      const info3 = memFallback('127.0.0.1', 1, 60000);
      expect(info3.retryAfter).toBe(1200);
    });
  });

  describe("getClientIp", () => {
    it("should extract IP from X-Forwarded-For with trusted proxy", () => {
      const c = createMockContext("10.0.1.5, 192.168.1.1", { remoteAddr: "127.0.0.1" });
      expect(getClientIp(c)).toBe("10.0.1.5");
    });

    it("should use remoteAddress when not from trusted proxy", () => {
      const c = createMockContext("192.168.1.1", { remoteAddr: "203.0.113.1" });
      expect(getClientIp(c)).toBe("203.0.113.1");
    });

    it("should handle IPv6-mapped IPv4", () => {
      const c = createMockContext(undefined, { remoteAddr: "::ffff:192.168.1.1" });
      expect(getClientIp(c)).toBe("192.168.1.1");
    });

    it("should preserve pure IPv6 addresses", () => {
      const c = createMockContext(undefined, { remoteAddr: "2001:db8::1" });
      expect(getClientIp(c)).toBe("2001:db8::1");
    });

    it("should handle missing remoteAddress via unknown", () => {
      const c = createMockContext(undefined, { remoteAddr: "" });
      expect(getClientIp(c)).toBe("unknown");
    });

    it("should handle missing X-Forwarded-For header", () => {
      const c = createMockContext(undefined, { remoteAddr: "127.0.0.1" });
      expect(getClientIp(c)).toBe("127.0.0.1");
    });

    it("should lowercase IPv6", () => {
      const c = createMockContext(undefined, { remoteAddr: "2001:DB8::1" });
      expect(getClientIp(c)).toBe("2001:db8::1");
    });

    it("should return first IP from multiple X-Forwarded-For", () => {
      const c = createMockContext("1.2.3.4, 5.6.7.8, 9.10.11.12", { remoteAddr: "127.0.0.1" });
      expect(getClientIp(c)).toBe("1.2.3.4");
    });

    it("should use x-real-ip when no remoteAddress or x-forwarded-for", () => {
      const c = createMockContext(undefined, { xRealIp: "10.0.0.5" });
      expect(getClientIp(c)).toBe("10.0.0.5");
    });

    it("should use x-forwarded-for when remoteAddress is unknown", () => {
      const c = createMockContext("5.6.7.8", { remoteAddr: "" });
      expect(getClientIp(c)).toBe("5.6.7.8");
    });
  });

  describe("isTrustedProxy", () => {
    it("should match localhost IPv4", () => {
      expect(isTrustedProxy('127.0.0.1')).toBe(true);
    });

    it("should match IPv6 localhost", () => {
      expect(isTrustedProxy('::1')).toBe(true);
    });

    it("should match 10.0.0.0/8 range", () => {
      expect(isTrustedProxy('10.0.0.5')).toBe(true);
      expect(isTrustedProxy('10.255.255.255')).toBe(true);
    });

    it("should match 172.16.0.0/12 range", () => {
      expect(isTrustedProxy('172.16.0.1')).toBe(true);
      expect(isTrustedProxy('172.31.255.255')).toBe(true);
    });

    it("should match 192.168.0.0/16 range", () => {
      expect(isTrustedProxy('192.168.1.1')).toBe(true);
    });

    it("should not match IPs outside trusted ranges", () => {
      expect(isTrustedProxy('8.8.8.8')).toBe(false);
      expect(isTrustedProxy('172.15.0.1')).toBe(false);
    });

    it("should handle invalid inputs", () => {
      expect(isTrustedProxy(null)).toBe(false);
      expect(isTrustedProxy('unknown')).toBe(false);
      expect(isTrustedProxy('')).toBe(false);
    });
  });

  describe("getRequestCost", () => {
    it("should return 1 for GET", () => expect(getRequestCost('GET')).toBe(1));
    it("should return 1 for HEAD", () => expect(getRequestCost('HEAD')).toBe(1));
    it("should return 2 for POST", () => expect(getRequestCost('POST')).toBe(2));
    it("should return 2 for PUT", () => expect(getRequestCost('PUT')).toBe(2));
    it("should return 2 for PATCH", () => expect(getRequestCost('PATCH')).toBe(2));
    it("should return 3 for DELETE", () => expect(getRequestCost('DELETE')).toBe(3));
    it("should return 1 for unknown methods", () => {
      expect(getRequestCost('UNKNOWN')).toBe(1);
      expect(getRequestCost('OPTIONS')).toBe(1);
    });
  });

  describe("isExemptRoute", () => {
    it("should exempt health, status, favicon", () => {
      expect(isExemptRoute('/health')).toBe(true);
      expect(isExemptRoute('/status')).toBe(true);
      expect(isExemptRoute('/favicon.ico')).toBe(true);
    });

    it("should not exempt other routes", () => {
      expect(isExemptRoute('/api/users')).toBe(false);
    });
  });

  describe("normalizeIp", () => {
    it("should return unknown for null/undefined/unknown", () => {
      expect(normalizeIp(null)).toBe('unknown');
      expect(normalizeIp(undefined)).toBe('unknown');
      expect(normalizeIp('unknown')).toBe('unknown');
    });

    it("should convert IPv6-mapped IPv4", () => {
      expect(normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
    });

    it("should lowercase", () => {
      expect(normalizeIp('::1')).toBe('::1');
      expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1');
    });
  });

  describe("memStore internal operations", () => {
    beforeEach(() => {
      resetMemStore();
    });

    it("should track size correctly", () => {
      const store = getMemStore();
      expect(store.size()).toBe(0);
      store.set('192.168.1.1', { count: 1, resetAt: Date.now() + 60000, violationCount: 0 });
      expect(store.size()).toBe(1);
      store.set('192.168.1.2', { count: 2, resetAt: Date.now() + 60000, violationCount: 0 });
      expect(store.size()).toBe(2);
      store.delete('192.168.1.1');
      expect(store.size()).toBe(1);
    });

    it("should handle entries iteration", () => {
      const store = getMemStore();
      store.set('192.168.1.1', { count: 1, resetAt: Date.now() + 60000, violationCount: 0 });
      store.set('192.168.1.2', { count: 2, resetAt: Date.now() + 60000, violationCount: 0 });
      const count = [...store.entries()].length;
      expect(count).toBe(2);
    });

    it("should trigger LRU eviction when exceeding max entries", () => {
      const store = getMemStore();
      for (let i = 0; i < 10001; i++) {
        store.set(`ip${i}`, { count: i, resetAt: Date.now() + 60000, violationCount: 0 });
      }
      expect(store.size()).toBeLessThanOrEqual(10000);
    });

    it("should cleanup expired entries via triggerCleanup", () => {
      const store = getMemStore();
      store.set('192.168.1.1', { count: 1, resetAt: Date.now() - 1000, violationCount: 0 });
      store.set('192.168.1.2', { count: 2, resetAt: Date.now() + 60000, violationCount: 0 });
      expect(store.size()).toBe(2);
      triggerCleanup(store);
      expect(store.size()).toBe(1);
    });

    it("should support LRU touch on get", () => {
      const store = getMemStore();
      store.set('key1', { count: 1, resetAt: Date.now() + 60000, violationCount: 0 });
      store.set('key2', { count: 2, resetAt: Date.now() + 60000, violationCount: 0 });
      store.get('key1');
    });

    it("should have all expected methods on memStore", () => {
      const store = getMemStore();
      expect(typeof store.get).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.delete).toBe('function');
      expect(typeof store.entries).toBe('function');
      expect(typeof store.size).toBe('function');
      expect(typeof store.clear).toBe('function');
    });
  });

  describe("expandIpv6", () => {
    it("should expand double-colon shorthand", () => {
      const result = expandIpv6("::1");
      expect(result).toBe("0000000000000001");
    });

    it("should expand fe80::1", () => {
      const result = expandIpv6("fe80::1");
      expect(result).toBe("fe80000000000001");
    });

    it("should pad segments without double-colon", () => {
      const result = expandIpv6("2001:db8::1");
      expect(result).toBe("20010db800000001");
    });

    it("should handle full IPv6 address", () => {
      const result = expandIpv6("2001:0db8:0000:0000:0000:0000:0000:0001");
      expect(result).toBe("20010db8000000000000000000000001");
    });
  });

  describe("createCidrMatcher with IPv6", () => {
    it("should match IPv6 address in /128 CIDR", () => {
      const matcher = createCidrMatcher("::1/128");
      expect(matcher("::1")).toBe(true);
      expect(matcher("::2")).toBe(false);
    });

    it("should match IPv6 address in full-form /128 CIDR", () => {
      const matcher = createCidrMatcher("2001:0db8:0000:0000:0000:0000:0000:0001/128");
      expect(matcher("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(true);
      expect(matcher("2001:0db8:0000:0000:0000:0000:0000:0002")).toBe(false);
    });

    it("should match IPv6 address in /32 CIDR", () => {
      const matcher = createCidrMatcher("2001:0db8:0000:0000:0000:0000:0000:0000/32");
      expect(matcher("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(true);
      expect(matcher("2001:0db9:0000:0000:0000:0000:0000:0001")).toBe(false);
    });
  });
});
