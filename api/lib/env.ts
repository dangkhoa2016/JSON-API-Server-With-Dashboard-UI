import "dotenv/config";
import crypto from "node:crypto";
import { DEFAULT_DATABASE_URL } from "../../db/config";

function requiredInProduction(name: string, defaultValue: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return defaultValue;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function optionalInt(name: string, defaultValue: number): number {
  const val = process.env[name];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function optionalBool(name: string, defaultValue: boolean): boolean {
  const val = process.env[name];
  if (!val) return defaultValue;
  return val === "true" || val === "1" || val === "yes";
}

export const env = {
  appSecret: requiredInProduction("APP_SECRET", crypto.randomBytes(32).toString("hex")),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: requiredInProduction("DATABASE_URL", DEFAULT_DATABASE_URL),
  // Redis config
  redisHost: optional("REDIS_HOST", "localhost"),
  redisPort: optionalInt("REDIS_PORT", 6379),
  redisPassword: optional("REDIS_PASSWORD", ""),
  redisDb: optionalInt("REDIS_DB", 0),
  redisEnabled: optionalBool("REDIS_ENABLED", false),
  // Rate limit config
  rateLimitEnabled: optionalBool("RATE_LIMIT_ENABLED", true),
  rateLimitWindowMs: optionalInt("RATE_LIMIT_WINDOW_MS", 60000),
  rateLimitMaxRequests: optionalInt("RATE_LIMIT_MAX_REQUESTS", 100),
  // Cache config
  cacheEnabled: optionalBool("CACHE_ENABLED", false),
  cacheTtlSeconds: optionalInt("CACHE_TTL_SECONDS", 300),
  // Debug
  debugSql: optionalBool("DEBUG_SQL", false),
  // Security
  corsOrigins: optional("CORS_ORIGINS", "*"),
  corsOriginList: (() => {
    const raw = optional("CORS_ORIGINS", "*");
    if (process.env.NODE_ENV === "production" && raw === "*") {
      throw new Error(
        'CORS_ORIGINS cannot be "*" in production. ' +
        "Set explicit origins like " +
        '"https://example.com,https://admin.example.com" ' +
        'or "http://localhost:5173,http://localhost:4173" for development.',
      );
    }
    const list = raw
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const unique = [...new Set(list)];
    return unique.length === 1 && unique[0] === "*" ? "*" : unique;
  })(),
  trustedProxyCidrs: optional("TRUSTED_PROXY_CIDRS", "127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean),
};
