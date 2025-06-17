import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
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
};
