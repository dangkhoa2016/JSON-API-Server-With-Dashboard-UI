import type { Context, MiddlewareHandler } from "hono";

export function bodyLimit({
  maxBytes,
}: {
  maxBytes: number;
}): MiddlewareHandler {
  return async (c: Context, next) => {
    if (!["POST", "PUT", "PATCH"].includes(c.req.method)) {
      await next();
      return;
    }

    const contentLength = c.req.header("content-length");
    if (contentLength !== undefined) {
      if (!/^\d+$/.test(contentLength)) {
        return c.json({ error: "Request body unreadable" }, 400);
      }
      const len = parseInt(contentLength, 10);
      if (len > maxBytes) {
        return c.json({ error: "Request body too large" }, 413);
      }
    }

    if (c.req.raw.body) {
      const clone = c.req.raw.clone();
      const cloneBody = clone.body;
      if (!cloneBody) {
        return c.json({ error: "Request body unreadable" }, 400);
      }
      const reader = cloneBody.getReader();
      let total = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) {
            reader.cancel();
            return c.json({ error: "Request body too large" }, 413);
          }
        }
      } catch {
        await reader.cancel().catch(() => {});
        return c.json({ error: "Request body unreadable" }, 400);
      }
    }

    await next();
  };
}
