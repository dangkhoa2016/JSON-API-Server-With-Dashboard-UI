import { describe, it, expect, vi, beforeEach } from "vitest";

let mockRedisInstance: any;
let mockRedisOptions: any;
let errorHandler: Function;

vi.mock("ioredis", () => ({
  default: function MockRedis(options: any) {
    mockRedisOptions = options;
    const instance = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      scan: vi.fn().mockResolvedValue(["0", []]),
      on: vi.fn((event: string, handler: Function) => {
        if (event === "error") errorHandler = handler;
        return instance;
      }),
      pipeline: vi.fn(),
      incr: vi.fn(),
    };
    mockRedisInstance = instance;
    return instance;
  },
}));

vi.mock("../lib/env", () => ({
  env: {
    redisEnabled: true,
    cacheTtlSeconds: 60,
    redisHost: "localhost",
    redisPort: 6379,
    redisPassword: "",
    redisDb: 0,
  },
}));

import { getRedis, getCache, setCache, deleteCache, invalidateCache } from "../lib/redis";

describe("redis with mocked Redis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getRedis returns a Redis instance", () => {
    const redis = getRedis();
    expect(redis).not.toBeNull();
    expect(typeof redis!.get).toBe("function");
  });

  it("getRedis returns the same instance on subsequent calls", () => {
    const redis1 = getRedis();
    const redis2 = getRedis();
    expect(redis1).toBe(redis2);
  });

  it("retryStrategy returns null after 3 retries", () => {
    getRedis();
    expect(mockRedisOptions.retryStrategy(4)).toBeNull();
    expect(mockRedisOptions.retryStrategy(1)).toBeLessThanOrEqual(1000);
  });

  it("handles Redis connection error events", () => {
    getRedis();
    expect(errorHandler).toBeDefined();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorHandler(new Error("Connection refused"));
    expect(warnSpy).toHaveBeenCalledWith("Redis connection error:", "Connection refused");
    warnSpy.mockRestore();
  });

  it("getCache returns cached value", async () => {
    getRedis();
    mockRedisInstance.get.mockResolvedValueOnce("cached-value");
    const result = await getCache("test-key");
    expect(result).toBe("cached-value");
    expect(mockRedisInstance.get).toHaveBeenCalledWith("test-key");
  });

  it("getCache returns null on error", async () => {
    getRedis();
    mockRedisInstance.get.mockRejectedValueOnce(new Error("Redis error"));
    const result = await getCache("test-key");
    expect(result).toBeNull();
  });

  it("setCache stores value with ttl", async () => {
    await setCache("test-key", "test-value", 120);
    expect(mockRedisInstance.setex).toHaveBeenCalledWith("test-key", 120, "test-value");
  });

  it("setCache uses default ttl when not provided", async () => {
    await setCache("test-key", "test-value");
    expect(mockRedisInstance.setex).toHaveBeenCalledWith("test-key", 60, "test-value");
  });

  it("setCache ignores errors", async () => {
    mockRedisInstance.setex.mockRejectedValueOnce(new Error("Redis error"));
    await expect(setCache("test-key", "test-value")).resolves.toBeUndefined();
  });

  it("deleteCache deletes key", async () => {
    await deleteCache("test-key");
    expect(mockRedisInstance.del).toHaveBeenCalledWith("test-key");
  });

  it("deleteCache ignores errors", async () => {
    mockRedisInstance.del.mockRejectedValueOnce(new Error("Redis error"));
    await expect(deleteCache("test-key")).resolves.toBeUndefined();
  });

  it("invalidateCache deletes keys matching pattern", async () => {
    mockRedisInstance.scan.mockResolvedValueOnce(["0", ["key1", "key2"]]);
    await invalidateCache("cache:*");
    expect(mockRedisInstance.scan).toHaveBeenCalledWith("0", "MATCH", "cache:*", "COUNT", 100);
    expect(mockRedisInstance.del).toHaveBeenCalledWith("key1", "key2");
  });

  it("invalidateCache does nothing when no keys match", async () => {
    mockRedisInstance.scan.mockResolvedValueOnce(["0", []]);
    await invalidateCache("cache:*");
    expect(mockRedisInstance.scan).toHaveBeenCalledWith("0", "MATCH", "cache:*", "COUNT", 100);
    expect(mockRedisInstance.del).not.toHaveBeenCalled();
  });

  it("invalidateCache ignores errors", async () => {
    mockRedisInstance.scan.mockRejectedValueOnce(new Error("Redis error"));
    await expect(invalidateCache("cache:*")).resolves.toBeUndefined();
  });
});
