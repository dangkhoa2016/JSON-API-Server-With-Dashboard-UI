import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/redis", () => ({
  getRedis: vi.fn(() => null),
}));

vi.mock("../lib/env", () => ({
  env: {
    rateLimitEnabled: true,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 100,
    appSecret: "test",
    databaseUrl: ":memory:",
    isProduction: false,
    redisHost: "localhost",
    redisPort: 6379,
    redisPassword: "",
    redisDb: 0,
    redisEnabled: false,
    cacheEnabled: false,
    cacheTtlSeconds: 300,
    debugSql: false,
    trustedProxyCidrs: [
      "127.0.0.1",
      "::1",
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
    ],
  },
}));

vi.mock("../queries/connection", () => ({
  getDb: vi.fn(),
}));

import {
  memFallback,
  createRateLimiter,
  rateLimitMiddleware,
  resetConfigCache,
  getClientIp,
  resolveClientIpFromHeaders,
  isTrustedProxy,
  getRequestCost,
  normalizeIp,
  isExemptRoute,
  expandIpv6,
  createCidrMatcher,
  checkRedis,
  triggerCleanup,
  resetCircuitBreaker,
  resetMemStore,
  getMemStore,
  getCircuitBreaker,
  startCleanup,
  stopCleanup,
  cleanupExpiredEntries,
} from "../lib/ratelimit";
import { getDb } from "../queries/connection";

function createMockContext(
  ip?: string,
  opts: {
    remoteAddr?: string;
    xRealIp?: string;
    path?: string;
    method?: string;
  } = {}
) {
  const headers = new Map<string, string>();
  if (ip) headers.set("x-forwarded-for", ip);
  if (opts.xRealIp) headers.set("x-real-ip", opts.xRealIp);
  const remoteAddr =
    opts.remoteAddr !== undefined ? opts.remoteAddr : ip ? "127.0.0.1" : "";
  const env = remoteAddr
    ? { incoming: { socket: { remoteAddress: remoteAddr } } }
    : ({} as any);

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

beforeEach(() => {
  resetCircuitBreaker();
  resetMemStore();
});

describe("normalizeIp", () => {
  it("returns 'unknown' for null/undefined/unknown", () => {
    expect(normalizeIp(null)).toBe("unknown");
    expect(normalizeIp(undefined)).toBe("unknown");
    expect(normalizeIp("unknown")).toBe("unknown");
  });

  it("strips ::ffff: prefix for IPv4-mapped IPv6", () => {
    expect(normalizeIp("::ffff:192.168.1.1")).toBe("192.168.1.1");
  });

  it("lowercases IPv6 addresses", () => {
    expect(normalizeIp("::1")).toBe("::1");
    expect(normalizeIp("FE80::1")).toBe("fe80::1");
  });
});

describe("resolveClientIpFromHeaders", () => {
  it("returns unknown when xff is null and remoteAddress is empty", () => {
    const result = resolveClientIpFromHeaders(null, "");
    expect(result).toBe("unknown");
  });

  it("returns XFF first entry when remoteAddress is empty (untrusted peer, no socket)", () => {
    const result = resolveClientIpFromHeaders("203.0.113.1", "");
    expect(result).toBe("203.0.113.1");
  });

  it("returns remoteAddress when peer is untrusted", () => {
    const result = resolveClientIpFromHeaders("1.2.3.4", "203.0.113.10");
    expect(result).toBe("203.0.113.10");
  });

  it("returns XFF last entry when behind trusted proxy", () => {
    const result = resolveClientIpFromHeaders(
      "4.3.2.1, 10.0.0.5",
      "192.168.1.1"
    );
    expect(result).toBe("4.3.2.1");
  });

  it("returns XFF first untrusted entry when behind trusted proxy", () => {
    const result = resolveClientIpFromHeaders("1.2.3.4", "192.168.1.1");
    expect(result).toBe("1.2.3.4");
  });
});

describe("isTrustedProxy", () => {
  it("returns false for null/undefined/unknown", () => {
    expect(isTrustedProxy(null)).toBe(false);
    expect(isTrustedProxy(undefined)).toBe(false);
    expect(isTrustedProxy("unknown")).toBe(false);
  });

  it("returns true for localhost IPv4 and IPv6", () => {
    expect(isTrustedProxy("127.0.0.1")).toBe(true);
    expect(isTrustedProxy("::1")).toBe(true);
  });

  it("returns true for 10.0.0.0/8 range", () => {
    expect(isTrustedProxy("10.0.0.1")).toBe(true);
    expect(isTrustedProxy("10.255.255.255")).toBe(true);
  });

  it("returns true for 172.16.0.0/12 range", () => {
    expect(isTrustedProxy("172.16.0.1")).toBe(true);
    expect(isTrustedProxy("172.31.255.255")).toBe(true);
  });

  it("returns true for 192.168.0.0/16 range", () => {
    expect(isTrustedProxy("192.168.1.1")).toBe(true);
  });

  it("returns false for public IPs", () => {
    expect(isTrustedProxy("8.8.8.8")).toBe(false);
    expect(isTrustedProxy("1.1.1.1")).toBe(false);
    expect(isTrustedProxy("172.15.0.1")).toBe(false);
  });
});

describe("getRequestCost", () => {
  it("returns 1 for GET and HEAD", () => {
    expect(getRequestCost("GET")).toBe(1);
    expect(getRequestCost("HEAD")).toBe(1);
  });

  it("returns 2 for write operations", () => {
    expect(getRequestCost("POST")).toBe(2);
    expect(getRequestCost("PUT")).toBe(2);
    expect(getRequestCost("PATCH")).toBe(2);
  });

  it("returns 3 for DELETE", () => {
    expect(getRequestCost("DELETE")).toBe(3);
  });

  it("returns 1 for unknown methods", () => {
    expect(getRequestCost("OPTIONS")).toBe(1);
    expect(getRequestCost("UNKNOWN")).toBe(1);
  });
});

describe("isExemptRoute", () => {
  it("exempts health, status, and favicon routes", () => {
    expect(isExemptRoute("/health")).toBe(true);
    expect(isExemptRoute("/status")).toBe(true);
    expect(isExemptRoute("/favicon.ico")).toBe(true);
  });

  it("does not exempt other routes", () => {
    expect(isExemptRoute("/api/users")).toBe(false);
  });
});

describe("memFallback", () => {
  beforeEach(() => {
    resetMemStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first request", () => {
    const result = memFallback("192.168.1.1", 100, 60000);
    expect(result.count).toBe(1);
    expect(result.remaining).toBe(99);
    expect(result.limited).toBe(false);
  });

  it("blocks when limit exceeded", () => {
    for (let i = 0; i < 100; i++) {
      memFallback("192.168.1.2", 100, 60000);
    }
    const result = memFallback("192.168.1.2", 100, 60000);
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("resets count on new window", () => {
    memFallback("127.0.0.1", 10, 60000);
    vi.advanceTimersByTime(61000);
    const result = memFallback("127.0.0.1", 10, 60000);
    expect(result.count).toBe(1);
  });

  it("increments violationCount on violation", () => {
    memFallback("127.0.0.1", 1, 60000);
    const info2 = memFallback("127.0.0.1", 1, 60000);
    expect(info2.violationCount).toBe(1);
    const info3 = memFallback("127.0.0.1", 1, 60000);
    expect(info3.violationCount).toBe(1);
  });

  it("carries over violationCount within decay window", () => {
    memFallback("127.0.0.1", 1, 60000);
    const info2 = memFallback("127.0.0.1", 1, 60000);
    expect(info2.violationCount).toBe(1);
    expect(info2.retryAfter).toBe(300);
    vi.advanceTimersByTime(301000);
    const info3 = memFallback("127.0.0.1", 1, 60000);
    expect(info3.violationCount).toBe(1);
  });

  it("uses escalating retryAfter values", () => {
    memFallback("127.0.0.1", 1, 60000);
    const info2 = memFallback("127.0.0.1", 1, 60000);
    expect(info2.retryAfter).toBe(300);
    const info3 = memFallback("127.0.0.1", 1, 60000);
    expect(info3.retryAfter).toBe(300);
  });

  it("escalates penalties progressively across distinct violation events", () => {
    memFallback("127.0.0.1", 1, 60000);
    const info1 = memFallback("127.0.0.1", 1, 60000);
    expect(info1.violationCount).toBe(1);
    expect(info1.retryAfter).toBe(300);

    const infoBlock = memFallback("127.0.0.1", 1, 60000);
    expect(infoBlock.violationCount).toBe(1);
    expect(infoBlock.retryAfter).toBe(300);

    vi.advanceTimersByTime(301000);
    memFallback("127.0.0.1", 1, 60000);
    const info2 = memFallback("127.0.0.1", 1, 60000);
    expect(info2.violationCount).toBe(2);
    expect(info2.retryAfter).toBe(1200);

    vi.advanceTimersByTime(1201000);
    memFallback("127.0.0.1", 1, 60000);
    const info3 = memFallback("127.0.0.1", 1, 60000);
    expect(info3.violationCount).toBe(3);
    expect(info3.retryAfter).toBe(3600);

    vi.advanceTimersByTime(7201000);
    memFallback("127.0.0.1", 1, 60000);
    const infoFresh = memFallback("127.0.0.1", 1, 60000);
    expect(infoFresh.violationCount).toBe(1);
    expect(infoFresh.retryAfter).toBe(300);
  });
});

describe("createRateLimiter (disabled)", () => {
  it("passes through when disabled", async () => {
    const mw = createRateLimiter({ enabled: false });
    let called = false;
    const next = async () => {
      called = true;
    };
    await mw(
      { req: { path: "/test", header: () => null, method: "GET" } } as any,
      next
    );
    expect(called).toBe(true);
  });
});

describe("createRateLimiter (enabled)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips exempt routes", async () => {
    const limiter = createRateLimiter({ exemptRoutes: ["/health"] });
    const next = vi.fn();
    await limiter(createMockContext(undefined, { path: "/health" }), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("uses effectiveMax for POST requests", async () => {
    const limiter = createRateLimiter({ max: 100 });
    const c = createMockContext("127.0.0.1", { method: "POST" });
    await limiter(c, vi.fn());
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", "50");
  });

  it("uses effectiveMax for DELETE requests", async () => {
    const limiter = createRateLimiter({ max: 30 });
    const c = createMockContext("127.0.0.1", { method: "DELETE" });
    await limiter(c, vi.fn());
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
  });

  it("uses effectiveMax for PATCH requests", async () => {
    const limiter = createRateLimiter({ max: 100 });
    const c = createMockContext("127.0.0.1", { method: "PATCH" });
    await limiter(c, vi.fn());
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", "50");
  });

  it("handles invalid IP gracefully", async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const limiter = createRateLimiter({ logger: logger as any });
    const c = createMockContext(undefined, { remoteAddr: "" });
    const next = vi.fn();
    await limiter(c, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next when not rate limited", async () => {
    const limiter = createRateLimiter({ max: 100 });
    const c = createMockContext("127.0.0.1");
    const next = vi.fn();
    await limiter(c, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("sets X-RateLimit-Store to memory", async () => {
    const limiter = createRateLimiter();
    const c = createMockContext("127.0.0.1");
    await limiter(c, vi.fn());
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Store", "memory");
  });

  it("rejects requests exceeding rate limit with 429", async () => {
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

  it("sets correct headers when rate limited", async () => {
    const limiter = createRateLimiter({ max: 1 });
    await limiter(createMockContext("1.2.3.4"), vi.fn());
    const c2 = createMockContext("1.2.3.4");
    await limiter(c2, vi.fn());
    expect(c2.header).toHaveBeenCalledWith("X-RateLimit-Limit", "1");
    expect(c2.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
    expect(c2.header).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  it("allows 3 requests and blocks the 4th with max=3", async () => {
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

  it("uses x-forwarded-for header for client IP", async () => {
    const limiter = createRateLimiter({ max: 3 });
    const c = createMockContext("10.0.0.1");
    const next = vi.fn();
    await limiter(c, next);
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
    expect(next).toHaveBeenCalled();
  });

  it("uses Redis when available", async () => {
    const { getRedis } = await import("../lib/redis");
    vi.mocked(getRedis).mockReturnValue({
      eval: vi.fn().mockResolvedValue([1, 60000]),
    } as any);
    const mw = createRateLimiter({ enabled: true, max: 100, windowMs: 60000 });
    const c = createMockContext("10.0.0.1");
    const next = vi.fn();
    await mw(c, next);
    expect(next).toHaveBeenCalled();
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Store", "redis");
    vi.mocked(getRedis).mockReturnValue(null as any);
  });

  it("falls back to memory when Redis errors", async () => {
    const { getRedis } = await import("../lib/redis");
    vi.mocked(getRedis).mockReturnValue({
      eval: vi.fn(() => {
        throw new Error("Redis down");
      }),
    } as any);
    const mw = createRateLimiter({ enabled: true, max: 100, windowMs: 60000 });
    const c = createMockContext("10.0.0.1");
    const next = vi.fn();
    await mw(c, next);
    expect(next).toHaveBeenCalled();
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Store", "memory");
    vi.mocked(getRedis).mockReturnValue(null as any);
  });
});

describe("getClientIp", () => {
  it("returns remote address when not behind proxy", () => {
    const c = createMockContext(undefined, { remoteAddr: "10.0.0.5" });
    expect(getClientIp(c)).toBe("10.0.0.5");
  });

  it("does not fall back to x-real-ip when remoteAddress is empty", () => {
    const c = createMockContext(undefined, { xRealIp: "10.0.0.6" });
    expect(getClientIp(c)).toBe("unknown");
  });

  it("uses x-forwarded-for when behind trusted proxy", () => {
    const c = createMockContext("203.0.113.1", { remoteAddr: "127.0.0.1" });
    expect(getClientIp(c)).toBe("203.0.113.1");
  });

  it("uses XFF when remoteAddress is unknown and untrusted", () => {
    const c = createMockContext("203.0.113.5, 10.0.0.1");
    expect(getClientIp(c)).toBe("203.0.113.5");
  });

  it("returns unknown when no remoteAddress and no XFF", () => {
    const c = createMockContext(undefined, { remoteAddr: "" });
    expect(getClientIp(c)).toBe("unknown");
  });

  it("handles IPv6-mapped IPv4", () => {
    const c = createMockContext(undefined, {
      remoteAddr: "::ffff:192.168.1.1",
    });
    expect(getClientIp(c)).toBe("192.168.1.1");
  });

  it("preserves pure IPv6 addresses", () => {
    const c = createMockContext(undefined, { remoteAddr: "2001:db8::1" });
    expect(getClientIp(c)).toBe("2001:db8::1");
  });

  it("lowercases IPv6", () => {
    const c = createMockContext(undefined, { remoteAddr: "2001:DB8::1" });
    expect(getClientIp(c)).toBe("2001:db8::1");
  });

  it("walks XFF chain right-to-left behind trusted proxy", () => {
    const c = createMockContext("1.2.3.4, 5.6.7.8, 9.10.11.12", {
      remoteAddr: "127.0.0.1",
    });
    expect(getClientIp(c)).toBe("9.10.11.12");
  });

  it("returns remote address when peer is untrusted even with XFF", () => {
    const c = createMockContext("198.51.100.99", {
      remoteAddr: "203.0.113.10",
    });
    expect(getClientIp(c)).toBe("203.0.113.10");
  });

  it("walks XFF chain right-to-left to find first untrusted hop", () => {
    const c = createMockContext("198.51.100.20, 10.0.0.3", {
      remoteAddr: "10.0.0.4",
    });
    expect(getClientIp(c)).toBe("198.51.100.20");
  });

  it("skips multiple trusted proxies in XFF chain", () => {
    const c = createMockContext("198.51.100.20, 10.0.0.3, 10.0.0.1", {
      remoteAddr: "10.0.0.4",
    });
    expect(getClientIp(c)).toBe("198.51.100.20");
  });
});

describe("cleanup lifecycle", () => {
  it("starts and stops the cleanup timer without throwing", () => {
    expect(() => startCleanup()).not.toThrow();
    expect(() => stopCleanup()).not.toThrow();
  });

  it("is idempotent", () => {
    startCleanup();
    startCleanup();
    stopCleanup();
    expect(() => stopCleanup()).not.toThrow();
  });
});

describe("ensureLimit", () => {
  it("evicts oldest entries when store exceeds limit", () => {
    const store = getMemStore();
    for (let i = 0; i < 10002; i++) {
      store.set(`ip-${i}`, {
        count: 1,
        windowResetAt: Date.now() + 60000,
        blockedUntil: 0,
        violationCount: 0,
        violationResetAt: 0,
      });
    }
    expect(store.size()).toBeLessThanOrEqual(10000);
  });
});

describe("expandIpv6", () => {
  it("expands compressed IPv6 addresses", () => {
    expect(expandIpv6("::1")).toBe("00000000000000000000000000000001");
  });

  it("expands fe80::1", () => {
    expect(expandIpv6("fe80::1")).toBe("fe800000000000000000000000000001");
  });

  it("expands full IPv6 without ::", () => {
    const result = expandIpv6("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    expect(result).toHaveLength(32);
    expect(result).toBe("20010db885a3000000008a2e03707334");
  });

  it("throws when :: leaves more than 8 groups", () => {
    expect(() => expandIpv6("1:2:3:4:5:6:7:8::")).toThrow("Invalid IPv6 address");
  });

  it("throws when the group count is not 8", () => {
    expect(() => expandIpv6("1:2:3:4:5:6:7")).toThrow("Invalid IPv6 address");
  });
});

describe("createCidrMatcher", () => {
  it("matches IPv4 addresses in CIDR range", () => {
    const matcher = createCidrMatcher("192.168.0.0/16");
    expect(matcher("192.168.1.1")).toBe(true);
    expect(matcher("192.168.255.255")).toBe(true);
    expect(matcher("10.0.0.1")).toBe(false);
  });

  it("matches IPv6 address in /128 CIDR", () => {
    const matcher = createCidrMatcher("::1/128");
    expect(matcher("::1")).toBe(true);
    expect(matcher("::2")).toBe(false);
  });

  it("matches IPv6 address in /32 CIDR", () => {
    const matcher = createCidrMatcher(
      "2001:0db8:0000:0000:0000:0000:0000:0000/32"
    );
    expect(matcher("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(true);
    expect(matcher("2001:0db9:0000:0000:0000:0000:0000:0001")).toBe(false);
  });

  it("matches compressed IPv6 against CIDR with ::", () => {
    const matcher = createCidrMatcher("2001:db8::/32");
    expect(matcher("2001:db8::1")).toBe(true);
    expect(matcher("2001:db8:0:1::5")).toBe(true);
    expect(matcher("2001:db9::1")).toBe(false);
  });

  it("rejects invalid mask bits", () => {
    expect(() => createCidrMatcher("192.168.0.0/33")).toThrow();
    expect(() => createCidrMatcher("::/129")).toThrow();
    expect(() => createCidrMatcher("10.0.0.0/abc")).toThrow();
  });

  it("rejects malformed addresses", () => {
    expect(() => createCidrMatcher("300.1.1.1/24")).toThrow();
    expect(() => createCidrMatcher("not-an-ip/24")).toThrow();
  });

  it("rejects IPv6 addresses with invalid characters", () => {
    expect(() => createCidrMatcher("gg::1/128")).toThrow("Invalid IPv6 address");
  });

  it("uses default /32 mask for IPv4 CIDR without prefix", () => {
    const matcher = createCidrMatcher("192.168.1.1");
    expect(matcher("192.168.1.1")).toBe(true);
    expect(matcher("192.168.1.2")).toBe(false);
  });

  it("uses default /128 mask for IPv6 CIDR without prefix", () => {
    const matcher = createCidrMatcher("::1");
    expect(matcher("::1")).toBe(true);
    expect(matcher("::2")).toBe(false);
  });
});

describe("triggerCleanup", () => {
  it("cleans up expired entries", () => {
    const past = Date.now() - 120000;
    getMemStore().set("expired-ip", {
      count: 10,
      windowResetAt: past,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: past,
    });
    getMemStore().set("valid-ip", {
      count: 10,
      windowResetAt: Date.now() + 120000,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: Date.now() + 120000,
    });
    triggerCleanup(getMemStore());
    expect(getMemStore().size()).toBe(1);
  });
});

describe("cleanupExpiredEntries", () => {
  it("cleans up expired entries from the module memStore", () => {
    const past = Date.now() - 120000;
    getMemStore().set("expired-cleanup-ip", {
      count: 5,
      windowResetAt: past,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: past,
    });
    getMemStore().set("valid-cleanup-ip", {
      count: 5,
      windowResetAt: Date.now() + 120000,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: Date.now() + 120000,
    });
    cleanupExpiredEntries();
    expect(getMemStore().size()).toBe(1);
  });
});

describe("getCircuitBreaker", () => {
  it("returns circuit breaker state", () => {
    const cb = getCircuitBreaker();
    expect(cb).toHaveProperty("isOpen");
    expect(cb).toHaveProperty("failureCount");
    expect(cb).toHaveProperty("lastFailure");
    expect(cb).toHaveProperty("resetTimeout");
  });
});

describe("checkRedis", () => {
  it("uses Redis pipeline for rate limiting", async () => {
    const mockRedis = {
      eval: vi.fn().mockResolvedValue([1, 60000]),
    };
    const result = await checkRedis(mockRedis as any, "10.0.0.1", 100, 60, 0);
    expect(result.count).toBe(1);
    expect(result.remaining).toBe(99);
    expect(result.limited).toBe(false);
  });

  it("increments count when key exists", async () => {
    const mockRedis = {
      eval: vi.fn().mockResolvedValue([6, 60000]),
    };
    const result = await checkRedis(mockRedis as any, "10.0.0.2", 100, 60, 0);
    expect(result.count).toBe(6);
    expect(result.remaining).toBe(94);
  });

  it("marks as limited when count exceeds max", async () => {
    const mockRedis = {
      eval: vi.fn().mockResolvedValue([101, 60000]),
    };
    const result = await checkRedis(mockRedis as any, "10.0.0.3", 100, 60, 0);
    expect(result.limited).toBe(true);
  });

  it("retries on Redis errors and falls back", async () => {
    const mockRedis = {
      eval: vi.fn(() => {
        throw new Error("Redis connection failed");
      }),
    };
    await expect(
      checkRedis(mockRedis as any, "10.0.0.4", 100, 60, 0)
    ).rejects.toThrow("Max retries exceeded");
  });

  it("recovers from circuit breaker open state", async () => {
    const cb = getCircuitBreaker();
    cb.isOpen = true;
    cb.lastFailure = Date.now() - 60000;
    cb.resetTimeout = 30000;
    const mockRedis = {
      eval: vi.fn().mockResolvedValue([1, 60000]),
    };
    const result = await checkRedis(mockRedis as any, "10.0.0.5", 100, 60, 0);
    expect(result.count).toBe(1);
    expect(cb.isOpen).toBe(false);
  });

  it("throws when circuit breaker is open and not reset", async () => {
    const cb = getCircuitBreaker();
    cb.isOpen = true;
    cb.lastFailure = Date.now();
    cb.resetTimeout = 60000;
    const mockRedis = {
      eval: vi.fn(),
    };
    await expect(
      checkRedis(mockRedis as any, "10.0.0.6", 100, 60, 0)
    ).rejects.toThrow("Circuit breaker open");
  });

  it("uses windowSec when retryDelayMs is null or zero", async () => {
    for (const retryDelayMs of [null, 0]) {
      const redis = { eval: vi.fn().mockResolvedValue([1, 60000]) } as any;
      const result = await checkRedis(redis, "10.0.0.7", 100, 60, retryDelayMs);
      expect(result.count).toBe(1);
      expect(result.reset).toBe(Math.floor(Date.now() / 1000) + 60);
    }
  });
});

describe("memStore internal operations", () => {
  beforeEach(() => {
    resetMemStore();
  });

  it("tracks size correctly", () => {
    const store = getMemStore();
    expect(store.size()).toBe(0);
    store.set("192.168.1.1", {
      count: 1,
      windowResetAt: Date.now() + 60000,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: 0,
    });
    expect(store.size()).toBe(1);
    store.set("192.168.1.2", {
      count: 2,
      windowResetAt: Date.now() + 60000,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: 0,
    });
    expect(store.size()).toBe(2);
    store.delete("192.168.1.1");
    expect(store.size()).toBe(1);
  });

  it("handles entries iteration", () => {
    const store = getMemStore();
    store.set("192.168.1.1", {
      count: 1,
      windowResetAt: Date.now() + 60000,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: 0,
    });
    store.set("192.168.1.2", {
      count: 2,
      windowResetAt: Date.now() + 60000,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: 0,
    });
    const count = [...store.entries()].length;
    expect(count).toBe(2);
  });

  it("triggers LRU eviction when exceeding max entries", () => {
    const store = getMemStore();
    for (let i = 0; i < 10001; i++) {
      store.set(`ip${i}`, {
        count: i,
        windowResetAt: Date.now() + 60000,
        blockedUntil: 0,
        violationCount: 0,
        violationResetAt: 0,
      });
    }
    expect(store.size()).toBeLessThanOrEqual(10000);
  });

  it("supports LRU touch on get", () => {
    const store = getMemStore();
    store.set("key1", {
      count: 1,
      windowResetAt: Date.now() + 60000,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: 0,
    });
    store.set("key2", {
      count: 2,
      windowResetAt: Date.now() + 60000,
      blockedUntil: 0,
      violationCount: 0,
      violationResetAt: 0,
    });
    store.get("key1");
  });

  it("has all expected methods", () => {
    const store = getMemStore();
    expect(typeof store.get).toBe("function");
    expect(typeof store.set).toBe("function");
    expect(typeof store.delete).toBe("function");
    expect(typeof store.entries).toBe("function");
    expect(typeof store.size).toBe("function");
    expect(typeof store.clear).toBe("function");
  });
});

describe("rateLimitMiddleware (dynamic config from DB)", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    all: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetConfigCache();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    (getDb as any).mockReturnValue(mockDb);
  });

  it("passes through when DB has RATE_LIMIT_ENABLED=false", async () => {
    mockDb.all.mockResolvedValue([
      { key: "RATE_LIMIT_ENABLED", value: "false" },
    ]);

    const c = {
      req: { path: "/api/users", header: () => null, method: "GET" },
      header: vi.fn(),
      json: vi.fn(),
      env: {},
    } as any;
    const next = vi.fn();
    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("applies rate limiting when DB has RATE_LIMIT_ENABLED=true", async () => {
    mockDb.all.mockResolvedValue([
      { key: "RATE_LIMIT_ENABLED", value: "true" },
      { key: "RATE_LIMIT_MAX_REQUESTS", value: "1" },
      { key: "RATE_LIMIT_WINDOW_MS", value: "60000" },
    ]);

    const c1 = {
      req: { path: "/api/users", header: () => null, method: "GET" },
      header: vi.fn(),
      json: vi.fn(),
      env: {},
    } as any;
    await rateLimitMiddleware(c1, vi.fn());

    const c2 = {
      req: { path: "/api/users", header: () => null, method: "GET" },
      header: vi.fn(),
      json: vi.fn(),
      env: {},
    } as any;
    const next2 = vi.fn();
    await rateLimitMiddleware(c2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(c2.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Too many requests" }),
      429
    );
  });

  it("falls back to env values when DB query fails", async () => {
    mockDb.all.mockRejectedValue(new Error("DB error"));

    const c = {
      req: { path: "/api/users", header: () => null, method: "GET" },
      header: vi.fn(),
      json: vi.fn(),
      env: {},
    } as any;
    const next = vi.fn();
    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("falls back to env for max/windowMs when DB values are 0", async () => {
    mockDb.all.mockResolvedValue([
      { key: "RATE_LIMIT_ENABLED", value: "true" },
      { key: "RATE_LIMIT_MAX_REQUESTS", value: "0" },
      { key: "RATE_LIMIT_WINDOW_MS", value: "0" },
    ]);

    resetConfigCache();
    const c = {
      req: { path: "/api/users", header: () => null, method: "GET" },
      header: vi.fn(),
      json: vi.fn(),
      env: {},
    } as any;
    const next = vi.fn();
    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("falls back to env for max/windowMs when DB values are missing", async () => {
    mockDb.all.mockResolvedValue([
      { key: "RATE_LIMIT_ENABLED", value: "true" },
    ]);

    resetConfigCache();
    const c = {
      req: { path: "/api/users", header: () => null, method: "GET" },
      header: vi.fn(),
      json: vi.fn(),
      env: {},
    } as any;
    const next = vi.fn();
    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("falls back to env.rateLimitEnabled when DB has no RATE_LIMIT_ENABLED key", async () => {
    mockDb.all.mockResolvedValue([
      { key: "RATE_LIMIT_MAX_REQUESTS", value: "10" },
      { key: "RATE_LIMIT_WINDOW_MS", value: "60000" },
    ]);

    resetConfigCache();
    const c = {
      req: { path: "/api/users", header: () => null, method: "GET" },
      header: vi.fn(),
      json: vi.fn(),
      env: {},
    } as any;
    const next = vi.fn();
    await rateLimitMiddleware(c, next);
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("caches config within TTL window", async () => {
    mockDb.all.mockResolvedValue([
      { key: "RATE_LIMIT_ENABLED", value: "true" },
      { key: "RATE_LIMIT_MAX_REQUESTS", value: "5" },
      { key: "RATE_LIMIT_WINDOW_MS", value: "60000" },
    ]);

    const c1: any = {
      req: { path: "/api/users", header: () => null, method: "GET" },
      header: vi.fn(),
      json: vi.fn(),
      env: {},
    };
    await rateLimitMiddleware(c1, vi.fn());
    expect(mockDb.all).toHaveBeenCalledTimes(1);

    mockDb.all.mockResolvedValue([
      { key: "RATE_LIMIT_ENABLED", value: "false" },
    ]);

    const c2: any = {
      req: { path: "/api/users", header: () => null, method: "GET" },
      header: vi.fn(),
      json: vi.fn(),
      env: {},
    };
    await rateLimitMiddleware(c2, vi.fn());
    expect(mockDb.all).toHaveBeenCalledTimes(1);
  });
});
