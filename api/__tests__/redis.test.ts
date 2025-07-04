import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("../lib/env", () => ({
  env: {
    redisEnabled: false,
    cacheTtlSeconds: 300,
    appSecret: "test",
    databaseUrl: ":memory:",
    isProduction: false,
    redisHost: "localhost",
    redisPort: 6379,
    redisPassword: "",
    redisDb: 0,
    rateLimitEnabled: false,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 100,
    cacheEnabled: false,
    debugSql: false,
  },
}));

describe("redis (disabled)", () => {
  let redis: typeof import("../lib/redis");

  beforeAll(async () => {
    redis = await import("../lib/redis");
  });

  it("getRedis returns null when redis is disabled", () => {
    expect(redis.getRedis()).toBeNull();
  });

  it("getCache returns null when redis is disabled", async () => {
    const result = await redis.getCache("test-key");
    expect(result).toBeNull();
  });

  it("setCache resolves without error when redis is disabled", async () => {
    await expect(redis.setCache("key", "value")).resolves.toBeUndefined();
  });

  it("deleteCache resolves without error when redis is disabled", async () => {
    await expect(redis.deleteCache("key")).resolves.toBeUndefined();
  });

  it("invalidateCache resolves without error when redis is disabled", async () => {
    await expect(redis.invalidateCache("pattern:*")).resolves.toBeUndefined();
  });
});

describe("redis (enabled)", () => {
  let mockRedis: any;

  beforeEach(() => {
    vi.resetModules();
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      on: vi.fn(),
    };
    vi.doMock("ioredis", () => ({ default: function() { return mockRedis; } }));
    vi.doMock("../lib/env", () => ({
      env: {
        appSecret: "test",
        databaseUrl: ":memory:",
        isProduction: false,
        redisHost: "localhost",
        redisPort: 6379,
        redisPassword: "",
        redisDb: 0,
        redisEnabled: true,
        rateLimitEnabled: false,
        rateLimitWindowMs: 60000,
        rateLimitMaxRequests: 100,
        cacheEnabled: false,
        cacheTtlSeconds: 300,
        debugSql: false,
      },
    }));
  });

  it("getRedis creates and returns a client when redis is enabled", async () => {
    const redis = await import("../lib/redis");
    const client = redis.getRedis();
    expect(client).not.toBeNull();
  });

  it("getRedis returns existing client on second call", async () => {
    const redis = await import("../lib/redis");
    const client1 = redis.getRedis();
    const client2 = redis.getRedis();
    expect(client1).toBe(client2);
  });

  it("getCache calls r.get and returns value", async () => {
    mockRedis.get.mockResolvedValue("cached-value");
    const redis = await import("../lib/redis");
    const result = await redis.getCache("mykey");
    expect(result).toBe("cached-value");
    expect(mockRedis.get).toHaveBeenCalledWith("mykey");
  });

  it("setCache calls r.setex with correct args", async () => {
    const redis = await import("../lib/redis");
    await redis.setCache("mykey", "myvalue");
    expect(mockRedis.setex).toHaveBeenCalledWith("mykey", 300, "myvalue");
  });

  it("deleteCache calls r.del with correct key", async () => {
    const redis = await import("../lib/redis");
    await redis.deleteCache("mykey");
    expect(mockRedis.del).toHaveBeenCalledWith("mykey");
  });

  it("invalidateCache calls r.keys and r.del when keys match", async () => {
    mockRedis.keys.mockResolvedValue(["cache:users:1", "cache:users:2"]);
    const redis = await import("../lib/redis");
    await redis.invalidateCache("cache:users:*");
    expect(mockRedis.keys).toHaveBeenCalledWith("cache:users:*");
    expect(mockRedis.del).toHaveBeenCalledWith("cache:users:1", "cache:users:2");
  });

  it("invalidateCache does not call r.del when no keys match", async () => {
    mockRedis.keys.mockResolvedValue([]);
    const redis = await import("../lib/redis");
    await redis.invalidateCache("cache:none:*");
    expect(mockRedis.keys).toHaveBeenCalledWith("cache:none:*");
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it("getCache returns null on error", async () => {
    mockRedis.get.mockRejectedValue(new Error("connection failed"));
    const redis = await import("../lib/redis");
    const result = await redis.getCache("mykey");
    expect(result).toBeNull();
  });
});
