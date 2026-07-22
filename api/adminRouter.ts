import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { verify } from "@node-rs/argon2";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "../db/schema";
import { seedDatabase, type SeedDb } from "../db/seed";
import { createSession, verifySession } from "./lib/adminAuth";

const ALLOWED_RESET_KEYS = new Set([
  "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "APP_SECRET",
  "REDIS_ENABLED", "REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD", "REDIS_DB",
  "RATE_LIMIT_ENABLED", "RATE_LIMIT_MAX_REQUESTS", "RATE_LIMIT_WINDOW_MS",
  "DEBUG_SQL", "DATABASE_URL", "REDIS_URL", "PORT", "CACHE_ENABLED",
]);

const SENSITIVE_KEYS = new Set(["ADMIN_PASSWORD_HASH", "APP_SECRET"]);

const LOGIN_ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = LOGIN_ATTEMPTS.get(ip);
  if (!entry || entry.resetAt <= now) {
    LOGIN_ATTEMPTS.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

export function resetLoginRateLimit(): void {
  LOGIN_ATTEMPTS.clear();
}

async function isAdminRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? (await verifySession(authHeader.slice(7))) !== null : false;
}

function maskSettingIfSensitive(row: schema.Setting): schema.Setting {
  if (SENSITIVE_KEYS.has(row.key)) {
    return { ...row, value: "********" };
  }
  return row;
}

export const adminRouter = createRouter({
  auth: createRouter({
    login: publicQuery
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? ctx.req.headers.get("x-real-ip")
          ?? "unknown";
        const rateCheck = checkLoginRateLimit(ip);
        if (!rateCheck.allowed) {
          return { ok: false, message: `Too many login attempts. Try again in ${rateCheck.retryAfter}s.` };
        }
        const db = getDb();
        const storedUsername = await db.select().from(schema.settings).where(eq(schema.settings.key, "ADMIN_USERNAME")).get();
        const storedHash = await db.select().from(schema.settings).where(eq(schema.settings.key, "ADMIN_PASSWORD_HASH")).get();

        if (!storedUsername || !storedHash) {
          return { ok: false, message: "Admin credentials not configured" };
        }

        if (input.username.length !== storedUsername.value.length ||
            !timingSafeEqual(Buffer.from(input.username), Buffer.from(storedUsername.value))) {
          return { ok: false, message: "Invalid username or password" };
        }

        const valid = await verify(storedHash.value, input.password);
        if (!valid) {
          return { ok: false, message: "Invalid username or password" };
        }

        const token = await createSession(input.username);
        return { ok: true, username: input.username, role: "admin", token };
      }),

    verify: publicQuery.query(async ({ ctx }) => {
      const authHeader = ctx.req.headers.get("authorization");
      const session = authHeader?.startsWith("Bearer ")
        ? await verifySession(authHeader.slice(7))
        : null;
      if (session) {
        return { ok: true, username: session.username, role: session.role };
      }
      return { ok: false };
    }),
  }),

  settings: createRouter({
    list: publicQuery.query(async (opts) => {
      const db = getDb();
      if (await isAdminRequest(opts.ctx.req)) {
        const rows = await db.select().from(schema.settings).orderBy(schema.settings.group, schema.settings.key);
        return rows.map(maskSettingIfSensitive);
      }
      return await db.select().from(schema.settings)
        .where(eq(schema.settings.isPublic, true))
        .orderBy(schema.settings.group, schema.settings.key);
    }),

    getByKey: publicQuery
      .input(z.object({ key: z.string() }))
      .query(async ({ input, ctx }) => {
        const db = getDb();
        const isAdmin = await isAdminRequest(ctx.req);
        const setting = (await db.select().from(schema.settings).where(eq(schema.settings.key, input.key)).get()) ?? null;
        if (!setting) return null;
        if (!isAdmin && !setting.isPublic) return null;
        return maskSettingIfSensitive(setting);
      }),

    update: adminQuery
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        const db = getDb();
        const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, input.key)).get();
        if (!existing) {
          return { ok: false, message: `Setting '${input.key}' not found` };
        }
        await db.update(schema.settings).set({ value: input.value }).where(eq(schema.settings.key, input.key)).run();
        return { ok: true };
      }),

    reset: adminQuery
      .input(z.object({ key: z.string() }))
      .mutation(async ({ input }) => {
        if (!ALLOWED_RESET_KEYS.has(input.key)) {
          return { ok: false, message: "This setting cannot be reset from environment" };
        }
        const envValue = process.env[input.key];
        if (envValue === undefined) {
          return { ok: false, message: "No environment value available for this setting" };
        }
        const db = getDb();
        const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, input.key)).get();
        if (!existing) {
          return { ok: false, message: "Setting not found in database" };
        }
        await db.update(schema.settings).set({ value: envValue }).where(eq(schema.settings.key, input.key)).run();
        return { ok: true };
      }),

    reveal: adminQuery
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const db = getDb();
        const setting = await db.select().from(schema.settings)
          .where(eq(schema.settings.key, input.key)).get();
        if (!setting) {
          return null;
        }
        return { key: setting.key, value: setting.value };
      }),
  }),

  data: createRouter({
    seed: adminQuery.mutation(async () => {
      const db = getDb();
      await db.delete(schema.photos).run();
      await db.delete(schema.comments).run();
      await db.delete(schema.posts).run();
      await db.delete(schema.albums).run();
      await db.delete(schema.todos).run();
      await db.delete(schema.users).run();
      await seedDatabase(db as unknown as SeedDb);
      return { ok: true };
    }),

    resetDatabase: adminQuery.mutation(async () => {
      const db = getDb();
      await db.delete(schema.photos).run();
      await db.delete(schema.comments).run();
      await db.delete(schema.posts).run();
      await db.delete(schema.albums).run();
      await db.delete(schema.todos).run();
      await db.delete(schema.users).run();
      try {
        await db.run(sql`DELETE FROM sqlite_sequence`);
      } catch {
        // sqlite_sequence may not exist (e.g., in-memory DB before any AUTOINCREMENT insert)
      }
      await seedDatabase(db as unknown as SeedDb);
      return { ok: true };
    }),
  }),
});
