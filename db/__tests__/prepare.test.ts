import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  close: vi.fn(),
  seedDatabase: vi.fn(),
  seedSettings: vi.fn(),
  seedAdmin: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@libsql/client", () => ({
  createClient: mocks.createClient,
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn((path: string) => {
    if (path.endsWith("_journal.json")) {
      return JSON.stringify({
        entries: [{ tag: "0000_test_migration" }],
      });
    }

    if (path.endsWith("0000_test_migration.sql")) {
      return "CREATE TABLE test_table (id INTEGER);";
    }

    throw new Error(`Unexpected fixture path: ${path}`);
  }),
}));

vi.mock("drizzle-orm/libsql", () => ({
  drizzle: vi.fn(() => ({ kind: "db" })),
}));

vi.mock("../seed.js", () => ({
  seedDatabase: mocks.seedDatabase,
}));
vi.mock("../seed-settings.js", () => ({
  seedSettings: mocks.seedSettings,
}));
vi.mock("../seed-admin.js", () => ({
  seedAdmin: mocks.seedAdmin,
}));

import { DEFAULT_DATABASE_URL } from "../config";

describe("prepareDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue(undefined);
    mocks.seedDatabase.mockResolvedValue(undefined);
    mocks.seedSettings.mockResolvedValue(undefined);
    mocks.seedAdmin.mockResolvedValue(undefined);
  });

  it("closes the client after successful preparation", async () => {
    const { prepareDatabase } = await import("../prepare");
    await prepareDatabase({
      execute: mocks.execute,
      close: mocks.close,
    } as never);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledWith(
      "CREATE TABLE test_table (id INTEGER);",
    );
  });

  it("closes the client when migration execution fails", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("migration failed"));
    const { prepareDatabase } = await import("../prepare");

    await expect(
      prepareDatabase({
        execute: mocks.execute,
        close: mocks.close,
      } as never),
    ).rejects.toThrow("migration failed");

    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.seedDatabase).not.toHaveBeenCalled();
    expect(mocks.seedSettings).not.toHaveBeenCalled();
    expect(mocks.seedAdmin).not.toHaveBeenCalled();
  });

  it("closes the client when a seed fails", async () => {
    mocks.seedSettings.mockRejectedValueOnce(new Error("seed failed"));
    const { prepareDatabase } = await import("../prepare");
    await expect(
      prepareDatabase({
        execute: mocks.execute,
        close: mocks.close,
      } as never),
    ).rejects.toThrow("seed failed");
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("main() creates client and calls prepareDatabase", async () => {
    const mockClient = { execute: mocks.execute, close: mocks.close };
    mocks.createClient.mockReturnValue(mockClient);
    process.env.DATABASE_URL = "file:test.db";
    const { main } = await import("../prepare");
    await main();
    expect(mocks.createClient).toHaveBeenCalledWith({ url: "file:test.db" });
    expect(mocks.close).toHaveBeenCalledTimes(1);
    delete process.env.DATABASE_URL;
  });

  it("main() uses default URL when DATABASE_URL is not set", async () => {
    const mockClient = { execute: mocks.execute, close: mocks.close };
    mocks.createClient.mockReturnValue(mockClient);
    delete process.env.DATABASE_URL;
    const { main } = await import("../prepare");
    await main();
    expect(mocks.createClient).toHaveBeenCalledWith({ url: DEFAULT_DATABASE_URL });
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
});
