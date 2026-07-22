import { describe, it, expect, vi, beforeEach } from "vitest"
import * as schema from "@db/schema"

vi.mock("../lib/redis", () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
  invalidateCache: vi.fn(),
}))

const mockEnv = {
  appSecret: "test",
  isProduction: false,
  databaseUrl: ":memory:",
  redisEnabled: false,
  cacheEnabled: false,
  cacheTtlSeconds: 300,
  debugSql: false,
}

vi.mock("../lib/env", () => ({
  get env() { return mockEnv },
}))

const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 99 }]),
    }),
  }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),
}

vi.mock("../queries/connection", () => ({
  getDb: vi.fn(() => mockDb),
}))

import { handleCreate, tryCache } from "../jsonServerRouter/handlers"
import { getCache, setCache } from "../lib/redis"

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.cacheEnabled = false
  mockDb.insert().values().returning.mockResolvedValue([{ id: 99 }])
  mockDb.select().from().where().limit.mockResolvedValue([])
})

describe("handleCreate defensive throw", () => {
  it("throws when fullRecord is null after insert", async () => {
    await expect(
      handleCreate("users", schema.users, { name: "Test" })
    ).rejects.toThrow("Failed to retrieve created record in users")
  })
})

describe("tryCache with cacheEnabled=false", () => {
  it("bypasses cache and calls fetcher directly", async () => {
    mockEnv.cacheEnabled = false
    const fetcher = vi.fn().mockResolvedValue("result")
    const result = await tryCache("key", fetcher)
    expect(fetcher).toHaveBeenCalled()
    expect(getCache).not.toHaveBeenCalled()
    expect(setCache).not.toHaveBeenCalled()
    expect(result).toBe("result")
  })
})
