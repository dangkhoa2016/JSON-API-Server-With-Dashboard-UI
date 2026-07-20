import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { setupTestDatabase, seedTestData, clearTestDatabase } from "./helpers";

beforeAll(async () => {
  await setupTestDatabase();
});

let adminHash = "";
let adminToken = "";

beforeAll(async () => {
  adminHash = await hash("admin123");
});

beforeEach(async () => {
  await clearTestDatabase();
  await seedTestData();
  const db = getDb();
  await db.run(sql`DELETE FROM settings`);
  await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
    ('REDIS_ENABLED', 'false', 'boolean', 'Redis Enabled', 'Enable Redis', 'redis', 1),
    ('APP_SECRET', 'secret123', 'string', 'App Secret', 'Secret key', 'general', 0)
  `);
  if (adminHash) {
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('ADMIN_USERNAME', 'admin', 'string', 'Admin Username', 'Admin login', 'auth', 0),
      ('ADMIN_PASSWORD_HASH', ${adminHash}, 'string', 'Admin Password Hash', 'Argon2 hash', 'auth', 0)
    `);
  }
  // Refresh admin token before each test
  const loginResponse = await appRouter.createCaller({
    req: new Request("http://test.com"),
    resHeaders: new Headers(),
  }).admin.auth.login({ username: "admin", password: "admin123" });
  adminToken = loginResponse.ok && "token" in loginResponse ? loginResponse.token! : "";
});

function createCaller() {
  return appRouter.createCaller({
    req: new Request("http://test.com"),
    resHeaders: new Headers(),
  });
}

function createAdminCaller() {
  return appRouter.createCaller({
    req: new Request("http://test.com", {
      headers: { authorization: `Bearer ${adminToken}` },
    }),
    resHeaders: new Headers(),
  });
}

describe("admin.settings", () => {
  it("list returns only public settings when not authenticated", async () => {
    const caller = createCaller();
    const result = await caller.admin.settings.list();
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("REDIS_ENABLED");
  });

  it("list returns all settings when authenticated", async () => {
    const caller = createAdminCaller();
    const result = await caller.admin.settings.list();
    expect(result).toHaveLength(4);
    expect(result[0].key).toBe("ADMIN_PASSWORD_HASH");
    expect(result[1].key).toBe("ADMIN_USERNAME");
    expect(result[2].key).toBe("APP_SECRET");
    expect(result[3].key).toBe("REDIS_ENABLED");
  });

  it("getByKey returns a setting by key", async () => {
    const caller = createCaller();
    const setting = await caller.admin.settings.getByKey({ key: "REDIS_ENABLED" });
    expect(setting).not.toBeNull();
    expect(setting!.key).toBe("REDIS_ENABLED");
    expect(setting!.value).toBe("false");
    expect(setting!.isPublic).toBe(true);
  });

  it("getByKey returns null for non-existent key", async () => {
    const caller = createCaller();
    const result = await caller.admin.settings.getByKey({ key: "NON_EXISTENT" });
    expect(result).toBeNull();
  });

  it("getByKey returns null for sensitive key when not authenticated", async () => {
    const caller = createCaller();
    const result = await caller.admin.settings.getByKey({ key: "APP_SECRET" });
    expect(result).toBeNull();
  });

  it("getByKey returns sensitive key when authenticated", async () => {
    const caller = createAdminCaller();
    const result = await caller.admin.settings.getByKey({ key: "APP_SECRET" });
    expect(result).not.toBeNull();
    expect(result!.key).toBe("APP_SECRET");
    expect(result!.value).toBe("********");
  });

  it("update modifies an existing setting", async () => {
    const caller = createAdminCaller();
    const result = await caller.admin.settings.update({ key: "REDIS_ENABLED", value: "true" });
    expect(result.ok).toBe(true);
    const setting = await caller.admin.settings.getByKey({ key: "REDIS_ENABLED" });
    expect(setting!.value).toBe("true");
  });

  it("update returns error for non-existent key", async () => {
    const caller = createAdminCaller();
    const result = await caller.admin.settings.update({ key: "NON_EXISTENT", value: "test" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("update rejects unauthenticated requests", async () => {
    await expect(createCaller().admin.settings.update({ key: "REDIS_ENABLED", value: "test" }))
      .rejects.toThrow("Admin authentication required");
  });

  it("reset restores setting from environment variable", async () => {
    process.env.REDIS_ENABLED = "true";
    await createAdminCaller().admin.settings.update({ key: "REDIS_ENABLED", value: "false" });
    const result = await createAdminCaller().admin.settings.reset({ key: "REDIS_ENABLED" });
    expect(result.ok).toBe(true);
    const setting = await createAdminCaller().admin.settings.getByKey({ key: "REDIS_ENABLED" });
    expect(setting!.value).toBe("true");
    delete process.env.REDIS_ENABLED;
  });

  it("reset returns error when env var not set", async () => {
    delete process.env.REDIS_ENABLED;
    const result = await createAdminCaller().admin.settings.reset({ key: "REDIS_ENABLED" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("No environment value");
  });

  it("reset returns error when setting not found in DB", async () => {
    process.env.DATABASE_URL = "postgres://test";
    const caller = createAdminCaller();
    const result = await caller.admin.settings.reset({ key: "DATABASE_URL" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not found");
    delete process.env.DATABASE_URL;
  });

  it("reset returns error for non-existent key", async () => {
    process.env.NON_EXISTENT = "test";
    const caller = createAdminCaller();
    const result = await caller.admin.settings.reset({ key: "NON_EXISTENT" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("cannot be reset");
  });
});

describe("admin.auth", () => {
  it("login succeeds with correct credentials and returns a token", async () => {
    const result = await createCaller().admin.auth.login({ username: "admin", password: "admin123" });
    expect(result.ok).toBe(true);
    expect(result.username).toBe("admin");
    expect(result.role).toBe("admin");
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
  });

  it("login fails with wrong password", async () => {
    const result = await createCaller().admin.auth.login({ username: "admin", password: "wrongpass" });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Invalid username or password");
  });

  it("login fails with wrong username", async () => {
    const result = await createCaller().admin.auth.login({ username: "nobody", password: "admin123" });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Invalid username or password");
  });

  it("login fails when admin credentials not seeded", async () => {
    const db = getDb();
    await db.run(sql`DELETE FROM settings WHERE key = 'ADMIN_USERNAME'`);
    await db.run(sql`DELETE FROM settings WHERE key = 'ADMIN_PASSWORD_HASH'`);
    const result = await createCaller().admin.auth.login({ username: "admin", password: "admin123" });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Admin credentials not configured");
  });

  it("verify returns ok: false when no auth header", async () => {
    const result = await createCaller().admin.auth.verify();
    expect(result.ok).toBe(false);
  });

  it("verify returns ok: true with session data for valid token", async () => {
    const result = await createAdminCaller().admin.auth.verify();
    expect(result.ok).toBe(true);
    expect(result.username).toBe("admin");
    expect(result.role).toBe("admin");
  });

  it("verify returns ok: false for invalid token", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://test.com", {
        headers: { authorization: "Bearer invalid-token-123" },
      }),
      resHeaders: new Headers(),
    });
    const result = await caller.admin.auth.verify();
    expect(result.ok).toBe(false);
  });
});

describe("admin.data", () => {
  it("seed clears all data and re-fetches from jsonplaceholder", async () => {
    const db = getDb();
    const usersBefore = await db.run(sql`SELECT COUNT(*) as count FROM users`);
    expect(usersBefore.rows[0].count).toBeGreaterThan(0);

    const originalFetch = globalThis.fetch;
    const mockFetch = async (input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.href;
      if (url.includes("/users")) return new Response(JSON.stringify([{ id: 1, name: "Mock", username: "mock", email: "m@m", address: {}, phone: "", website: "", company: {} }]));
      if (url.includes("/posts")) return new Response(JSON.stringify([{ id: 1, userId: 1, title: "t", body: "b" }]));
      if (url.includes("/comments")) return new Response(JSON.stringify([{ id: 1, postId: 1, name: "n", email: "e", body: "b" }]));
      if (url.includes("/albums")) return new Response(JSON.stringify([{ id: 1, userId: 1, title: "t" }]));
      if (url.includes("/photos")) return new Response(JSON.stringify([{ id: 1, albumId: 1, title: "t", url: "u", thumbnailUrl: "tu" }]));
      if (url.includes("/todos")) return new Response(JSON.stringify([{ id: 1, userId: 1, title: "t", completed: false }]));
      return new Response("[]");
    };
    globalThis.fetch = mockFetch;

    const result = await createAdminCaller().admin.data.seed();
    expect(result.ok).toBe(true);

    const usersAfter = await db.run(sql`SELECT COUNT(*) as count FROM users`);
    expect(usersAfter.rows[0].count).toBe(1);

    globalThis.fetch = originalFetch;
  });

  it("resetDatabase clears all data, resets sequences, and re-seeds", async () => {
    const db = getDb();
    const usersBefore = await db.run(sql`SELECT COUNT(*) as count FROM users`);
    expect(usersBefore.rows[0].count).toBeGreaterThan(0);

    const originalFetch = globalThis.fetch;
    const mockFetch2 = async (input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.href;
      if (url.includes("/users")) return new Response(JSON.stringify([{ id: 1, name: "Mock", username: "mock", email: "m@m", address: {}, phone: "", website: "", company: {} }]));
      if (url.includes("/posts")) return new Response(JSON.stringify([{ id: 1, userId: 1, title: "t", body: "b" }]));
      if (url.includes("/comments")) return new Response(JSON.stringify([{ id: 1, postId: 1, name: "n", email: "e", body: "b" }]));
      if (url.includes("/albums")) return new Response(JSON.stringify([{ id: 1, userId: 1, title: "t" }]));
      if (url.includes("/photos")) return new Response(JSON.stringify([{ id: 1, albumId: 1, title: "t", url: "u", thumbnailUrl: "tu" }]));
      if (url.includes("/todos")) return new Response(JSON.stringify([{ id: 1, userId: 1, title: "t", completed: false }]));
      return new Response("[]");
    };
    globalThis.fetch = mockFetch2;

    const result = await createAdminCaller().admin.data.resetDatabase();
    expect(result.ok).toBe(true);

    const usersAfter = await db.run(sql`SELECT COUNT(*) as count FROM users`);
    expect(usersAfter.rows[0].count).toBe(1);

    globalThis.fetch = originalFetch;
  });

  it("seed rejects unauthenticated requests", async () => {
    await expect(createCaller().admin.data.seed())
      .rejects.toThrow("Admin authentication required");
  });

  it("rejects requests with invalid token", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://test.com", {
        headers: { authorization: "Bearer invalid-token-12345" },
      }),
      resHeaders: new Headers(),
    });
    await expect(caller.admin.data.seed())
      .rejects.toThrow("Invalid or expired session");
  });

  it("rejects requests with expired session", async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(now - day - 1);
    const loginResult = await createCaller().admin.auth.login({ username: "admin", password: "admin123" });
    vi.restoreAllMocks();
    const caller = appRouter.createCaller({
      req: new Request("http://test.com", {
        headers: { authorization: `Bearer ${loginResult.token}` },
      }),
      resHeaders: new Headers(),
    });
    await expect(caller.admin.settings.update({ key: "REDIS_ENABLED", value: "x" }))
      .rejects.toThrow("Invalid or expired session");
  });
});
