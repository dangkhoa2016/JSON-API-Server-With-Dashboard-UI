import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/env", () => ({
  env: {
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
  },
}));

vi.mock("@libsql/client", () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock("drizzle-orm/libsql", () => ({
  drizzle: vi.fn(() => ({ name: "mockDb" })),
}));

describe("connection", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getDb returns a database instance", async () => {
    const { getDb } = await import("../queries/connection");
    const db = getDb();
    expect(db).toBeDefined();
    expect(db.name).toBe("mockDb");
  });

  it("getDb returns the same instance on subsequent calls", async () => {
    const { getDb } = await import("../queries/connection");
    const first = getDb();
    const second = getDb();
    expect(first).toBe(second);
  });
});
