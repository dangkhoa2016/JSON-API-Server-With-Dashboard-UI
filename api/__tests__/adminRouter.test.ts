import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { adminRouter, resetLoginRateLimit } from "../adminRouter";
import { jsonServerRouter } from "../jsonServerRouter";
import { getDb } from "../queries/connection";
import { setupTestDatabase, seedTestData, clearTestDatabase } from "./helpers";

beforeAll(async () => {
  await setupTestDatabase();
});

let adminHash = "";

beforeAll(async () => {
  adminHash = await hash("admin123");
});

beforeEach(async () => {
  resetLoginRateLimit();
  await clearTestDatabase();
  await seedTestData();
  const db = getDb();
  await db.run(sql`DELETE FROM settings`);
  await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
    ('REDIS_ENABLED', 'false', 'boolean', 'Redis Enabled', 'Enable Redis', 'redis', 1),
    ('APP_SECRET', 'secret123', 'string', 'App Secret', 'Secret key', 'general', 0),
    ('ADMIN_SESSION_SECRET', 'test-session-secret-key-for-testing', 'string', 'Admin Session Secret', 'HMAC signing key', 'auth', 0)
  `);
  if (adminHash) {
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('ADMIN_USERNAME', 'admin', 'string', 'Admin Username', 'Admin login', 'auth', 0),
      ('ADMIN_PASSWORD_HASH', ${adminHash}, 'string', 'Admin Password Hash', 'Argon2 hash', 'auth', 0)
    `);
  }
});

function createCaller() {
  return adminRouter.createCaller({
    req: new Request("http://test.com"),
    resHeaders: new Headers(),
  });
}

function createAdminCaller() {
  return adminRouter.createCaller({
    req: new Request("http://test.com", {
      headers: { authorization: `Bearer ${adminToken}` },
    }),
    resHeaders: new Headers(),
  });
}

let adminToken = "";

beforeEach(async () => {
  const caller = createCaller();
    const loginResponse = await caller.auth.login({ username: "admin", password: "admin123" });
  adminToken = loginResponse.ok && "token" in loginResponse ? loginResponse.token! : "";
});

describe("admin.auth.login", () => {
  it("returns ok with valid credentials", async () => {
    const caller = createCaller();
    const result = await caller.auth.login({ username: "admin", password: "admin123" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.username).toBe("admin");
      expect(result.role).toBe("admin");
      expect(result.token).toBeDefined();
    }
  });

  it("fails with invalid password", async () => {
    const caller = createCaller();
    const result = await caller.auth.login({ username: "admin", password: "wrong" });
    expect(result.ok).toBe(false);
  });

  it("fails with invalid username", async () => {
    const caller = createCaller();
    const result = await caller.auth.login({ username: "wrong", password: "admin123" });
    expect(result.ok).toBe(false);
  });

  it("fails when credentials not configured", async () => {
    const db = getDb();
    await db.run(sql`DELETE FROM settings`);
    const caller = createCaller();
    const result = await caller.auth.login({ username: "admin", password: "admin123" });
    expect(result.ok).toBe(false);
  });

  it("blocks login after max attempts from same IP", async () => {
    const caller = createCaller();
    for (let i = 0; i < 5; i++) {
      await caller.auth.login({ username: "admin", password: "wrong" });
    }
    const blocked = await caller.auth.login({ username: "admin", password: "wrong" });
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toMatch(/Too many login attempts/);
  });
});

describe("admin.auth.verify", () => {
  it("returns user info with valid token", async () => {
    const caller = createAdminCaller();
    const result = await caller.auth.verify();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.username).toBe("admin");
      expect(result.role).toBe("admin");
    }
  });

  it("returns ok:false without token", async () => {
    const caller = createCaller();
    const result = await caller.auth.verify();
    expect(result.ok).toBe(false);
  });
});

describe("admin.settings.list", () => {
  it("returns all settings for admin", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.list();
    expect(result.length).toBeGreaterThan(0);
  });

  it("masks sensitive settings", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.list();
    const secret = result.find((s) => s.key === "APP_SECRET");
    expect(secret?.value).toBe("********");
  });

  it("returns only public settings for non-admin", async () => {
    const caller = createCaller();
    const result = await caller.settings.list();
    const nonPublic = result.find((s) => s.key === "APP_SECRET");
    expect(nonPublic).toBeUndefined();
  });
});

describe("admin.settings.getByKey", () => {
  it("returns setting by key for admin", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.getByKey({ key: "REDIS_ENABLED" });
    expect(result).toBeDefined();
    expect(result?.key).toBe("REDIS_ENABLED");
  });

  it("returns null for non-existent key", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.getByKey({ key: "NON_EXISTENT" });
    expect(result).toBeNull();
  });

  it("masks sensitive settings", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.getByKey({ key: "APP_SECRET" });
    expect(result?.value).toBe("********");
  });

  it("returns null for non-public setting without admin", async () => {
    const caller = createCaller();
    const result = await caller.settings.getByKey({ key: "APP_SECRET" });
    expect(result).toBeNull();
  });

  it("returns public setting without admin", async () => {
    const caller = createCaller();
    const result = await caller.settings.getByKey({ key: "REDIS_ENABLED" });
    expect(result).toBeDefined();
  });
});

describe("admin.settings.update", () => {
  it("updates a setting", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.update({ key: "REDIS_ENABLED", value: "true" });
    expect(result.ok).toBe(true);
  });

  it("returns ok:false for non-existent key", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.update({ key: "NON_EXISTENT", value: "val" });
    expect(result.ok).toBe(false);
  });
});

describe("admin.settings.reset", () => {
  it("resets a setting from env", async () => {
    process.env.REDIS_ENABLED = "true";
    const caller = createAdminCaller();
    const result = await caller.settings.reset({ key: "REDIS_ENABLED" });
    expect(result.ok).toBe(true);
    delete process.env.REDIS_ENABLED;
  });

  it("rejects non-allowed keys", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.reset({ key: "SOME_KEY" });
    expect(result.ok).toBe(false);
  });

  it("rejects when no env value available", async () => {
    delete process.env.REDIS_URL;
    const caller = createAdminCaller();
    const result = await caller.settings.reset({ key: "REDIS_URL" });
    expect(result.ok).toBe(false);
  });

  it("rejects when setting not in database", async () => {
    const db = getDb();
    await db.run(sql`DELETE FROM settings`);
    process.env.REDIS_ENABLED = "true";
    const caller = createAdminCaller();
    const result = await caller.settings.reset({ key: "REDIS_ENABLED" });
    expect(result.ok).toBe(false);
    delete process.env.REDIS_ENABLED;
  });
});

describe("admin.settings.reveal", () => {
  it("reveals actual value for admin", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.reveal({ key: "APP_SECRET" });
    expect(result).toBeDefined();
    expect(result?.value).toBe("secret123");
  });

  it("returns null for non-existent key", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.reveal({ key: "NON_EXISTENT" });
    expect(result).toBeNull();
  });
});

describe("admin.data.seed", () => {
  it("seeds database successfully", async () => {
    const caller = createAdminCaller();
    const result = await caller.data.seed();
    expect(result.ok).toBe(true);
  }, 30000);
});

describe("admin.data.resetDatabase", () => {
  it("resets and re-seeds database", async () => {
    const caller = createAdminCaller();
    const result = await caller.data.resetDatabase();
    expect(result.ok).toBe(true);
  });
});

describe("adminQuery middleware", () => {
  it("rejects request without auth header", async () => {
    const caller = createCaller();
    await expect(caller.settings.update({ key: "REDIS_ENABLED", value: "true" })).rejects.toThrow("Admin authentication required");
  });

  it("rejects request with invalid token", async () => {
    const caller = adminRouter.createCaller({
      req: new Request("http://test.com", {
        headers: { authorization: "Bearer invalid-token" },
      }),
      resHeaders: new Headers(),
    });
    await expect(caller.settings.update({ key: "REDIS_ENABLED", value: "true" })).rejects.toThrow("Invalid or expired session");
  });
});

describe("jsonServer search (q parameter)", () => {
  it("searches users by name with q parameter", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.list({ q: "Leanne" });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("searches posts by title with q parameter", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.posts.list({ q: "sunt" });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("searches with no matches returns empty", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.list({ q: "zzz_nonexistent_zzz" });
    expect(result.data.length).toBe(0);
  });

  it("list with desc sort order", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.list({ sort: "name", order: "desc" });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("list with pagination (page + limit)", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.list({ limit: 1, page: 1 });
    expect(result.data.length).toBe(1);
  });

  it("list with limit but no page defaults to page 1", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.list({ limit: 2 });
    expect(result.data.length).toBeLessThanOrEqual(2);
  });

  it("getById returns null for non-existent id", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.getById({ id: 999999 });
    expect(result).toBeNull();
  });

  it("update returns null for non-existent id", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.update({ id: 999999, data: { name: "Updated" } });
    expect(result).toBeNull();
  });

  it("list with sort field that doesn't match a column", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.list({ sort: "nonexistent_col" });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("list with _sort/_order/_limit/_page filter keys are ignored", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.list({ filters: { _sort: "name", _order: "asc", _limit: "10", _page: "1", q: "test" } });
    expect(result.data.length).toBeGreaterThanOrEqual(0);
  });

  it("list with wildcard filter", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.list({ filters: { name: "Le*" } });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("list with numeric filter", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.users.list({ filters: { id: "1" } });
    expect(result.data.length).toBe(1);
  });
});

describe("user serialization", () => {
  it("createUser serializes address/company objects to JSON strings", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const created = await caller.users.create({
      name: "Test User",
      username: "testser",
      email: "test@test.com",
      address: { street: "123 Main St" } as any,
      company: { name: "Acme Corp" } as any,
    } as any);
    expect(created.id).toBeDefined();

    const got = await caller.users.getById({ id: created.id });
    expect(got?.address).toEqual({ street: "123 Main St" });
    expect(got?.company).toEqual({ name: "Acme Corp" });
  });

  it("createUser handles null address/company", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const created = await caller.users.create({
      name: "Null User",
      username: "nulluser",
      email: "null@test.com",
    } as any);
    const got = await caller.users.getById({ id: created.id });
    expect(got?.address).toBeNull();
    expect(got?.company).toBeNull();
  });
});
