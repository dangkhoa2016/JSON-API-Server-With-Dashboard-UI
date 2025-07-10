import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const mockServe = vi.fn((_opts: unknown, cb: () => void) => {
  cb();
  return { stop: vi.fn() };
});

vi.mock("@hono/node-server", () => ({
  serve: mockServe,
}));

const mockServeStaticFiles = vi.fn();

vi.mock("../lib/vite", () => ({
  serveStaticFiles: mockServeStaticFiles,
}));

describe("server startup in production mode", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "production";
  });

  afterAll(() => {
    process.env.NODE_ENV = "test";
  });

  it("starts HTTP server with serveStaticFiles when production", async () => {
    const { default: app } = await import("../boot");

    expect(mockServe).toHaveBeenCalledTimes(1);
    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({ fetch: app.fetch, port: expect.any(Number) }),
      expect.any(Function),
    );
    expect(mockServeStaticFiles).toHaveBeenCalledTimes(1);
    expect(mockServeStaticFiles).toHaveBeenCalledWith(app);
  });
});
