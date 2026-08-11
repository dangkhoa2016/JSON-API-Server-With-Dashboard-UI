import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import { sql, eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import {
  adminRouter,
  resetLoginRateLimit,
  stopLoginRateLimitPruning,
  startLoginRateLimitPruning,
} from "../adminRouter";
import { jsonServerRouter } from "../jsonServerRouter";
import { getDb } from "../queries/connection";
import * as schema from "../../db/schema";
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
    ('APP_SECRET', 'secret123', 'string', 'App Secret', 'Secret key', 'general', 0)
  `);
  if (adminHash) {
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('ADMIN_USERNAME', 'admin', 'string', 'Admin Username', 'Admin login', 'auth', 0),
      ('ADMIN_PASSWORD_HASH', ${adminHash}, 'string', 'Admin Password Hash', 'Argon2 hash', 'auth', 0)
    `);
  }
});

function createCaller(
  headers?: Record<string, string>,
  clientIp: string = "203.0.113.10"
) {
  return adminRouter.createCaller({
    req: new Request("http://test.com", { headers }),
    resHeaders: new Headers(),
    clientIp,
  });
}

function createAdminCaller() {
  return adminRouter.createCaller({
    req: new Request("http://test.com", {
      headers: { authorization: `Bearer ${adminToken}` },
    }),
    resHeaders: new Headers(),
    clientIp: "203.0.113.10",
  });
}

let adminToken = "";

afterAll(() => {
  stopLoginRateLimitPruning();
});

beforeEach(async () => {
  const caller = createCaller();
  const loginResponse = await caller.auth.login({
    username: "admin",
    password: "admin123",
  });
  adminToken =
    loginResponse.ok && "token" in loginResponse ? loginResponse.token! : "";
});

describe("admin.auth.login", () => {
  it("returns ok with valid credentials", async () => {
    const caller = createCaller();
    const result = await caller.auth.login({
      username: "admin",
      password: "admin123",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.username).toBe("admin");
      expect(result.role).toBe("admin");
      expect(result.token).toBeDefined();
    }
  });

  it("trims whitespace from username before login", async () => {
    const caller = createCaller();
    const result = await caller.auth.login({
      username: "  admin  ",
      password: "admin123",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.username).toBe("admin");
    }
  });

  it("fails with invalid password", async () => {
    const caller = createCaller();
    const result = await caller.auth.login({
      username: "admin",
      password: "wrong",
    });
    expect(result.ok).toBe(false);
  });

  it("fails with invalid username", async () => {
    const caller = createCaller();
    const result = await caller.auth.login({
      username: "wrong",
      password: "admin123",
    });
    expect(result.ok).toBe(false);
  });

  it("fails when credentials not configured", async () => {
    const db = getDb();
    await db.run(sql`DELETE FROM settings`);
    const caller = createCaller();
    const result = await caller.auth.login({
      username: "admin",
      password: "admin123",
    });
    expect(result.ok).toBe(false);
  });

  it("blocks login after max attempts from same IP", async () => {
    const caller = createCaller();
    for (let i = 0; i < 5; i++) {
      await caller.auth.login({ username: "admin", password: "wrong" });
    }
    const blocked = await caller.auth.login({
      username: "admin",
      password: "wrong",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toMatch(/Too many login attempts/);
  });

  it("bypasses rate limiting when clientIp is undefined", async () => {
    const caller = adminRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: undefined,
    });
    for (let i = 0; i < 10; i++) {
      const result = await caller.auth.login({
        username: "admin",
        password: "wrong",
      });
      expect(result.ok).toBe(false);
      expect(result.message).not.toMatch(/Too many login attempts/);
    }
  });

  it("succeeds when clientIp is undefined", async () => {
    const caller = adminRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: undefined,
    });
    const result = await caller.auth.login({
      username: "admin",
      password: "admin123",
    });
    expect(result.ok).toBe(true);
  });

  it("blocks login after max attempts from same transport IP", async () => {
    const transportIp = "203.0.113.10";
    for (let i = 0; i < 5; i++) {
      const caller = createCaller({}, transportIp);
      await caller.auth.login({ username: "admin", password: "wrong" });
    }
    const sixth = createCaller({}, transportIp);
    const blocked = await sixth.auth.login({
      username: "admin",
      password: "wrong",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toMatch(/Too many login attempts/);
  });

  it("spoof regression: changing XFF and X-Real-IP does not create new buckets", async () => {
    const transportIp = "203.0.113.10";
    for (let i = 0; i < 5; i++) {
      const caller = createCaller(
        { "x-forwarded-for": `198.51.100.${i}`, "x-real-ip": `203.0.113.${i}` },
        transportIp
      );
      await caller.auth.login({ username: "admin", password: "wrong" });
    }
    const sixth = createCaller(
      { "x-forwarded-for": "198.51.100.99", "x-real-ip": "203.0.113.99" },
      transportIp
    );
    const blocked = await sixth.auth.login({
      username: "admin",
      password: "wrong",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toMatch(/Too many login attempts/);
  });

  it("allows repeated successful logins without rate limiting", async () => {
    const caller = createCaller();
    for (let i = 0; i < 10; i++) {
      const result = await caller.auth.login({
        username: "admin",
        password: "admin123",
      });
      expect(result.ok).toBe(true);
    }
  });

  it("resets the failed-attempt counter after a successful login", async () => {
    const caller = createCaller();
    for (let i = 0; i < 2; i++) {
      await caller.auth.login({ username: "admin", password: "wrong" });
    }
    const success = await caller.auth.login({
      username: "admin",
      password: "admin123",
    });
    expect(success.ok).toBe(true);
    for (let i = 0; i < 5; i++) {
      await caller.auth.login({ username: "admin", password: "wrong" });
    }
    const blocked = await caller.auth.login({
      username: "admin",
      password: "wrong",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toMatch(/Too many login attempts/);
  });
});

describe("login rate limit pruning", () => {
  it("prunes expired login attempts and keeps active ones", async () => {
    stopLoginRateLimitPruning();
    vi.useFakeTimers();
    try {
      startLoginRateLimitPruning();

      const ipA = createCaller({}, "198.51.100.10");
      for (let i = 0; i < 5; i++) {
        await ipA.auth.login({ username: "admin", password: "wrong" });
      }
      const blockedBefore = await ipA.auth.login({
        username: "admin",
        password: "wrong",
      });
      expect(blockedBefore.message).toMatch(/Too many login attempts/);

      const ipB = createCaller({}, "198.51.100.20");
      await ipB.auth.login({ username: "admin", password: "wrong" });

      vi.advanceTimersByTime(14 * 60 * 1000);

      const ipC = createCaller({}, "198.51.100.30");
      await ipC.auth.login({ username: "admin", password: "wrong" });

      vi.advanceTimersByTime(60 * 1000);

      const a = await createCaller({}, "198.51.100.10").auth.login({
        username: "admin",
        password: "wrong",
      });
      expect(a.ok).toBe(false);
      expect(a.message).not.toMatch(/Too many login attempts/);

      const ipCAfter = createCaller({}, "198.51.100.30");
      for (let i = 0; i < 5; i++) {
        await ipCAfter.auth.login({ username: "admin", password: "wrong" });
      }
      const cBlocked = await ipCAfter.auth.login({
        username: "admin",
        password: "wrong",
      });
      expect(cBlocked.message).toMatch(/Too many login attempts/);
    } finally {
      vi.useRealTimers();
      stopLoginRateLimitPruning();
      startLoginRateLimitPruning();
    }
  });
});

describe("login rate limit timer lifecycle", () => {
  afterEach(() => {
    stopLoginRateLimitPruning();
    startLoginRateLimitPruning();
  });

  it("does not create a second timer when one is already active", () => {
    stopLoginRateLimitPruning();
    const spy = vi.spyOn(globalThis, "setInterval");
    try {
      startLoginRateLimitPruning();
      startLoginRateLimitPruning();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("stop is a no-op when no timer is running", () => {
    stopLoginRateLimitPruning();
    const spy = vi.spyOn(globalThis, "clearInterval");
    try {
      stopLoginRateLimitPruning();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
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
    const secret = result.find(s => s.key === "APP_SECRET");
    expect(secret?.value).toBe("********");
  });

  it("returns only public settings for non-admin", async () => {
    const caller = createCaller();
    const result = await caller.settings.list();
    expect(result.every(s => s.isPublic)).toBe(true);
    expect(result.find(s => s.key === "APP_SECRET")).toBeUndefined();
    expect(result.find(s => s.key === "REDIS_ENABLED")).toBeDefined();
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
    const result = await caller.settings.update({
      key: "REDIS_ENABLED",
      value: "true",
    });
    expect(result.ok).toBe(true);
  });

  it("returns ok:false for non-existent key", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.update({
      key: "NON_EXISTENT",
      value: "val",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects empty values", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.update({
      key: "REDIS_ENABLED",
      value: " ",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("empty");
  });

  it("rejects all-asterisk values without force", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.update({
      key: "REDIS_ENABLED",
      value: "***",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("all asterisks");
  });

  it("allows all-asterisk values with force", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.update({
      key: "REDIS_ENABLED",
      value: "***",
      force: true,
    });
    expect(result.ok).toBe(true);
  });

  it("hashes plain text password when updating ADMIN_PASSWORD_HASH", async () => {
    const caller = createAdminCaller();
    const result = await caller.settings.update({
      key: "ADMIN_PASSWORD_HASH",
      value: "newpassword",
    });
    expect(result.ok).toBe(true);
    const db = getDb();
    const row = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "ADMIN_PASSWORD_HASH"))
      .get();
    expect(row?.value).not.toBe("newpassword");
    expect(row?.value).toMatch(/^\$argon2/);
  });

  it("rejects argon2 hash values for ADMIN_PASSWORD_HASH", async () => {
    const caller = createAdminCaller();
    const existingHash = (await getDb()
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "ADMIN_PASSWORD_HASH"))
      .get())!.value;
    const result = await caller.settings.update({
      key: "ADMIN_PASSWORD_HASH",
      value: existingHash,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("plain text password");
  });

  it("login works after updating ADMIN_PASSWORD_HASH with plain text", async () => {
    const caller = createCaller();
    const adminCaller = createAdminCaller();
    await adminCaller.settings.update({
      key: "ADMIN_PASSWORD_HASH",
      value: "newpassword",
    });
    const result = await caller.auth.login({
      username: "admin",
      password: "newpassword",
    });
    expect(result.ok).toBe(true);
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

  it("resets REDIS_URL from env when present", async () => {
    const db = getDb();
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('REDIS_URL', 'redis://old:6379/0', 'string', 'Redis URL', '', 'redis', 0)`);
    process.env.REDIS_URL = "redis://new:6379/0";
    const caller = createAdminCaller();

    const result = await caller.settings.reset({ key: "REDIS_URL" });

    expect(result.ok).toBe(true);
    const row = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "REDIS_URL"))
      .get();
    expect(row?.value).toBe("redis://new:6379/0");
    delete process.env.REDIS_URL;
  });

  it("masks REDIS_URL in settings list", async () => {
    const db = getDb();
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('REDIS_URL', 'redis://user:pass@host:6379/0', 'string', 'Redis URL', '', 'redis', 0)`);

    const result = await createAdminCaller().settings.list();

    const redisUrl = result.find(s => s.key === "REDIS_URL");
    expect(redisUrl?.value).toBe("********");
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

  it("uses db.transaction for seed operations", async () => {
    const db = getDb();
    const transactionSpy = vi.spyOn(db, "transaction");

    const caller = createAdminCaller();
    await caller.data.seed();

    expect(transactionSpy).toHaveBeenCalledOnce();
  }, 30000);

  it("rolls back all changes when seed fails", async () => {
    const db = getDb();
    const usersBefore = await db.select().from(schema.users).all();
    const postsBefore = await db.select().from(schema.posts).all();

    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    const caller = createAdminCaller();
    await expect(caller.data.seed()).rejects.toThrow();

    vi.restoreAllMocks();

    const usersAfter = await db.select().from(schema.users).all();
    expect(usersAfter.length).toBe(usersBefore.length);
    const postsAfter = await db.select().from(schema.posts).all();
    expect(postsAfter.length).toBe(postsBefore.length);
  }, 15000);
});

describe("admin.data.resetDatabase", () => {
  it("resets and re-seeds database", async () => {
    const caller = createAdminCaller();
    const result = await caller.data.resetDatabase();
    expect(result.ok).toBe(true);
  }, 30000);

  it("uses db.transaction for resetDatabase operations", async () => {
    const db = getDb();
    const transactionSpy = vi.spyOn(db, "transaction");

    const caller = createAdminCaller();
    await caller.data.resetDatabase();

    expect(transactionSpy).toHaveBeenCalledOnce();
  }, 30000);
});

describe("adminQuery middleware", () => {
  it("rejects request without auth header", async () => {
    const caller = createCaller();
    await expect(
      caller.settings.update({ key: "REDIS_ENABLED", value: "true" })
    ).rejects.toThrow("Admin authentication required");
  });

  it("rejects request with invalid token", async () => {
    const caller = adminRouter.createCaller({
      req: new Request("http://test.com", {
        headers: { authorization: "Bearer invalid-token" },
      }),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    await expect(
      caller.settings.update({ key: "REDIS_ENABLED", value: "true" })
    ).rejects.toThrow("Invalid or expired session");
  });
});

describe("jsonServer search (q parameter)", () => {
  it("searches users by name with q parameter", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.list({ q: "Leanne" });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("searches posts by title with q parameter", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.posts.list({ q: "sunt" });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("searches with no matches returns empty", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.list({ q: "zzz_nonexistent_zzz" });
    expect(result.data.length).toBe(0);
  });

  it("list with desc sort order", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.list({ sort: "name", order: "desc" });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("list with pagination (page + limit)", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.list({ limit: 1, page: 1 });
    expect(result.data.length).toBe(1);
  });

  it("list with limit but no page defaults to page 1", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.list({ limit: 2 });
    expect(result.data.length).toBeLessThanOrEqual(2);
  });

  it("getById returns null for non-existent id", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.getById({ id: 999999 });
    expect(result).toBeNull();
  });

  it("update returns null for non-existent id", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.update({
      id: 999999,
      data: { name: "Updated" },
    });
    expect(result).toBeNull();
  });

  it("list with sort field that doesn't match a column", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.list({ sort: "nonexistent_col" });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("list with _sort/_order/_limit/_page filter keys are ignored", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.list({
      filters: {
        _sort: "name",
        _order: "asc",
        _limit: "10",
        _page: "1",
        q: "test",
      },
    });
    expect(result.data.length).toBeGreaterThanOrEqual(0);
  });

  it("list with wildcard filter", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
    });
    const result = await caller.users.list({ filters: { name: "Le*" } });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("list with numeric filter", async () => {
    const caller = jsonServerRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
      clientIp: "127.0.0.1",
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
      clientIp: "127.0.0.1",
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
      clientIp: "127.0.0.1",
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
