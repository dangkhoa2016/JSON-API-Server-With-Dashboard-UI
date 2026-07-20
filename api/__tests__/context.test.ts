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

  it("sets clientIp to unknown when no transport info available", async () => {
    const opts = {
      req: new Request("http://test.com/api/trpc"),
      resHeaders: new Headers(),
      info: {} as any,
      signal: new AbortController().signal,
    };

    const ctx = await createContext(opts);
    expect(ctx.clientIp).toBe("unknown");
  });
});
