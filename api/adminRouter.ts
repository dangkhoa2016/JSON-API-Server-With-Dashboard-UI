import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as schema from "../db/schema";
import { replaceSeedData } from "../db/seed";
import type { SeedDb } from "../db/config";
import { createSession, verifySession } from "./lib/adminAuth";
import { validateRedisUrl } from "@db/redis-url";
const ALLOWED_RESET_KEYS = new Set([
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD_HASH",
  "APP_SECRET",
  "REDIS_ENABLED",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PASSWORD",
  "REDIS_DB",
  "RATE_LIMIT_ENABLED",
  "RATE_LIMIT_MAX_REQUESTS",
  "RATE_LIMIT_WINDOW_MS",
  "DEBUG_SQL",
  "DATABASE_URL",
  "REDIS_URL",
  "PORT",
  "CACHE_ENABLED",
]);

const SENSITIVE_KEYS = new Set([
  "ADMIN_PASSWORD_HASH",
  "APP_SECRET",
  "REDIS_PASSWORD",
  "REDIS_URL",
]);

const LOGIN_ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
let pruneTimer: ReturnType<typeof setInterval> | undefined;

function checkLoginRateLimit(ip: string | undefined): {
  allowed: boolean;
  retryAfter?: number;
} {
  if (!ip) return { allowed: true };
  const now = Date.now();
  const entry = LOGIN_ATTEMPTS.get(ip);
  if (!entry || entry.resetAt <= now) return { allowed: true };
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  return { allowed: true };
}

function recordLoginFailure(ip: string | undefined): void {
  if (!ip) return;
  const now = Date.now();
  const entry = LOGIN_ATTEMPTS.get(ip);
  if (!entry || entry.resetAt <= now) {
    LOGIN_ATTEMPTS.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count = Math.min(entry.count + 1, LOGIN_MAX_ATTEMPTS);
}

function recordLoginSuccess(ip: string | undefined): void {
  if (ip) LOGIN_ATTEMPTS.delete(ip);
}

function pruneLoginAttempts(): void {
  const now = Date.now();
  for (const [ip, entry] of LOGIN_ATTEMPTS) {
    if (entry.resetAt <= now) LOGIN_ATTEMPTS.delete(ip);
  }
}

export function startLoginRateLimitPruning(): void {
  if (!pruneTimer)
    pruneTimer = setInterval(pruneLoginAttempts, LOGIN_WINDOW_MS);
  pruneTimer.unref?.();
}

export function stopLoginRateLimitPruning(): void {
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = undefined;
  }
}

startLoginRateLimitPruning();

export function resetLoginRateLimit(): void {
  LOGIN_ATTEMPTS.clear();
}

async function isAdminRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  return authHeader?.startsWith("Bearer ")
    ? (await verifySession(authHeader.slice(7))) !== null
    : false;
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
        const rateCheck = checkLoginRateLimit(ctx.clientIp);
        if (!rateCheck.allowed) {
          return {
            ok: false,
            message: `Too many login attempts. Try again in ${rateCheck.retryAfter}s.`,
          };
        }
        const db = getDb();
        const trimmedUsername = input.username.trim();
        const storedUsername = await db
          .select()
          .from(schema.settings)
          .where(eq(schema.settings.key, "ADMIN_USERNAME"))
          .get();
        const storedHash = await db
          .select()
          .from(schema.settings)
          .where(eq(schema.settings.key, "ADMIN_PASSWORD_HASH"))
          .get();

        if (!storedUsername || !storedHash) {
          recordLoginFailure(ctx.clientIp);
          return { ok: false, message: "Admin credentials not configured" };
        }

        if (
          trimmedUsername.length !== storedUsername.value.length ||
          !timingSafeEqual(
            Buffer.from(trimmedUsername),
            Buffer.from(storedUsername.value)
          )
        ) {
          recordLoginFailure(ctx.clientIp);
          return { ok: false, message: "Invalid username or password" };
        }

        const valid = await verify(storedHash.value, input.password);
        if (!valid) {
          recordLoginFailure(ctx.clientIp);
          return { ok: false, message: "Invalid username or password" };
        }

        recordLoginSuccess(ctx.clientIp);
        const token = await createSession(trimmedUsername);
        return { ok: true, username: trimmedUsername, role: "admin", token };
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
    list: publicQuery.query(async opts => {
      const db = getDb();
      if (await isAdminRequest(opts.ctx.req)) {
        const rows = await db
          .select()
          .from(schema.settings)
          .orderBy(schema.settings.group, schema.settings.key);
        return rows.map(maskSettingIfSensitive);
      }
      return db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.isPublic, true))
        .orderBy(schema.settings.group, schema.settings.key);
    }),

    getByKey: publicQuery
      .input(z.object({ key: z.string() }))
      .query(async ({ input, ctx }) => {
        const db = getDb();
        const isAdmin = await isAdminRequest(ctx.req);
        const setting =
          (await db
            .select()
            .from(schema.settings)
            .where(eq(schema.settings.key, input.key))
            .get()) ?? null;
        if (!setting) return null;
        if (!isAdmin && !setting.isPublic) return null;
        return maskSettingIfSensitive(setting);
      }),

    update: adminQuery
      .input(
        z.object({
          key: z.string(),
          value: z.string(),
          force: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = getDb();
        const existing = await db
          .select()
          .from(schema.settings)
          .where(eq(schema.settings.key, input.key))
          .get();
        if (!existing) {
          return { ok: false, message: `Setting '${input.key}' not found` };
        }
        if (!input.value.trim()) {
          return { ok: false, message: "Value cannot be empty" };
        }
        if (/^\*+$/.test(input.value) && !input.force) {
          return {
            ok: false,
            message:
              "Value cannot be all asterisks. Pass 'force: true' to override.",
          };
        }
        if (
          input.key === "ADMIN_PASSWORD_HASH" &&
          input.value.startsWith("$argon2")
        ) {
          return {
            ok: false,
            message:
              "Password hash detected. Please enter a plain text password instead.",
          };
        }
        if (input.key === "REDIS_URL") {
          const error = validateRedisUrl(input.value);
          if (error) {
            return { ok: false, message: error };
          }
        }
        let valueToStore = input.value;
        if (input.key === "ADMIN_PASSWORD_HASH") {
          valueToStore = await hash(input.value);
        }
        await db
          .update(schema.settings)
          .set({ value: valueToStore })
          .where(eq(schema.settings.key, input.key))
          .run();
        return { ok: true };
      }),

    reset: adminQuery
      .input(z.object({ key: z.string() }))
      .mutation(async ({ input }) => {
        if (!ALLOWED_RESET_KEYS.has(input.key)) {
          return {
            ok: false,
            message: "This setting cannot be reset from environment",
          };
        }
        const envValue = process.env[input.key];
        if (envValue === undefined) {
          return {
            ok: false,
            message: "No environment value available for this setting",
          };
        }
        const db = getDb();
        const existing = await db
          .select()
          .from(schema.settings)
          .where(eq(schema.settings.key, input.key))
          .get();
        if (!existing) {
          return { ok: false, message: "Setting not found in database" };
        }
        await db
          .update(schema.settings)
          .set({ value: envValue })
          .where(eq(schema.settings.key, input.key))
          .run();
        return { ok: true };
      }),

    reveal: adminQuery
      .input(z.object({ key: z.string() }))
      .mutation(async ({ input }) => {
        const db = getDb();
        const setting = await db
          .select()
          .from(schema.settings)
          .where(eq(schema.settings.key, input.key))
          .get();
        if (!setting) {
          return null;
        }
        return { key: setting.key, value: setting.value };
      }),
  }),

  data: createRouter({
    seed: adminQuery.mutation(async () => {
      const db = getDb();
      await db.transaction(async tx => {
        await replaceSeedData(tx as unknown as SeedDb);
      });
      return { ok: true };
    }),

    resetDatabase: adminQuery.mutation(async () => {
      const db = getDb();
      await db.transaction(async tx => {
        await replaceSeedData(tx as unknown as SeedDb, true);
      });
      return { ok: true };
    }),
  }),
});
