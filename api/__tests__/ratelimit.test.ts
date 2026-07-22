import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  memFallback,
  createRateLimiter,
  getClientIp,
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
  stopCleanup,
} from "../lib/ratelimit"

vi.mock("../lib/redis", () => ({
  getRedis: vi.fn(() => null),
}))

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
  },
}))

beforeEach(() => {
  resetCircuitBreaker()
  resetMemStore()
})

describe("normalizeIp", () => {
  it("returns 'unknown' for null/undefined/unknown", () => {
    expect(normalizeIp(null)).toBe("unknown")
    expect(normalizeIp(undefined)).toBe("unknown")
    expect(normalizeIp("unknown")).toBe("unknown")
  })

  it("strips ::ffff: prefix for IPv4-mapped IPv6", () => {
    expect(normalizeIp("::ffff:192.168.1.1")).toBe("192.168.1.1")
  })

  it("lowercases IPv6 addresses", () => {
    expect(normalizeIp("::1")).toBe("::1")
    expect(normalizeIp("FE80::1")).toBe("fe80::1")
  })
})

describe("isTrustedProxy", () => {
  it("returns false for null/undefined/unknown", () => {
    expect(isTrustedProxy(null)).toBe(false)
    expect(isTrustedProxy(undefined)).toBe(false)
    expect(isTrustedProxy("unknown")).toBe(false)
  })

  it("returns true for localhost", () => {
    expect(isTrustedProxy("127.0.0.1")).toBe(true)
    expect(isTrustedProxy("::1")).toBe(true)
  })

  it("returns true for private ranges", () => {
    expect(isTrustedProxy("10.0.0.1")).toBe(true)
    expect(isTrustedProxy("172.16.0.1")).toBe(true)
    expect(isTrustedProxy("192.168.1.1")).toBe(true)
  })

  it("returns false for public IPs", () => {
    expect(isTrustedProxy("8.8.8.8")).toBe(false)
    expect(isTrustedProxy("1.1.1.1")).toBe(false)
  })
})

describe("getRequestCost", () => {
  it("returns 1 for GET and HEAD", () => {
    expect(getRequestCost("GET")).toBe(1)
    expect(getRequestCost("HEAD")).toBe(1)
  })

  it("returns 2 for write operations", () => {
    expect(getRequestCost("POST")).toBe(2)
    expect(getRequestCost("PUT")).toBe(2)
    expect(getRequestCost("PATCH")).toBe(2)
  })

  it("returns 3 for DELETE", () => {
    expect(getRequestCost("DELETE")).toBe(3)
  })

  it("returns 1 for unknown methods", () => {
    expect(getRequestCost("OPTIONS")).toBe(1)
  })
})

describe("isExemptRoute", () => {
  it("exempts health, status, and favicon routes", () => {
    expect(isExemptRoute("/health")).toBe(true)
    expect(isExemptRoute("/status")).toBe(true)
    expect(isExemptRoute("/favicon.ico")).toBe(true)
  })

  it("does not exempt other routes", () => {
    expect(isExemptRoute("/api/users")).toBe(false)
  })
})

describe("memFallback", () => {
  it("allows first request", () => {
    const result = memFallback("192.168.1.1", 100, 60000)
    expect(result.count).toBe(1)
    expect(result.remaining).toBe(99)
    expect(result.limited).toBe(false)
  })

  it("blocks when limit exceeded", () => {
    for (let i = 0; i < 100; i++) {
      memFallback("192.168.1.2", 100, 60000)
    }
    const result = memFallback("192.168.1.2", 100, 60000)
    expect(result.limited).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it("resets after window expires", () => {
    const past = Date.now() - 120000
    getMemStore().set("reset-ip", {
      count: 200,
      resetAt: past,
      violationCount: 0,
    })
    const result = memFallback("reset-ip", 100, 60000)
    expect(result.count).toBe(1)
    expect(result.limited).toBe(false)
  })
})

describe("createRateLimiter (disabled)", () => {
  it("passes through when disabled", async () => {
    const mw = createRateLimiter({ enabled: false })
    let called = false
    const next = async () => { called = true }
    await mw(
      { req: { path: "/test", header: () => null, method: "GET" } } as any,
      next,
    )
    expect(called).toBe(true)
  })
})

describe("getClientIp", () => {
  it("returns remote address when not behind proxy", () => {
    const c = {
      req: {
        header: () => null,
      },
      env: { incoming: { socket: { remoteAddress: "10.0.0.5" } } },
    } as any
    expect(getClientIp(c)).toBe("10.0.0.5")
  })

  it("falls back to x-real-ip", () => {
    const c = {
      req: {
        header: (h: string) => h === "x-real-ip" ? "10.0.0.6" : null,
      },
      env: {},
    } as any
    expect(getClientIp(c)).toBe("10.0.0.6")
  })

  it("uses x-forwarded-for when behind trusted proxy", () => {
    const c = {
      req: {
        header: (h: string) => h === "x-forwarded-for" ? "203.0.113.1" : null,
      },
      env: { incoming: { socket: { remoteAddress: "127.0.0.1" } } },
    } as any
    expect(getClientIp(c)).toBe("203.0.113.1")
  })

  it("uses XFF when remoteAddress is unknown and untrusted", () => {
    const c = {
      req: {
        header: (h: string) => h === "x-forwarded-for" ? "203.0.113.5, 10.0.0.1" : null,
      },
      env: {},
    } as any
    expect(getClientIp(c)).toBe("203.0.113.5")
  })

  it("returns unknown when no remoteAddress and no XFF", () => {
    const c = {
      req: {
        header: () => null,
      },
      env: {},
    } as any
    expect(getClientIp(c)).toBe("unknown")
  })
})

describe("stopCleanup", () => {
  it("stops the cleanup timer without throwing", () => {
    expect(() => stopCleanup()).not.toThrow()
  })
})

describe("ensureLimit", () => {
  it("evicts oldest entries when store exceeds limit", () => {
    const store = getMemStore()
    for (let i = 0; i < 10002; i++) {
      store.set(`ip-${i}`, { count: 1, resetAt: Date.now() + 60000, violationCount: 0 })
    }
    expect(store.size()).toBeLessThanOrEqual(10000)
  })
})

describe("expandIpv6", () => {
  it("expands compressed IPv6 addresses", () => {
    const result = expandIpv6("::1")
    expect(result).toContain("0000")
  })

  it("expands full IPv6 without ::", () => {
    const result = expandIpv6("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
    expect(result).toHaveLength(32)
  })
})

describe("createCidrMatcher", () => {
  it("matches IPv4 addresses in CIDR range", () => {
    const matcher = createCidrMatcher("192.168.0.0/16")
    expect(matcher("192.168.1.1")).toBe(true)
    expect(matcher("192.168.255.255")).toBe(true)
    expect(matcher("10.0.0.1")).toBe(false)
  })

  it("matches IPv6 addresses in CIDR range", () => {
    const matcher = createCidrMatcher("::1/128")
    expect(matcher("::1")).toBe(true)
    expect(matcher("::2")).toBe(false)
  })
})

describe("triggerCleanup", () => {
  it("cleans up expired entries", () => {
    const past = Date.now() - 120000
    getMemStore().set("expired-ip", {
      count: 10,
      resetAt: past,
      violationCount: 0,
    })
    getMemStore().set("valid-ip", {
      count: 10,
      resetAt: Date.now() + 120000,
      violationCount: 0,
    })
    triggerCleanup()
    expect(getMemStore().size()).toBe(1)
  })
})

describe("getCircuitBreaker", () => {
  it("returns circuit breaker state", () => {
    const cb = getCircuitBreaker()
    expect(cb).toHaveProperty("isOpen")
    expect(cb).toHaveProperty("failureCount")
    expect(cb).toHaveProperty("lastFailure")
    expect(cb).toHaveProperty("resetTimeout")
  })
})

describe("checkRedis", () => {
  it("uses Redis pipeline for rate limiting", async () => {
    const mockPipeline = {
      get: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, null], [null, 60]]),
    }
    const mockRedis = {
      pipeline: vi.fn(() => mockPipeline),
      setex: vi.fn().mockResolvedValue("OK"),
      incr: vi.fn().mockResolvedValue(1),
    }
    const result = await checkRedis(mockRedis as any, "10.0.0.1", 100, 60, 0)
    expect(result.count).toBe(1)
    expect(result.remaining).toBe(99)
    expect(result.limited).toBe(false)
  })

  it("increments count when key exists", async () => {
    const mockPipeline = {
      get: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, "5"], [null, 60]]),
    }
    const mockRedis = {
      pipeline: vi.fn(() => mockPipeline),
      setex: vi.fn().mockResolvedValue("OK"),
      incr: vi.fn().mockResolvedValue(6),
    }
    const result = await checkRedis(mockRedis as any, "10.0.0.2", 100, 60, 0)
    expect(result.count).toBe(6)
    expect(result.remaining).toBe(94)
  })

  it("marks as limited when count exceeds max", async () => {
    const mockPipeline = {
      get: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, "100"], [null, 60]]),
    }
    const mockRedis = {
      pipeline: vi.fn(() => mockPipeline),
      setex: vi.fn().mockResolvedValue("OK"),
      incr: vi.fn().mockResolvedValue(101),
    }
    const result = await checkRedis(mockRedis as any, "10.0.0.3", 100, 60, 0)
    expect(result.limited).toBe(true)
  })

  it("retries on Redis errors and falls back", async () => {
    const mockRedis = {
      pipeline: vi.fn(() => {
        throw new Error("Redis connection failed")
      }),
      setex: vi.fn(),
      incr: vi.fn(),
    }
    await expect(
      checkRedis(mockRedis as any, "10.0.0.4", 100, 60, 0)
    ).rejects.toThrow("Max retries exceeded")
  })

  it("recovers from circuit breaker open state", async () => {
    const cb = getCircuitBreaker()
    cb.isOpen = true
    cb.lastFailure = Date.now() - 60000
    cb.resetTimeout = 30000
    const mockPipeline = {
      get: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, null], [null, 60]]),
    }
    const mockRedis = {
      pipeline: vi.fn(() => mockPipeline),
      setex: vi.fn().mockResolvedValue("OK"),
      incr: vi.fn().mockResolvedValue(1),
    }
    const result = await checkRedis(mockRedis as any, "10.0.0.5", 100, 60, 0)
    expect(result.count).toBe(1)
    expect(cb.isOpen).toBe(false)
  })

  it("uses windowSec when ttlVal is null", async () => {
    const mockPipeline = {
      get: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, null], [null, null]]),
    }
    const mockRedis = {
      pipeline: vi.fn(() => mockPipeline),
      setex: vi.fn().mockResolvedValue("OK"),
      incr: vi.fn().mockResolvedValue(1),
    }
    const result = await checkRedis(mockRedis as any, "10.0.0.7", 100, 60, 0)
    expect(result.count).toBe(1)
    expect(result.reset).toBe(60)
  })

  it("uses windowSec when ttlVal is zero", async () => {
    const mockPipeline = {
      get: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, null], [null, 0]]),
    }
    const mockRedis = {
      pipeline: vi.fn(() => mockPipeline),
      setex: vi.fn().mockResolvedValue("OK"),
      incr: vi.fn().mockResolvedValue(1),
    }
    const result = await checkRedis(mockRedis as any, "10.0.0.8", 100, 60, 0)
    expect(result.count).toBe(1)
    expect(result.reset).toBe(60)
  })

  it("throws when circuit breaker is open and not reset", async () => {
    const cb = getCircuitBreaker()
    cb.isOpen = true
    cb.lastFailure = Date.now()
    cb.resetTimeout = 60000
    const mockRedis = {
      pipeline: vi.fn(),
      setex: vi.fn(),
      incr: vi.fn(),
    }
    await expect(
      checkRedis(mockRedis as any, "10.0.0.6", 100, 60, 0)
    ).rejects.toThrow("Circuit breaker open")
  })
})

describe("createRateLimiter (enabled)", () => {
  function makeContext(path: string, method = "GET", headers: Record<string, string> = {}) {
    return {
      req: {
        path,
        method,
        header: (h: string) => headers[h] || null,
      },
      header: vi.fn(),
      json: vi.fn().mockReturnValue(new Response()),
      env: { incoming: { socket: { remoteAddress: "10.0.0.1" } } },
    } as any
  }

  it("allows requests under limit", async () => {
    const mw = createRateLimiter({ enabled: true, max: 100, windowMs: 60000 })
    const c = makeContext("/api/users")
    const next = vi.fn()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", expect.any(String))
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", expect.any(String))
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Store", "memory")
  })

  it("skips exempt routes", async () => {
    const mw = createRateLimiter({ enabled: true, max: 100, windowMs: 60000 })
    const c = makeContext("/health")
    const next = vi.fn()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
    expect(c.header).not.toHaveBeenCalled()
  })

  it("returns 429 when limit exceeded", async () => {
    const mw = createRateLimiter({ enabled: true, max: 1, windowMs: 60000 })
    const c1 = makeContext("/api/data")
    const next = vi.fn()
    await mw(c1, next)
    const c2 = makeContext("/api/data")
    await mw(c2, next)
    expect(c2.json).toHaveBeenCalled()
  })

  it("returns 429 with custom exempt routes", async () => {
    const mw = createRateLimiter({ enabled: true, max: 100, windowMs: 60000, exemptRoutes: ["/custom"] })
    const c = makeContext("/custom")
    const next = vi.fn()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
    expect(c.header).not.toHaveBeenCalled()
  })

  it("handles different request costs", async () => {
    const mw = createRateLimiter({ enabled: true, max: 10, windowMs: 60000 })
    const postCtx = makeContext("/api/data", "POST")
    const next = vi.fn()
    await mw(postCtx, next)
    expect(postCtx.header).toHaveBeenCalledWith("X-RateLimit-Limit", "5")
  })

  it("uses Redis when available", async () => {
    const { getRedis } = await import("../lib/redis")
    const mockPipeline = {
      get: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, null], [null, 60]]),
    }
    vi.mocked(getRedis).mockReturnValue({
      pipeline: vi.fn(() => mockPipeline),
      setex: vi.fn().mockResolvedValue("OK"),
      incr: vi.fn().mockResolvedValue(1),
    } as any)
    const mw = createRateLimiter({ enabled: true, max: 100, windowMs: 60000 })
    const c = makeContext("/api/users")
    const next = vi.fn()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Store", "redis")
    vi.mocked(getRedis).mockReturnValue(null as any)
  })

  it("falls back to memory when Redis errors", async () => {
    const { getRedis } = await import("../lib/redis")
    vi.mocked(getRedis).mockReturnValue({
      pipeline: vi.fn(() => { throw new Error("Redis down") }),
      setex: vi.fn(),
      incr: vi.fn(),
    } as any)
    const mw = createRateLimiter({ enabled: true, max: 100, windowMs: 60000 })
    const c = makeContext("/api/users")
    const next = vi.fn()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Store", "memory")
    vi.mocked(getRedis).mockReturnValue(null as any)
  })
})
