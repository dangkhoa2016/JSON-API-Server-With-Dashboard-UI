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

const mockPipeline = {
  get: vi.fn(),
  ttl: vi.fn(),
  exec: vi.fn(),
};

const mockRedisInstance = {
  pipeline: vi.fn(() => mockPipeline),
  setex: vi.fn(),
  incr: vi.fn(),
  get: vi.fn(),
  on: vi.fn(),
};

vi.mock("../lib/redis", () => ({
  getRedis: () => mockRedisInstance,
}));

import { rateLimitMiddleware } from "../lib/ratelimit";

function createMockContext(ip: string) {
  return {
    req: {
      header: (name: string) => name === "x-forwarded-for" ? ip : null,
      raw: new Request("http://test.com"),
    },
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

describe("rateLimitMiddleware with Redis pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows first request (count === 0) with null ttl fallback", async () => {
    mockPipeline.exec.mockResolvedValueOnce([
      [null, null],
      [null, null],
    ]);

    const c = createMockContext("0.0.0.0");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);

    expect(mockPipeline.get).toHaveBeenCalled();
    expect(mockPipeline.ttl).toHaveBeenCalled();
    expect(mockRedisInstance.setex).toHaveBeenCalled();
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
    expect(next).toHaveBeenCalled();
  });

  it("allows first request (count === 0)", async () => {
    mockPipeline.exec.mockResolvedValueOnce([
      [null, null],
      [null, -1],
    ]);

    const c = createMockContext("1.1.1.1");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);

    expect(mockPipeline.get).toHaveBeenCalled();
    expect(mockPipeline.ttl).toHaveBeenCalled();
    expect(mockRedisInstance.setex).toHaveBeenCalled();
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
    expect(next).toHaveBeenCalled();
  });

  it("allows request under rate limit (count < max)", async () => {
    mockPipeline.exec.mockResolvedValueOnce([
      [null, "1"],
      [null, 50],
    ]);

    const c = createMockContext("2.2.2.2");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);

    expect(mockRedisInstance.incr).toHaveBeenCalled();
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "1");
    expect(next).toHaveBeenCalled();
  });

  it("rejects request exceeding rate limit (count >= max)", async () => {
    mockPipeline.exec.mockResolvedValueOnce([
      [null, "3"],
      [null, 40],
    ]);

    const c = createMockContext("3.3.3.3");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Too many requests" }),
      429,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("falls back to memory on Redis error", async () => {
    mockPipeline.exec.mockRejectedValueOnce(new Error("Redis error"));

    const c = createMockContext("4.4.4.4");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);

    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
    expect(next).toHaveBeenCalled();
  });

  it("catch block — in-memory fallback hitting max requests in catch", async () => {
    mockPipeline.exec
      .mockRejectedValueOnce(new Error("Redis error"))
      .mockRejectedValueOnce(new Error("Redis error"))
      .mockRejectedValueOnce(new Error("Redis error"))
      .mockRejectedValueOnce(new Error("Redis error"));

    const makeReq = async () => {
      const c = createMockContext("5.5.5.5");
      const next = vi.fn();
      await rateLimitMiddleware(c, next);
      return { c, next };
    };

    const r1 = await makeReq();
    expect(r1.c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
    expect(r1.next).toHaveBeenCalled();

    const r2 = await makeReq();
    expect(r2.c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "1");
    expect(r2.next).toHaveBeenCalled();

    const r3 = await makeReq();
    expect(r3.c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
    expect(r3.next).toHaveBeenCalled();

    const r4 = await makeReq();
    expect(r4.c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Too many requests" }),
      429,
    );
    expect(r4.next).not.toHaveBeenCalled();
  });
});
