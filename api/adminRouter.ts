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
  "REDIS_ENABLED", "REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD", "REDIS_TTL",
  "RATE_LIMIT_ENABLED", "RATE_LIMIT_MAX_REQUESTS", "RATE_LIMIT_WINDOW_MS",
  "DEBUG_SQL", "DATABASE_URL", "REDIS_URL", "PORT", "CACHE_ENABLED",
]);

const SENSITIVE_KEYS = new Set(["ADMIN_PASSWORD_HASH", "APP_SECRET"]);

function isAdminRequest(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? verifySession(authHeader.slice(7)) !== null : false;
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
      .mutation(async ({ input }) => {
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

        const token = createSession(input.username);
        return { ok: true, username: input.username, role: "admin", token };
      }),

    verify: publicQuery.query(({ ctx }) => {
      const authHeader = ctx.req.headers.get("authorization");
      const session = authHeader?.startsWith("Bearer ")
        ? verifySession(authHeader.slice(7))
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
      if (isAdminRequest(opts.ctx.req)) {
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
        const isAdmin = isAdminRequest(ctx.req);
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
