import { describe, it, expect, vi, beforeEach } from "vitest";

describe("adminAuth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("sign produces consistent signatures", async () => {
    const { sign } = await import("../lib/adminAuth");
    const sig1 = sign("hello");
    const sig2 = sign("hello");
    expect(sig1).toBe(sig2);
    expect(sig1.length).toBeGreaterThan(0);
  });

  it("sign produces different signatures for different inputs", async () => {
    const { sign } = await import("../lib/adminAuth");
    const sig1 = sign("hello");
    const sig2 = sign("world");
    expect(sig1).not.toBe(sig2);
  });

  it("createSession returns a valid token", async () => {
    const { createSession } = await import("../lib/adminAuth");
    const token = createSession("admin");
    expect(token).toContain(".");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
  });

  it("createSession creates different tokens for different users", async () => {
    const { createSession } = await import("../lib/adminAuth");
    const token1 = createSession("user1");
    const token2 = createSession("user2");
    expect(token1).not.toBe(token2);
  });

  it("verifySession returns session for valid token", async () => {
    const { createSession, verifySession } = await import("../lib/adminAuth");
    const token = createSession("admin");
    const session = verifySession(token);
    expect(session).not.toBeNull();
    expect(session!.username).toBe("admin");
    expect(session!.role).toBe("admin");
    expect(session!.createdAt).toBeGreaterThan(0);
  });

  it("verifySession rejects token with wrong signature (same length)", async () => {
    const { createSession, sign, verifySession } = await import("../lib/adminAuth");
    const token = createSession("admin");
    const [data] = token.split(".");
    const fakeSig = sign("wrong-data");
    const session = verifySession(`${data}.${fakeSig}`);
    expect(session).toBeNull();
  });

  it("verifySession rejects token with no dot separator", async () => {
    const { verifySession } = await import("../lib/adminAuth");
    const session = verifySession("invalidtoken");
    expect(session).toBeNull();
  });

  it("verifySession rejects token with empty string", async () => {
    const { verifySession } = await import("../lib/adminAuth");
    const session = verifySession("");
    expect(session).toBeNull();
  });

  it("verifySession rejects token with too many parts", async () => {
    const { verifySession } = await import("../lib/adminAuth");
    const session = verifySession("a.b.c");
    expect(session).toBeNull();
  });

  it("verifySession rejects corrupted base64 data", async () => {
    const { sign } = await import("../lib/adminAuth");
    const { verifySession } = await import("../lib/adminAuth");
    const badData = "!!!invalid-base64!!!";
    const sig = sign(badData);
    const session = verifySession(`${badData}.${sig}`);
    expect(session).toBeNull();
  });

  it("verifySession rejects expired token", async () => {
    const { sign } = await import("../lib/adminAuth");
    const { verifySession } = await import("../lib/adminAuth");
    const expiredPayload = {
      username: "admin",
      role: "admin",
      createdAt: Date.now() - 25 * 60 * 60 * 1000,
    };
    const data = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
    const sig = sign(data);
    const session = verifySession(`${data}.${sig}`);
    expect(session).toBeNull();
  });
});
