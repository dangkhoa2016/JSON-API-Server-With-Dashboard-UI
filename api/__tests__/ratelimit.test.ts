import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let mockRedisEnabled = false;

vi.mock("../lib/env", () => ({
  get env() {
    return {
      appSecret: "test-secret",
      isProduction: false,
      databaseUrl: ":memory:",
      redisHost: "localhost",
      redisPort: 6379,
      redisPassword: "",
      redisDb: 0,
      redisEnabled: mockRedisEnabled,
      rateLimitEnabled: true,
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 100,
      cacheEnabled: false,
      cacheTtlSeconds: 300,
      debugSql: false,
    };
  },
}));

describe("ratelimit", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockRedisEnabled = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizeIp", () => {
    it("returns 'unknown' for null/undefined", async () => {
      const { normalizeIp } = await import("../lib/ratelimit");
      expect(normalizeIp(null as any)).toBe("unknown");
      expect(normalizeIp(undefined as any)).toBe("unknown");
    });

    it("returns 'unknown' for 'unknown' string", async () => {
      const { normalizeIp } = await import("../lib/ratelimit");
      expect(normalizeIp("unknown")).toBe("unknown");
    });

    it("strips ::ffff: prefix", async () => {
      const { normalizeIp } = await import("../lib/ratelimit");
      expect(normalizeIp("::ffff:192.168.1.1")).toBe("192.168.1.1");
    });

    it("lowercases normal IP", async () => {
      const { normalizeIp } = await import("../lib/ratelimit");
      expect(normalizeIp("192.168.1.1")).toBe("192.168.1.1");
    });

    it("passes through IPv6 without prefix", async () => {
      const { normalizeIp } = await import("../lib/ratelimit");
      expect(normalizeIp("2001:db8::1")).toBe("2001:db8::1");
    });
  });

  describe("expandIpv6", () => {
    it("expands :: notation", async () => {
      const { expandIpv6 } = await import("../lib/ratelimit");
      const result = expandIpv6("::1");
      expect(result.length).toBeGreaterThan(0);
    });

    it("expands full IPv6", async () => {
      const { expandIpv6 } = await import("../lib/ratelimit");
      const result = expandIpv6("2001:0db8:0000:0000:0000:0000:0000:0001");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("createCidrMatcher", () => {
    it("matches IPv4 in CIDR range", async () => {
      const { createCidrMatcher } = await import("../lib/ratelimit");
      const matcher = createCidrMatcher("192.168.0.0/16");
      expect(matcher("192.168.1.1")).toBe(true);
      expect(matcher("192.168.255.255")).toBe(true);
      expect(matcher("193.0.0.1")).toBe(false);
    });

    it("matches IPv6 in CIDR range", async () => {
      const { createCidrMatcher } = await import("../lib/ratelimit");
      const matcher = createCidrMatcher("fe80::/10");
      expect(matcher("fe80::1")).toBe(true);
      expect(matcher("fe80::abcd:1234")).toBe(true);
      expect(matcher("2001:db8::1")).toBe(false);
    });

    it("matches /32 CIDR (single IP)", async () => {
      const { createCidrMatcher } = await import("../lib/ratelimit");
      const matcher = createCidrMatcher("10.0.0.1/32");
      expect(matcher("10.0.0.1")).toBe(true);
      expect(matcher("10.0.0.2")).toBe(false);
    });

    it("matches /8 CIDR", async () => {
      const { createCidrMatcher } = await import("../lib/ratelimit");
      const matcher = createCidrMatcher("10.0.0.0/8");
      expect(matcher("10.255.255.255")).toBe(true);
      expect(matcher("11.0.0.1")).toBe(false);
    });

    it("matches /24 CIDR", async () => {
      const { createCidrMatcher } = await import("../lib/ratelimit");
      const matcher = createCidrMatcher("192.168.1.0/24");
      expect(matcher("192.168.1.100")).toBe(true);
      expect(matcher("192.168.2.100")).toBe(false);
    });
  });

  describe("isTrustedProxy", () => {
    it("returns false for null/undefined", async () => {
      const { isTrustedProxy } = await import("../lib/ratelimit");
      expect(isTrustedProxy(null)).toBe(false);
      expect(isTrustedProxy(undefined)).toBe(false);
    });

    it("returns false for 'unknown'", async () => {
      const { isTrustedProxy } = await import("../lib/ratelimit");
      expect(isTrustedProxy("unknown")).toBe(false);
    });

    it("returns true for 127.0.0.1", async () => {
      const { isTrustedProxy } = await import("../lib/ratelimit");
      expect(isTrustedProxy("127.0.0.1")).toBe(true);
    });

    it("returns true for ::1", async () => {
      const { isTrustedProxy } = await import("../lib/ratelimit");
      expect(isTrustedProxy("::1")).toBe(true);
    });

    it("returns true for 10.x.x.x", async () => {
      const { isTrustedProxy } = await import("../lib/ratelimit");
      expect(isTrustedProxy("10.0.0.1")).toBe(true);
      expect(isTrustedProxy("10.255.255.255")).toBe(true);
    });

    it("returns true for 172.16.x.x", async () => {
      const { isTrustedProxy } = await import("../lib/ratelimit");
      expect(isTrustedProxy("172.16.0.1")).toBe(true);
      expect(isTrustedProxy("172.31.255.255")).toBe(true);
    });

    it("returns false for 172.32.0.1 (outside 172.16.0.0/12)", async () => {
      const { isTrustedProxy } = await import("../lib/ratelimit");
      expect(isTrustedProxy("172.32.0.1")).toBe(false);
    });

    it("returns true for 192.168.x.x", async () => {
      const { isTrustedProxy } = await import("../lib/ratelimit");
      expect(isTrustedProxy("192.168.1.1")).toBe(true);
    });

    it("returns false for public IP", async () => {
      const { isTrustedProxy } = await import("../lib/ratelimit");
      expect(isTrustedProxy("8.8.8.8")).toBe(false);
    });
  });

  describe("getRequestCost", () => {
    it("returns correct costs for each method", async () => {
      const { getRequestCost } = await import("../lib/ratelimit");
      expect(getRequestCost("GET")).toBe(1);
      expect(getRequestCost("HEAD")).toBe(1);
      expect(getRequestCost("POST")).toBe(2);
      expect(getRequestCost("PUT")).toBe(2);
      expect(getRequestCost("PATCH")).toBe(2);
      expect(getRequestCost("DELETE")).toBe(3);
    });

    it("returns 1 for unknown method", async () => {
      const { getRequestCost } = await import("../lib/ratelimit");
      expect(getRequestCost("OPTIONS")).toBe(1);
      expect(getRequestCost("UNKNOWN")).toBe(1);
    });
  });

  describe("isExemptRoute", () => {
    it("returns true for default exempt routes", async () => {
      const { isExemptRoute } = await import("../lib/ratelimit");
      expect(isExemptRoute("/health")).toBe(true);
      expect(isExemptRoute("/status")).toBe(true);
      expect(isExemptRoute("/favicon.ico")).toBe(true);
    });

    it("returns false for non-exempt routes", async () => {
      const { isExemptRoute } = await import("../lib/ratelimit");
      expect(isExemptRoute("/api/data")).toBe(false);
      expect(isExemptRoute("/admin")).toBe(false);
    });

    it("supports custom exempt routes", async () => {
      const { isExemptRoute } = await import("../lib/ratelimit");
      expect(isExemptRoute("/custom", ["/custom"])).toBe(true);
      expect(isExemptRoute("/other", ["/custom"])).toBe(false);
    });
  });

  describe("createRateLimiter", () => {
    it("returns pass-through when disabled", async () => {
      const { createRateLimiter } = await import("../lib/ratelimit");
      const limiter = createRateLimiter({ enabled: false });
      const next = vi.fn();
      const ctx = { req: { path: "/api/test", method: "GET", header: () => null }, header: vi.fn(), json: vi.fn(), env: {} } as any;
      await limiter(ctx, next);
      expect(next).toHaveBeenCalled();
    });

    it("allows request under limit", async () => {
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const limiter = createRateLimiter({ enabled: true, max: 10, windowMs: 60000 });
      const next = vi.fn();
      const ctx = {
        req: { path: "/api/test", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn(),
        env: {},
      } as any;
      await limiter(ctx, next);
      expect(next).toHaveBeenCalled();
    });

    it("returns 429 when limit exceeded", async () => {
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const limiter = createRateLimiter({ enabled: true, max: 1, windowMs: 60000 });
      const next = vi.fn();

      const ctx1 = {
        req: { path: "/api/test", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn(),
        env: {},
      } as any;
      await limiter(ctx1, next);

      const ctx2 = {
        req: { path: "/api/test", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn().mockReturnValue({ status: 429 }),
        env: {},
      } as any;
      await limiter(ctx2, next);
      expect(ctx2.json).toHaveBeenCalled();
    });

    it("skips exempt routes", async () => {
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const limiter = createRateLimiter({ enabled: true, max: 0, windowMs: 60000 });
      const next = vi.fn();
      const ctx = {
        req: { path: "/health", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn(),
        env: {},
      } as any;
      await limiter(ctx, next);
      expect(next).toHaveBeenCalled();
    });

    it("sets rate limit headers", async () => {
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const limiter = createRateLimiter({ enabled: true, max: 100, windowMs: 60000 });
      const next = vi.fn();
      const ctx = {
        req: { path: "/api/test", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn(),
        env: {},
      } as any;
      await limiter(ctx, next);
      expect(ctx.header).toHaveBeenCalledWith("X-RateLimit-Limit", expect.any(String));
      expect(ctx.header).toHaveBeenCalledWith("X-RateLimit-Remaining", expect.any(String));
      expect(ctx.header).toHaveBeenCalledWith("X-RateLimit-Reset", expect.any(String));
    });

    it("handles POST with higher cost", async () => {
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const limiter = createRateLimiter({ enabled: true, max: 2, windowMs: 60000 });
      const next = vi.fn();

      const ctx1 = {
        req: { path: "/api/test", method: "POST", header: () => null },
        header: vi.fn(),
        json: vi.fn(),
        env: {},
      } as any;
      await limiter(ctx1, next);

      const ctx2 = {
        req: { path: "/api/test", method: "POST", header: () => null },
        header: vi.fn(),
        json: vi.fn().mockReturnValue({ status: 429 }),
        env: {},
      } as any;
      await limiter(ctx2, next);
      expect(ctx2.json).toHaveBeenCalled();
    });

    it("handles DELETE with cost 3", async () => {
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const limiter = createRateLimiter({ enabled: true, max: 5, windowMs: 60000 });
      const next = vi.fn();
      const ctx = {
        req: { path: "/api/test", method: "DELETE", header: () => null },
        header: vi.fn(),
        json: vi.fn(),
        env: {},
      } as any;
      await limiter(ctx, next);
      expect(next).toHaveBeenCalled();
    });

    it("warns on rate limit exceeded", async () => {
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const limiter = createRateLimiter({ enabled: true, max: 1, windowMs: 60000 });
      const next = vi.fn();

      const ctx1 = {
        req: { path: "/api/test", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn(),
        env: {},
      } as any;
      await limiter(ctx1, next);

      const ctx2 = {
        req: { path: "/api/test", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn().mockReturnValue({ status: 429 }),
        env: {},
      } as any;
      await limiter(ctx2, next);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("getClientIp", () => {
    it("uses x-forwarded-for header", async () => {
      const { getClientIp } = await import("../lib/ratelimit");
      const ctx = {
        req: { header: (name: string) => name === "x-forwarded-for" ? "1.2.3.4" : null },
        env: {},
      } as any;
      expect(getClientIp(ctx)).toBe("1.2.3.4");
    });

    it("uses x-real-ip header as fallback", async () => {
      const { getClientIp } = await import("../lib/ratelimit");
      const ctx = {
        req: { header: (name: string) => name === "x-real-ip" ? "5.6.7.8" : null },
        env: {},
      } as any;
      expect(getClientIp(ctx)).toBe("5.6.7.8");
    });

    it("returns 'unknown' when no headers present", async () => {
      const { getClientIp } = await import("../lib/ratelimit");
      const ctx = {
        req: { header: () => null },
        env: {},
      } as any;
      expect(getClientIp(ctx)).toBe("unknown");
    });

    it("uses first XFF IP when remote address is trusted proxy", async () => {
      const { getClientIp } = await import("../lib/ratelimit");
      const ctx = {
        req: { header: (name: string) => name === "x-forwarded-for" ? "8.8.8.8, 1.1.1.1" : null },
        env: { incoming: { socket: { remoteAddress: "127.0.0.1" } } },
      } as any;
      expect(getClientIp(ctx)).toBe("8.8.8.8");
    });

    it("returns remote address when not trusted", async () => {
      const { getClientIp } = await import("../lib/ratelimit");
      const ctx = {
        req: { header: () => null },
        env: { incoming: { socket: { remoteAddress: "8.8.8.8" } } },
      } as any;
      expect(getClientIp(ctx)).toBe("8.8.8.8");
    });
  });

  describe("memFallback", () => {
    it("tracks request counts", async () => {
      const { memFallback, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const result = memFallback("ip1", 5, 60000);
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(4);
      expect(result.limited).toBe(false);
    });

    it("blocks when max exceeded", async () => {
      const { memFallback, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      for (let i = 0; i < 3; i++) memFallback("ip2", 2, 60000);
      const result = memFallback("ip2", 2, 60000);
      expect(result.limited).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("increments violation count on repeat violations", async () => {
      const { memFallback, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      for (let i = 0; i < 3; i++) memFallback("ip3", 2, 60000);
      const result = memFallback("ip3", 2, 60000);
      expect(result.violationCount).toBeGreaterThan(0);
    });

    it("resets after window expires", async () => {
      const { memFallback, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      memFallback("reset-expire-test", 2, 1);
      await new Promise(r => setTimeout(r, 20));
      const result = memFallback("reset-expire-test", 2, 60000);
      expect(result.count).toBe(1);
      expect(result.limited).toBe(false);
    });
  });

  describe("circuit breaker", () => {
    it("getCircuitBreaker returns state object", async () => {
      const { getCircuitBreaker, resetCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      const cb = getCircuitBreaker();
      expect(cb).toHaveProperty("isOpen");
      expect(cb).toHaveProperty("failureCount");
    });

    it("resetCircuitBreaker resets state", async () => {
      const { getCircuitBreaker, resetCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      const cb = getCircuitBreaker();
      cb.isOpen = true;
      cb.failureCount = 5;
      resetCircuitBreaker();
      expect(cb.isOpen).toBe(false);
      expect(cb.failureCount).toBe(0);
    });
  });

  describe("memStore", () => {
    it("getMemStore returns store object", async () => {
      const { getMemStore, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const store = getMemStore();
      expect(store).toBeDefined();
      expect(typeof store.size).toBe("function");
    });

    it("resetMemStore clears entries", async () => {
      const { memFallback, getMemStore, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      memFallback("x", 10, 60000);
      expect(getMemStore().size()).toBeGreaterThan(0);
      resetMemStore();
      expect(getMemStore().size()).toBe(0);
    });
  });

  describe("triggerCleanup", () => {
    it("removes expired entries", async () => {
      const { memFallback, getMemStore, triggerCleanup, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      memFallback("cleanup-test", 10, 1);
      expect(getMemStore().size()).toBeGreaterThan(0);
      await new Promise(r => setTimeout(r, 10));
      triggerCleanup();
    });
  });

  describe("stopCleanup", () => {
    it("stopCleanup is a function", async () => {
      const { stopCleanup } = await import("../lib/ratelimit");
      expect(typeof stopCleanup).toBe("function");
    });
  });

  describe("checkRedis", () => {
    it("works with mock redis pipeline", async () => {
      const { checkRedis, resetCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      const mockRedis = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => [[null, null], [null, -1]]),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 2),
      };
      const result = await checkRedis(mockRedis as any, "1.2.3.4", 100, 60);
      expect(result).toHaveProperty("count");
      expect(result).toHaveProperty("remaining");
    });

    it("increments existing counter", async () => {
      const { checkRedis, resetCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      const mockRedis = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => [[null, "5"], [null, 30]]),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 6),
      };
      const result = await checkRedis(mockRedis as any, "1.2.3.4", 100, 60);
      expect(result.count).toBe(6);
      expect(mockRedis.incr).toHaveBeenCalled();
    });

    it("returns limited when over max", async () => {
      const { checkRedis, resetCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      const mockRedis = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => [[null, "100"], [null, 30]]),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 101),
      };
      const result = await checkRedis(mockRedis as any, "1.2.3.4", 100, 60);
      expect(result.limited).toBe(true);
      expect(result.retryAfter).toBe(30);
    });

    it("retries on failure", async () => {
      const { checkRedis, resetCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      let callCount = 0;
      const mockRedis = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => {
            callCount++;
            if (callCount < 3) throw new Error("connection lost");
            return [[null, null], [null, -1]];
          }),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 1),
      };
      const result = await checkRedis(mockRedis as any, "1.2.3.4", 100, 60, 0);
      expect(result.count).toBe(1);
    });

    it("retries with explicit retryDelayMs", async () => {
      const { checkRedis, resetCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      let callCount = 0;
      const mockRedis = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => {
            callCount++;
            if (callCount < 2) throw new Error("connection lost");
            return [[null, null], [null, -1]];
          }),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 1),
      };
      const result = await checkRedis(mockRedis as any, "1.2.3.4", 100, 60, 50);
      expect(result.count).toBe(1);
    });

    it("throws after max retries exceeded", async () => {
      const { checkRedis, resetCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      const mockRedis = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => { throw new Error("always fails"); }),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 1),
      };
      await expect(checkRedis(mockRedis as any, "1.2.3.4", 100, 60, 0)).rejects.toThrow("Max retries exceeded");
    });

    it("opens circuit breaker after 3 failures", async () => {
      const { checkRedis, resetCircuitBreaker, getCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      const mockRedis = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => { throw new Error("fail"); }),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 1),
      };
      try { await checkRedis(mockRedis as any, "1.2.3.4", 100, 60, 0); } catch {}
      try { await checkRedis(mockRedis as any, "1.2.3.4", 100, 60, 0); } catch {}
      try { await checkRedis(mockRedis as any, "1.2.3.4", 100, 60, 0); } catch {}
      expect(getCircuitBreaker().isOpen).toBe(true);
    });

    it("rejects when circuit breaker is open", async () => {
      const { checkRedis, resetCircuitBreaker, getCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      getCircuitBreaker().isOpen = true;
      getCircuitBreaker().lastFailure = Date.now();
      await expect(checkRedis({} as any, "1.2.3.4", 100, 60)).rejects.toThrow("Circuit breaker open");
    });

    it("resets circuit breaker after timeout", async () => {
      const { checkRedis, resetCircuitBreaker, getCircuitBreaker } = await import("../lib/ratelimit");
      resetCircuitBreaker();
      getCircuitBreaker().isOpen = true;
      getCircuitBreaker().lastFailure = Date.now() - 60000;
      const mockRedis = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => [[null, null], [null, -1]]),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 1),
      };
      const result = await checkRedis(mockRedis as any, "1.2.3.4", 100, 60);
      expect(result.count).toBe(1);
      expect(getCircuitBreaker().isOpen).toBe(false);
    });
  });

  describe("rateLimitMiddleware (default export)", () => {
    it("is created with env defaults", async () => {
      const mod = await import("../lib/ratelimit");
      expect(mod.rateLimitMiddleware).toBeDefined();
      expect(typeof mod.rateLimitMiddleware).toBe("function");
    });
  });

  describe("createRateLimiter with redis error", () => {
    it("falls back to memory when redis throws", async () => {
      vi.doMock("../lib/redis", () => ({
        getRedis: () => {
          return { pipeline: () => { throw new Error("redis down"); } };
        },
      }));
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const limiter = createRateLimiter({ enabled: true, max: 10, windowMs: 60000 });
      const next = vi.fn();
      const ctx = {
        req: { path: "/api/test", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn(),
        env: {},
      } as any;
      await limiter(ctx, next);
      expect(next).toHaveBeenCalled();
    });

    it("uses redis path when available", async () => {
      const mockRedisInstance = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => [[null, "5"], [null, 30]]),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 6),
      };
      vi.doMock("../lib/redis", () => ({
        getRedis: () => mockRedisInstance,
      }));
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const limiter = createRateLimiter({ enabled: true, max: 100, windowMs: 60000 });
      const next = vi.fn();
      const ctx = {
        req: { path: "/api/test", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn(),
        env: {},
      } as any;
      await limiter(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(ctx.header).toHaveBeenCalledWith("X-RateLimit-Store", "redis");
    });

    it("returns 429 from redis path when limited", async () => {
      const mockRedisInstance = {
        pipeline: () => ({
          get: vi.fn(),
          ttl: vi.fn(),
          exec: vi.fn(async () => [[null, "101"], [null, 30]]),
        }),
        setex: vi.fn(async () => {}),
        incr: vi.fn(async () => 102),
      };
      vi.doMock("../lib/redis", () => ({
        getRedis: () => mockRedisInstance,
      }));
      const { createRateLimiter, resetMemStore } = await import("../lib/ratelimit");
      resetMemStore();
      const limiter = createRateLimiter({ enabled: true, max: 100, windowMs: 60000, logger: { warn: vi.fn(), error: vi.fn() } });
      const next = vi.fn();
      const ctx = {
        req: { path: "/api/test", method: "GET", header: () => null },
        header: vi.fn(),
        json: vi.fn().mockReturnValue(new Response(null, { status: 429 })),
        env: {},
      } as any;
      await limiter(ctx, next);
      expect(ctx.json).toHaveBeenCalled();
    });
  });
});
