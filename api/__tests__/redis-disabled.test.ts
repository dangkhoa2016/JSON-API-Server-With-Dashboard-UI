import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/env", () => ({
  env: {
    redisEnabled: false,
    redisHost: "localhost",
    redisPort: 6379,
    redisPassword: "",
    redisDb: 0,
    cacheTtlSeconds: 300,
    cacheEnabled: false,
  },
}));

import { getRedis, getCache, setCache, deleteCache, invalidateCache } from "../lib/redis";

describe("redis disabled", () => {
  it("getRedis returns null when disabled", () => {
    expect(getRedis()).toBeNull();
  });

  it("getCache returns null when Redis disabled", async () => {
    const result = await getCache("test");
    expect(result).toBeNull();
  });

  it("setCache does nothing when Redis disabled", async () => {
    await setCache("test", "value");
  });

  it("deleteCache does nothing when Redis disabled", async () => {
    await deleteCache("test");
  });

  it("invalidateCache does nothing when Redis disabled", async () => {
    await invalidateCache("test:*");
  });
});
