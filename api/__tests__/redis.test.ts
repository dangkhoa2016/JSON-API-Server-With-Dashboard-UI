import { describe, it, expect, vi, beforeEach } from "vitest";

function makeMockRedis() {
  const store: Record<string, string> = {};
  return {
    get: vi.fn(async (key: string) => store[key] ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => { store[key] = value; }),
    del: vi.fn(async (...keys: string[]) => { keys.forEach(k => { delete store[k]; }); }),
    keys: vi.fn(async (pattern: string) => {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return Object.keys(store).filter(k => regex.test(k));
    }),
    on: vi.fn(),
    _store: store,
  };
}

let mockRedis: ReturnType<typeof makeMockRedis>;
let capturedOptions: any = null;

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(function MockRedis(opts: any) {
    capturedOptions = opts;
    return mockRedis;
  }),
}));

const disabledEnv = {
  appSecret: "test-secret",
  isProduction: false,
  databaseUrl: ":memory:",
  redisHost: "localhost",
  redisPort: 6379,
  redisPassword: "",
  redisDb: 0,
  redisEnabled: false,
  rateLimitEnabled: false,
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 100,
  cacheEnabled: false,
  cacheTtlSeconds: 300,
  debugSql: false,
};

const enabledEnv = {
  ...disabledEnv,
  redisEnabled: true,
  cacheEnabled: true,
  redisPassword: "pass",
};

describe("redis - disabled", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doMock("../lib/env", () => ({ env: disabledEnv }));
  });

  it("getRedis returns null", async () => {
    const { getRedis } = await import("../lib/redis");
    expect(getRedis()).toBeNull();
  });

  it("getCache returns null", async () => {
    const { getCache } = await import("../lib/redis");
    expect(await getCache("test-key")).toBeNull();
  });

  it("setCache does nothing", async () => {
    const { setCache } = await import("../lib/redis");
    await expect(setCache("key", "value")).resolves.toBeUndefined();
  });

  it("deleteCache does nothing", async () => {
    const { deleteCache } = await import("../lib/redis");
    await expect(deleteCache("key")).resolves.toBeUndefined();
  });

  it("invalidateCache does nothing", async () => {
    const { invalidateCache } = await import("../lib/redis");
    await expect(invalidateCache("pattern:*")).resolves.toBeUndefined();
  });
});

describe("redis - enabled", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRedis = makeMockRedis();
    capturedOptions = null;
    vi.doMock("../lib/env", () => ({ env: enabledEnv }));
  });

  it("getRedis returns a Redis instance", async () => {
    const { getRedis } = await import("../lib/redis");
    const redis = getRedis();
    expect(redis).not.toBeNull();
  });

  it("getRedis returns the same instance on second call", async () => {
    const { getRedis } = await import("../lib/redis");
    const first = getRedis();
    const second = getRedis();
    expect(first).toBe(second);
  });

  it("getRedis creates ioredis with correct options", async () => {
    const { getRedis } = await import("../lib/redis");
    getRedis();
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions.host).toBe("localhost");
    expect(capturedOptions.port).toBe(6379);
    expect(capturedOptions.password).toBe("pass");
    expect(capturedOptions.db).toBe(0);
    expect(capturedOptions.maxRetriesPerRequest).toBe(3);
  });

  it("retryStrategy returns null after 3 retries", async () => {
    const { getRedis } = await import("../lib/redis");
    getRedis();
    expect(capturedOptions.retryStrategy(4)).toBeNull();
  });

  it("retryStrategy returns delay before max retries", async () => {
    const { getRedis } = await import("../lib/redis");
    getRedis();
    expect(capturedOptions.retryStrategy(1)).toBe(100);
    expect(capturedOptions.retryStrategy(2)).toBe(200);
    expect(capturedOptions.retryStrategy(3)).toBe(300);
  });

  it("getCache returns value from redis", async () => {
    const { getCache, setCache } = await import("../lib/redis");
    await setCache("mykey", "myvalue", 60);
    const result = await getCache("mykey");
    expect(result).toBe("myvalue");
  });

  it("getCache returns null for missing key", async () => {
    const { getCache } = await import("../lib/redis");
    const result = await getCache("nonexistent");
    expect(result).toBeNull();
  });

  it("getCache handles error gracefully", async () => {
    const { getCache } = await import("../lib/redis");
    mockRedis.get.mockRejectedValueOnce(new Error("connection lost"));
    const result = await getCache("key");
    expect(result).toBeNull();
  });

  it("setCache stores value with explicit TTL", async () => {
    const { setCache } = await import("../lib/redis");
    await setCache("key1", "val1", 120);
    expect(mockRedis.setex).toHaveBeenCalledWith("key1", 120, "val1");
  });

  it("setCache uses default TTL when not provided", async () => {
    const { setCache } = await import("../lib/redis");
    await setCache("key2", "val2");
    expect(mockRedis.setex).toHaveBeenCalledWith("key2", 300, "val2");
  });

  it("setCache handles error gracefully", async () => {
    const { setCache } = await import("../lib/redis");
    mockRedis.setex.mockRejectedValueOnce(new Error("write error"));
    await expect(setCache("k", "v")).resolves.toBeUndefined();
  });

  it("deleteCache removes key from redis", async () => {
    const { deleteCache } = await import("../lib/redis");
    await deleteCache("mykey");
    expect(mockRedis.del).toHaveBeenCalledWith("mykey");
  });

  it("deleteCache handles error gracefully", async () => {
    const { deleteCache } = await import("../lib/redis");
    mockRedis.del.mockRejectedValueOnce(new Error("del error"));
    await expect(deleteCache("k")).resolves.toBeUndefined();
  });

  it("invalidateCache deletes matching keys", async () => {
    const { invalidateCache } = await import("../lib/redis");
    mockRedis.keys.mockResolvedValueOnce(["key1", "key2"]);
    await invalidateCache("cache:*");
    expect(mockRedis.keys).toHaveBeenCalledWith("cache:*");
    expect(mockRedis.del).toHaveBeenCalledWith("key1", "key2");
  });

  it("invalidateCache does nothing when no keys match", async () => {
    const { invalidateCache } = await import("../lib/redis");
    mockRedis.keys.mockResolvedValueOnce([]);
    await invalidateCache("nomatch:*");
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it("invalidateCache handles error gracefully", async () => {
    const { invalidateCache } = await import("../lib/redis");
    mockRedis.keys.mockRejectedValueOnce(new Error("keys error"));
    await expect(invalidateCache("*")).resolves.toBeUndefined();
  });

  it("error handler logs warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getRedis } = await import("../lib/redis");
    getRedis();
    const errorHandler = mockRedis.on.mock.calls.find((c: any[]) => c[0] === "error")?.[1];
    expect(errorHandler).toBeDefined();
    errorHandler!({ message: "connection refused" });
    expect(warnSpy).toHaveBeenCalledWith("Redis connection error:", "connection refused");
    warnSpy.mockRestore();
  });
});
