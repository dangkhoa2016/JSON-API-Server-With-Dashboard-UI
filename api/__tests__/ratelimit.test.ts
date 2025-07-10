import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  memFallback,
  createRateLimiter,
  getClientIp,
  isTrustedProxy,
  getRequestCost,
  normalizeIp,
  isExemptRoute,
  resetCircuitBreaker,
  resetMemStore,
  getMemStore,
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
})

describe("stopCleanup", () => {
  it("stops the cleanup timer without throwing", () => {
    expect(() => stopCleanup()).not.toThrow()
  })
})
