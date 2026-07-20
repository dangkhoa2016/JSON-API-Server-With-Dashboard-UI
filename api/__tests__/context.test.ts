import { describe, it, expect } from "vitest";
import { createContext } from "../context";

describe("createContext", () => {
  it("returns req and resHeaders from opts", async () => {
    const req = new Request("http://test.com/api/trpc");
    const resHeaders = new Headers({ "x-custom": "value" });
    const opts = {
      req,
      resHeaders,
      info: {} as any,
      signal: new AbortController().signal,
    };

    const ctx = await createContext(opts);
    expect(ctx.req).toBe(req);
    expect(ctx.resHeaders).toBe(resHeaders);
  });

  it("sets clientIp to undefined when no x-forwarded-for header present", async () => {
    const opts = {
      req: new Request("http://test.com/api/trpc"),
      resHeaders: new Headers(),
      info: {} as any,
      signal: new AbortController().signal,
    };

    const ctx = await createContext(opts);
    expect(ctx.clientIp).toBeUndefined();
  });

  it("uses the first x-forwarded-for entry as clientIp", async () => {
    const opts = {
      req: new Request("http://test.com/api/trpc", {
        headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
      }),
      resHeaders: new Headers(),
      info: {} as any,
      signal: new AbortController().signal,
    };

    const ctx = await createContext(opts);
    expect(ctx.clientIp).toBe("203.0.113.7");
  });

  it("sets clientIp to undefined when the first forwarded entry is blank", async () => {
    const opts = {
      req: new Request("http://test.com/api/trpc", {
        headers: { "x-forwarded-for": " , 10.0.0.1" },
      }),
      resHeaders: new Headers(),
      info: {} as any,
      signal: new AbortController().signal,
    };

    const ctx = await createContext(opts);
    expect(ctx.clientIp).toBeUndefined();
  });
});
