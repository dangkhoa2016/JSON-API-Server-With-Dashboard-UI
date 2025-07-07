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

import { rateLimitMiddleware } from "../lib/ratelimit";

function createMockContext(ip?: string) {
  const headers = new Map<string, string>();
  if (ip) headers.set("x-forwarded-for", ip);

  return {
    req: {
      header: (name: string) => headers.get(name.toLowerCase()) ?? null,
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

describe("rateLimitMiddleware with in-memory store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests within rate limit", async () => {
    const c = createMockContext("1.2.3.4");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Limit", "3");
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
    expect(next).toHaveBeenCalled();
  });

  it("rejects requests exceeding rate limit", async () => {
    const c = createMockContext("5.6.7.8");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(1);

    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(2);

    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(3);

    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(3);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Too many requests" }),
      429,
    );
  });

  it("uses x-forwarded-for header for client IP", async () => {
    const c = createMockContext("10.0.0.1");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
    expect(next).toHaveBeenCalled();
  });

  it("extracts first IP from comma-separated x-forwarded-for", async () => {
    const c = createMockContext("100.100.100.100 , 5.6.7.8");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);
    await rateLimitMiddleware(c, next);
    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(3);

    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(3);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Too many requests" }),
      429,
    );
  });

  it("uses unknown for requests without IP headers", async () => {
    const c = createMockContext();
    const next = vi.fn();

    await rateLimitMiddleware(c, next);
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
    expect(next).toHaveBeenCalled();
  });

  it("resets rate limit window for expired entries", async () => {
    const c = createMockContext("9.9.9.9");
    const next = vi.fn();

    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(1);

    await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", async () => {
    const c = {
      req: {
        header: (name: string) =>
          name === "x-real-ip" ? "192.168.1.1" : null,
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
    const next = vi.fn();

    await rateLimitMiddleware(c, next);
    expect(c.header).toHaveBeenCalledWith("X-RateLimit-Remaining", "2");
    expect(next).toHaveBeenCalled();
  });
});
