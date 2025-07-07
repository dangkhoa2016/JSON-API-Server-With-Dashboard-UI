import { createHmac, randomBytes, timingSafeEqual } from "crypto";

interface AdminSession {
  username: string;
  role: string;
  createdAt: number;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SECRET = process.env.ADMIN_SECRET || randomBytes(32).toString("hex");

export function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSession(username: string): string {
  const payload: AdminSession = { username, role: "admin", createdAt: Date.now() };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(data);
  return `${data}.${sig}`;
}

export function verifySession(token: string): AdminSession | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = sign(data);
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
