import { describe, it, expect, vi } from "vitest"
import { getDb } from "../queries/connection"

vi.mock("../lib/env", () => ({
  env: {
    databaseUrl: ":memory:",
    debugSql: false,
    redisEnabled: false,
    cacheEnabled: false,
    appSecret: "test",
  },
}))

describe("getDb", () => {
  it("returns a drizzle instance", () => {
    const db = getDb()
    expect(db).toBeDefined()
  })

  it("returns the same instance on subsequent calls", () => {
    const db1 = getDb()
    const db2 = getDb()
    expect(db1).toBe(db2)
  })
})
