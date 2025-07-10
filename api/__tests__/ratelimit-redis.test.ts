import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/env", () => ({
  env: {
    rateLimitEnabled: true,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 3,
    redisEnabled: true,
    cacheEnabled: false,
  },
}));

const mockRedisInstance = {
  pipeline: vi.fn(),
  setex: vi.fn(),
  incr: vi.fn(),
  on: vi.fn(),
};

function mockPipelineResults(results: Array<[null, string | null] | [null, number]>) {
  const pipelineOps = {
    get: vi.fn(),
    ttl: vi.fn(),
    exec: vi.fn().mockResolvedValue(results),
  };
  mockRedisInstance.pipeline.mockReturnValueOnce(pipelineOps);
  return pipelineOps;
}

vi.mock("../lib/redis", () => ({
  getRedis: () => mockRedisInstance,
}));

import {
  createRateLimiter,
  checkRedis,
  getCircuitBreaker,
  resetCircuitBreaker,
  resetMemStore,
} from "../lib/ratelimit";

function createMockContext(ip: string, opts: { path?: string; method?: string } = {}) {
  return {
    req: {
      header: (name: string) => name === "x-forwarded-for" ? ip : null,
      raw: new Request("http://test.com"),
      path: opts.path || "/test",
      method: opts.method || "GET",
    },
    env: { incoming: { socket: { remoteAddress: '127.0.0.1' } } },
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

describe("Rate Limiter Middleware - Redis mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
    resetMemStore();
  });

  describe("checkRedis", () => {
    it("should return info when not rate limited", async () => {
      mockPipelineResults([[null, null], [null, null]]);
      mockRedisInstance.setex.mockResolvedValueOnce("OK");
      const info = await checkRedis(mockRedisInstance, '127.0.0.1', 100, 60);
      expect(info.count).toBe(1);
      expect(info.remaining).toBe(99);
      expect(info.limited).toBe(false);
    });

    it("should return info when rate limited", async () => {
      mockPipelineResults([[null, "100"], [null, 300]]);
      mockRedisInstance.incr.mockResolvedValueOnce(101);
      const info = await checkRedis(mockRedisInstance, '127.0.0.1', 100, 60);
      expect(info.limited).toBe(true);
      expect(info.retryAfter).toBe(300);
    });

    it("should throw when circuit breaker is open", async () => {
      const cb = getCircuitBreaker();
      cb.isOpen = true;
      cb.lastFailure = Date.now();
      await expect(
        checkRedis(mockRedisInstance, '127.0.0.1', 100, 60)
      ).rejects.toThrow(/Circuit breaker open/);
    });

    it("should reset circuit breaker after timeout", async () => {
      const cb = getCircuitBreaker();
      cb.isOpen = true;
      cb.lastFailure = Date.now() - 60000;
      cb.failureCount = 5;
      mockPipelineResults([[null, null], [null, null]]);
      mockRedisInstance.setex.mockResolvedValueOnce("OK");
      const info = await checkRedis(mockRedisInstance, '127.0.0.1', 100, 60);
      expect(cb.isOpen).toBe(false);
      expect(cb.failureCount).toBe(0);
      expect(info.limited).toBe(false);
    });

    it("should reset failure count on success", async () => {
      const cb = getCircuitBreaker();
      cb.failureCount = 2;
      mockPipelineResults([[null, null], [null, null]]);
      mockRedisInstance.setex.mockResolvedValueOnce("OK");
      await checkRedis(mockRedisInstance, '127.0.0.1', 100, 60);
      expect(cb.failureCount).toBe(0);
    });

    it("should throw after max retries", async () => {
      mockRedisInstance.pipeline.mockImplementation(() => {
        throw new Error('Permanent error');
      });
      await expect(
        checkRedis(mockRedisInstance, '127.0.0.1', 100, 60, 1)
      ).rejects.toThrow(/Max retries exceeded/);
    });

    it("should open circuit breaker after 3 failures", async () => {
      mockRedisInstance.pipeline.mockImplementation(() => {
        throw new Error('err');
      });
      try {
        await checkRedis(mockRedisInstance, '127.0.0.1', 100, 60, 1);
      } catch { /* expected */ }
      const cb = getCircuitBreaker();
      expect(cb.isOpen).toBe(true);
      expect(cb.failureCount).toBe(3);
    });

    it("should use exponential backoff when retryDelayMs is not provided", async () => {
      mockRedisInstance.pipeline.mockImplementation(() => {
        throw new Error('err');
      });
      await expect(
        checkRedis(mockRedisInstance, '127.0.0.1', 100, 60)
      ).rejects.toThrow(/Max retries exceeded/);
    });
  });

  describe("createRateLimiter with Redis", () => {
    it("should allow first request under limit", async () => {
      mockPipelineResults([[null, null], [null, null]]);
      mockRedisInstance.setex.mockResolvedValueOnce("OK");
      const limiter = createRateLimiter({ max: 100 });
      const c = createMockContext("1.1.1.1");
      const next = vi.fn();
      await limiter(c, next);
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "99");
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should allow request under limit", async () => {
      mockPipelineResults([[null, "1"], [null, 55]]);
      mockRedisInstance.incr.mockResolvedValueOnce(2);
      const limiter = createRateLimiter({ max: 3 });
      const c = createMockContext("2.2.2.2");
      const next = vi.fn();
      await limiter(c, next);
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "1");
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should reject request exceeding rate limit", async () => {
      mockPipelineResults([[null, "3"], [null, 300]]);
      mockRedisInstance.incr.mockResolvedValueOnce(4);
      const limiter = createRateLimiter({ max: 3 });
      const c = createMockContext("3.3.3.3");
      const next = vi.fn();
      await limiter(c, next);
      expect(next).not.toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Too many requests" }),
        429
      );
    });

    it("should set X-RateLimit-Store to redis", async () => {
      mockPipelineResults([[null, null], [null, null]]);
      mockRedisInstance.setex.mockResolvedValueOnce("OK");
      const limiter = createRateLimiter();
      const c = createMockContext("4.4.4.4");
      await limiter(c, vi.fn());
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Store", "redis");
    });

    it("should fall back to memory on Redis error", async () => {
      mockRedisInstance.pipeline.mockImplementation(() => {
        throw new Error('Redis down');
      });
      const logger = { warn: vi.fn(), error: vi.fn() };
      const limiter = createRateLimiter({ max: 100, logger: logger as any, retryDelayMs: 1 });
      const c = createMockContext("5.5.5.5");
      const next = vi.fn();
      await limiter(c, next);
      expect(logger.error).toHaveBeenCalledWith('Redis error, falling back to memory', 'Max retries exceeded');
      expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "99");
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should hit rate limit in fallback after repeated Redis errors", async () => {
      mockRedisInstance.pipeline.mockImplementation(() => {
        throw new Error('Redis error');
      });
      const limiter = createRateLimiter({ max: 2, retryDelayMs: 1 });

      const makeReq = async () => {
        const c = createMockContext("6.6.6.6");
        const next = vi.fn();
        await limiter(c, next);
        return { c, next };
      };

      const r1 = await makeReq();
      expect(r1.c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "1");
      expect(r1.next).toHaveBeenCalled();

      const r2 = await makeReq();
      expect(r2.c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
      expect(r2.next).toHaveBeenCalled();

      const r3 = await makeReq();
      expect(r3.next).not.toHaveBeenCalled();
      expect(r3.c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Too many requests" }),
        429
      );
    });
  });
});
