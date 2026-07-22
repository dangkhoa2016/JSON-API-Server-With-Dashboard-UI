import { describe, it, expect, vi, beforeEach } from "vitest";

describe("middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports createRouter, publicQuery, adminQuery", async () => {
    const mod = await import("../middleware");
    expect(mod.createRouter).toBeDefined();
    expect(mod.publicQuery).toBeDefined();
    expect(mod.adminQuery).toBeDefined();
  });

  it("adminQuery throws UNAUTHORIZED without auth header", async () => {
    vi.doMock("../lib/adminAuth", () => ({
      verifySession: vi.fn(() => null),
    }));
    const { adminQuery } = await import("../middleware");
    const testRouter = (await import("../middleware")).createRouter({
      test: (await import("../middleware")).adminQuery.query(() => "ok"),
    });
    const caller = testRouter.createCaller({
      req: new Request("http://localhost", {
        headers: {},
      }),
      resHeaders: new Headers(),
    });
    await expect(caller.test()).rejects.toThrow("Admin authentication required");
  });

  it("adminQuery throws UNAUTHORIZED with invalid token", async () => {
    vi.doMock("../lib/adminAuth", () => ({
      verifySession: vi.fn(() => null),
    }));
    const { adminQuery, createRouter } = await import("../middleware");
    const testRouter = createRouter({
      test: adminQuery.query(() => "ok"),
    });
    const caller = testRouter.createCaller({
      req: new Request("http://localhost", {
        headers: { authorization: "Bearer invalid-token" },
      }),
      resHeaders: new Headers(),
    });
    await expect(caller.test()).rejects.toThrow("Invalid or expired session");
  });

  it("adminQuery passes with valid token", async () => {
    vi.doMock("../lib/adminAuth", () => ({
      verifySession: vi.fn(() => ({ username: "admin", role: "admin", createdAt: Date.now() })),
    }));
    const { adminQuery, createRouter } = await import("../middleware");
    const testRouter = createRouter({
      test: adminQuery.query(() => "ok"),
    });
    const caller = testRouter.createCaller({
      req: new Request("http://localhost", {
        headers: { authorization: "Bearer valid-token" },
      }),
      resHeaders: new Headers(),
    });
    const result = await caller.test();
    expect(result).toBe("ok");
  });
});
