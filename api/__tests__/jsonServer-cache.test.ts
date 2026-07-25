import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

type JsonBody = Record<string, unknown> & {
  data: Array<Record<string, unknown>>;
};

vi.mock("../lib/env", () => ({
  env: {
    databaseUrl: ":memory:",
    debug: false,
    cacheEnabled: true,
    cacheTtlSeconds: 300,
    rateLimitEnabled: false,
    redisEnabled: true,
    redisHost: "localhost",
    redisPort: 6379,
    redisPassword: "",
    redisDb: 0,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 3,
    nodeEnv: "test",
    corsOrigins: "*",
    corsOriginList: "*",
    appSecret: "test",
    isProduction: false,
    debugSql: false,
  },
}));

const mockRedisInstance = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn(),
  on: vi.fn(),
};

vi.mock("../lib/redis", () => ({
  getRedis: () => mockRedisInstance,
  getCache: async (key: string) => mockRedisInstance.get(key),
  setCache: async (key: string, value: string, ttl?: number) =>
    mockRedisInstance.setex(key, ttl ?? 300, value),
  deleteCache: async (key: string) => mockRedisInstance.del(key),
  invalidateCache: async (pattern: string) => {
    const keys = await mockRedisInstance.keys(pattern);
    if (keys.length > 0) {
      await mockRedisInstance.del(...keys);
    }
  },
}));

import app from "../boot";
import { setupTestDatabase, seedTestData } from "./helpers";

describe("jsonServerRouter with cache enabled", () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await seedTestData();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached data on cache hit", async () => {
    const cachedUsers = JSON.stringify({
      data: [{ id: 1, name: "Cached User", email: "cached@test.com" }],
      total: 1,
    });
    mockRedisInstance.get.mockResolvedValueOnce(cachedUsers);

    const res = await app.request("/api/users");
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Cached User");
    expect(mockRedisInstance.get).toHaveBeenCalled();
  });

  it("fetches and caches on cache miss", async () => {
    mockRedisInstance.get.mockResolvedValueOnce(null);
    mockRedisInstance.setex.mockResolvedValueOnce("OK");

    const res = await app.request("/api/users");
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.data.length).toBeGreaterThan(1);
    expect(mockRedisInstance.setex).toHaveBeenCalled();
  });

  it("caches single resource by id", async () => {
    const cachedUser = JSON.stringify({
      id: 1,
      name: "Cached Leanne",
      email: "leanne@test.com",
    });
    mockRedisInstance.get.mockResolvedValueOnce(cachedUser);

    const res = await app.request("/api/users/1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.name).toBe("Cached Leanne");
  });

  describe("stale cache regression", () => {
    beforeEach(() => {
      mockRedisInstance.keys.mockResolvedValue([]);
      mockRedisInstance.del.mockResolvedValue(1);
      mockRedisInstance.setex.mockResolvedValue("OK");
    });

    it("returns updated data, not stale cached data, after PUT", async () => {
      const cachedPost = JSON.stringify({
        id: 1,
        userId: 1,
        title: "Stale Cached Title",
        body: "stale body",
      });
      mockRedisInstance.get.mockImplementation((key: string) => {
        if (key === "cache:posts:1") return Promise.resolve(cachedPost);
        return Promise.resolve(null);
      });

      const res = await app.request("/api/posts/1", {
        method: "PUT",
        body: JSON.stringify({ title: "Updated Title", body: "updated body" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as JsonBody;
      expect(body.title).toBe("Updated Title");

      // Reset mock so subsequent GET misses cache
      mockRedisInstance.get.mockReset();
      mockRedisInstance.get.mockResolvedValue(null);

      const res2 = await app.request("/api/posts/1");
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as JsonBody;
      expect(body2.title).toBe("Updated Title");
    });

    it("returns newly created data, not stale cached data, on create after delete", async () => {
      mockRedisInstance.get.mockImplementation((key: string) => {
        if (key.startsWith("cache:posts:")) {
          return Promise.resolve(
            JSON.stringify({
              id: 0,
              userId: 1,
              title: "Stale Cached Title",
              body: "stale body",
            })
          );
        }
        return Promise.resolve(null);
      });

      await app.request("/api/posts/3", { method: "DELETE" });

      const res = await app.request("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          userId: 1,
          title: "Brand New Post",
          body: "fresh body",
        }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as JsonBody;
      expect(body.title).toBe("Brand New Post");
    });
  });
});
