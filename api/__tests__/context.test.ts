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
});
