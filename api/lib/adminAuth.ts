import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { getDb } from "../queries/connection";
import * as schema from "../../db/schema";
import { eq } from "drizzle-orm";

interface AdminSession {
  username: string;
  role: string;
  createdAt: number;
  sessionId: string;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cache secret in memory with TTL to avoid DB query on every request
let cachedSecret: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

async function getSessionSecret(): Promise<string> {
  const now = Date.now();
  if (cachedSecret && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSecret;
  }

  const db = getDb();
  const row = await db.select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "ADMIN_SESSION_SECRET"))
    .get();

  if (!row) {
    throw new Error("ADMIN_SESSION_SECRET not configured in database");
  }

  cachedSecret = row.value;
  cacheTimestamp = now;
  return cachedSecret;
}

export async function sign(payload: string): Promise<string> {
  const secret = await getSessionSecret();
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function createSession(username: string): Promise<string> {
  const payload: AdminSession = {
    username,
    role: "admin",
    createdAt: Date.now(),
    sessionId: randomUUID(),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = await sign(data);
  return `${data}.${sig}`;
}

export async function verifySession(token: string): Promise<AdminSession | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = await sign(data);
  if (!sig || sig.length !== expectedSig.length) return null;
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as AdminSession;
    if (Date.now() - payload.createdAt > SESSION_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
