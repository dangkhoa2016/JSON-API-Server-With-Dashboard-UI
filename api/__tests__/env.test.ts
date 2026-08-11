import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_DATABASE_URL } from "../../db/config";

describe("env", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("loads required env vars", async () => {
    process.env.APP_SECRET = "test-secret";
    process.env.DATABASE_URL = "file:./test.db";

    const { env } = await import("../lib/env");
    expect(env.appSecret).toBe("test-secret");
    expect(env.databaseUrl).toBe("file:./test.db");
  });

  it("provides defaults for optional vars", async () => {
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = ":memory:";

    const { env } = await import("../lib/env");
    expect(env.redisHost).toBe("localhost");
    expect(env.redisPort).toBe(6379);
    expect(env.redisEnabled).toBe(false);
    expect(env.cacheEnabled).toBe(false);
    expect(env.rateLimitMaxRequests).toBe(100);
    expect(env.rateLimitWindowMs).toBe(60000);
  });

  it("parses optional bool vars correctly", async () => {
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = ":memory:";
    process.env.REDIS_ENABLED = "true";
    process.env.CACHE_ENABLED = "1";
    process.env.RATE_LIMIT_ENABLED = "yes";

    const { env } = await import("../lib/env");
    expect(env.redisEnabled).toBe(true);
    expect(env.cacheEnabled).toBe(true);
    expect(env.rateLimitEnabled).toBe(true);
  });

  it("detects production environment", async () => {
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = ":memory:";
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "http://localhost:3000";

    const { env } = await import("../lib/env");
    expect(env.isProduction).toBe(true);
  });

  it("throws in production when required vars are missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;

    await expect(async () => {
      await import("../lib/env");
    }).rejects.toThrow();
  });

  it("uses default value when required var is missing in non-production", async () => {
    process.env.APP_SECRET = "test";
    delete process.env.DATABASE_URL;

    const { env } = await import("../lib/env");
    expect(env.databaseUrl).toBe(DEFAULT_DATABASE_URL);
  });

  it("returns default value when optionalInt receives NaN", async () => {
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = ":memory:";
    process.env.REDIS_PORT = "not-a-number";

    const { env } = await import("../lib/env");
    expect(env.redisPort).toBe(6379);
  });

  it("parses optionalInt with valid number string", async () => {
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = ":memory:";
    process.env.REDIS_PORT = "6380";

    const { env } = await import("../lib/env");
    expect(env.redisPort).toBe(6380);
  });

  it("parses optionalInt with zero value", async () => {
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = ":memory:";
    process.env.REDIS_DB = "0";

    const { env } = await import("../lib/env");
    expect(env.redisDb).toBe(0);
  });

  it("returns default for optional bool when value is missing", async () => {
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = ":memory:";
    delete process.env.REDIS_ENABLED;

    const { env } = await import("../lib/env");
    expect(env.redisEnabled).toBe(false);
  });

  it("handles optionalBool with 'false' string", async () => {
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = ":memory:";
    process.env.REDIS_ENABLED = "false";

    const { env } = await import("../lib/env");
    expect(env.redisEnabled).toBe(false);
  });

  it("parses optional REDIS_URL", async () => {
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = ":memory:";
    process.env.REDIS_URL = "redis://cache:6379/0";

    const { env } = await import("../lib/env");
    expect(env.redisUrl).toBe("redis://cache:6379/0");
  });

  describe("corsOriginList", () => {
    it("defaults to wildcard in non-production", async () => {
      process.env.APP_SECRET = "test";
      process.env.DATABASE_URL = ":memory:";
      delete process.env.CORS_ORIGINS;

      const { env } = await import("../lib/env");
      expect(env.corsOriginList).toBe("*");
    });

    it("parses comma-separated origins", async () => {
      process.env.APP_SECRET = "test";
      process.env.DATABASE_URL = ":memory:";
      process.env.CORS_ORIGINS = "http://a.com, http://b.com ,https://c.com";

      const { env } = await import("../lib/env");
      expect(env.corsOriginList).toEqual([
        "http://a.com",
        "http://b.com",
        "https://c.com",
      ]);
    });

    it("deduplicates repeated origins", async () => {
      process.env.APP_SECRET = "test";
      process.env.DATABASE_URL = ":memory:";
      process.env.CORS_ORIGINS = "http://a.com,http://a.com";

      const { env } = await import("../lib/env");
      expect(env.corsOriginList).toEqual(["http://a.com"]);
    });

    it("rejects wildcard in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.APP_SECRET = "test";
      process.env.DATABASE_URL = ":memory:";
      process.env.CORS_ORIGINS = "*";

      await expect(import("../lib/env")).rejects.toThrow(/\*.*production/i);
    });

    it("accepts explicit origin list in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.APP_SECRET = "test";
      process.env.DATABASE_URL = ":memory:";
      process.env.CORS_ORIGINS = "https://example.com";

      const { env } = await import("../lib/env");
      expect(env.corsOriginList).toEqual(["https://example.com"]);
    });

    it("filters empty entries from origin list", async () => {
      process.env.APP_SECRET = "test";
      process.env.DATABASE_URL = ":memory:";
      process.env.CORS_ORIGINS = "http://a.com,,,http://b.com,";

      const { env } = await import("../lib/env");
      expect(env.corsOriginList).toEqual(["http://a.com", "http://b.com"]);
    });
  });
});
