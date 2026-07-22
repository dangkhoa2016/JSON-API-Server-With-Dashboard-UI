import { describe, it, expect, vi } from "vitest"
import { getDb } from "../queries/connection"
import * as relations from "@db/relations"

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

describe("relations", () => {
  it("exports usersRelations", () => {
    expect(relations.usersRelations).toBeDefined()
  })

  it("exports postsRelations", () => {
    expect(relations.postsRelations).toBeDefined()
  })

  it("exports commentsRelations", () => {
    expect(relations.commentsRelations).toBeDefined()
  })

  it("exports albumsRelations", () => {
    expect(relations.albumsRelations).toBeDefined()
  })

  it("exports photosRelations", () => {
    expect(relations.photosRelations).toBeDefined()
  })

  it("exports todosRelations", () => {
    expect(relations.todosRelations).toBeDefined()
  })
})
