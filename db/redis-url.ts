export const REDIS_URL_ERROR =
  "REDIS_URL must be a valid redis:// or rediss:// URL (format: redis://[user:pass@]host:port[/db])";

export function validateRedisUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return REDIS_URL_ERROR;
  }
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    return REDIS_URL_ERROR;
  }
  if (!parsed.hostname) {
    return REDIS_URL_ERROR;
  }
  if (parsed.port !== "") {
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return REDIS_URL_ERROR;
    }
  }
  const path = parsed.pathname;
  if (path !== "" && path !== "/") {
    const dbIndex = path.replace(/^\//, "");
    if (!/^\d+$/.test(dbIndex)) {
      return REDIS_URL_ERROR;
    }
  }
  return null;
}
