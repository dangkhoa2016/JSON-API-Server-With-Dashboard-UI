import { vi, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";

vi.mock("@hono/node-server", () => ({
  serve: vi.fn((_opts: Record<string, unknown>, callback?: () => void) => {
    if (callback) callback();
  }),
}));

vi.mock("../lib/vite", () => ({
  serveStaticFiles: vi.fn(),
}));

process.env.NODE_ENV = "production";

describe("boot startup", () => {
  describe("dist/public exists", () => {
    let existsSyncSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
      existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
      await import("../boot");
    });

    afterAll(() => {
      existsSyncSpy.mockRestore();
    });

    it("starts the server with fetch and port", async () => {
      const { serve } = await import("@hono/node-server");
      expect(serve).toHaveBeenCalled();
      const serveCall = vi.mocked(serve).mock.calls[0][0];
      expect(serveCall).toHaveProperty("fetch");
      expect(serveCall).toHaveProperty("port");
    });

    it("calls serveStaticFiles when dist/public exists", async () => {
      const { serveStaticFiles } = await import("../lib/vite");
      expect(serveStaticFiles).toHaveBeenCalled();
    });

    it("exports the Hono app", async () => {
      const { default: app } = await import("../boot");
      expect(app).toBeDefined();
      expect(typeof app.fetch).toBe("function");
      expect(typeof app.request).toBe("function");
    });
  });

  describe("dist/public missing", () => {
    let existsSyncSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
      vi.clearAllMocks();
      vi.resetModules();
    });

    afterEach(() => {
      existsSyncSpy.mockRestore();
    });

    it("does not call serveStaticFiles when dist/public is missing", async () => {
      await import("../boot");
      const { serveStaticFiles } = await import("../lib/vite");
      expect(serveStaticFiles).not.toHaveBeenCalled();
    });

    it("still starts the server when dist/public is missing", async () => {
      await import("../boot");
      const { serve } = await import("@hono/node-server");
      expect(serve).toHaveBeenCalled();
    });
  });
});
