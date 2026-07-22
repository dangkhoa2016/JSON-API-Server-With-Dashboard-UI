import { describe, it, expect, vi, beforeEach } from "vitest";

describe("context", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("createContext returns req and resHeaders from opts", async () => {
    const { createContext } = await import("../context");
    const req = new Request("http://localhost:3000");
    const resHeaders = new Headers();
    const ctx = await createContext({ req, resHeaders } as any);
    expect(ctx.req).toBe(req);
    expect(ctx.resHeaders).toBe(resHeaders);
  });

  it("createContext passes through the exact request object", async () => {
    const { createContext } = await import("../context");
    const req = new Request("http://localhost:3000/test");
    const resHeaders = new Headers();
    const ctx = await createContext({ req, resHeaders } as any);
    expect(ctx.req.url).toBe("http://localhost:3000/test");
  });
});
