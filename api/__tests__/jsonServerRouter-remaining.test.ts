import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createCallerFactory } from '@trpc/server/unstable-core-do-not-import'
import { jsonServerRouter } from '../jsonServerRouter'
import { getDb } from '../queries/connection'
import { sql } from 'drizzle-orm'

vi.mock('../lib/redis', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
  invalidateCache: vi.fn(),
}))

vi.mock('../lib/env', () => ({
  env: {
    appSecret: 'test-secret',
    isProduction: false,
    databaseUrl: ':memory:',
    redisHost: 'localhost',
    redisPort: 6379,
    redisPassword: '',
    redisDb: 0,
    redisEnabled: false,
    rateLimitEnabled: false,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 100,
    cacheEnabled: true,
    cacheTtlSeconds: 300,
    debugSql: false,
  },
}))

const TABLES = ['users', 'posts', 'comments', 'albums', 'photos', 'todos'] as const

const CREATE_SQL: Record<string, string> = {
  users: `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, username TEXT, email TEXT,
    address TEXT, phone TEXT, website TEXT,
    company TEXT
  )`,
  posts: `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL
  )`,
  comments: `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    body TEXT NOT NULL
  )`,
  albums: `CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL
  )`,
  photos: `CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL
  )`,
  todos: `CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
  )`,
}

const ctx = { req: new Request('http://localhost'), resHeaders: new Headers() }

const createCaller = createCallerFactory<{ ctx: typeof ctx; meta: any; errorShape: any; transformer: any }>()(jsonServerRouter as any)(ctx)

beforeAll(async () => {
  const db = getDb()
  for (const table of TABLES) {
    await db.run(sql.raw(CREATE_SQL[table]))
  }
})

describe('buildWhereConditions - reserved filter keys', () => {
  it('skips _sort filter key (continue branch)', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'Alice', email: 'a@b.com' })
    const result = await r.list({ filters: { _sort: 'name' } })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('skips _order filter key', async () => {
    const r = createCaller.users as any
    const result = await r.list({ filters: { _order: 'desc' } })
    expect(result.data).toHaveLength(1)
  })

  it('skips _limit filter key', async () => {
    const r = createCaller.users as any
    const result = await r.list({ filters: { _limit: '10' } })
    expect(result.data).toHaveLength(1)
  })

  it('skips _page filter key', async () => {
    const r = createCaller.users as any
    const result = await r.list({ filters: { _page: '1' } })
    expect(result.data).toHaveLength(1)
  })

  it('skips q filter key', async () => {
    const r = createCaller.users as any
    const result = await r.list({ filters: { q: 'search' } })
    expect(result.data).toHaveLength(1)
  })
})

describe('sort edge cases', () => {
  it('handles sort without order (orders fallback to [])', async () => {
    const r = createCaller.posts as any
    await r.create({ userId: 1, title: 'Charlie', body: 'x' })
    await r.create({ userId: 1, title: 'Alice', body: 'x' })
    await r.create({ userId: 1, title: 'Bob', body: 'x' })
    const result = await r.list({ filters: {}, sort: 'title' })
    expect(result.data).toHaveLength(3)
    expect(result.data[0].title).toBe('Alice')
  })

  it('handles more sort fields than order fields (dir fallback to asc)', async () => {
    const r = createCaller.posts as any
    await r.create({ userId: 1, title: 'Alpha', body: 'z' })
    await r.create({ userId: 1, title: 'Beta', body: 'y' })
    const result = await r.list({ filters: {}, sort: 'title,body', order: 'desc' })
    expect(result.data.length).toBeGreaterThanOrEqual(2)
  })

  it('handles sort with nonexistent field (column is falsy)', async () => {
    const r = createCaller.posts as any
    const result = await r.list({ filters: {}, sort: 'nonexistent' })
    expect(result.data.length).toBeGreaterThanOrEqual(1)
  })

  it('handles sort with desc order', async () => {
    const r = createCaller.posts as any
    const result = await r.list({ filters: {}, sort: 'title', order: 'desc' })
    expect(result.data.length).toBeGreaterThanOrEqual(1)
    expect(result.data[0].title).toBe('Charlie')
  })
})

describe('pagination edge cases', () => {
  it('handles limit without page (defaults page to 1)', async () => {
    const r = createCaller.photos as any
    await r.create({ albumId: 1, title: 'A', url: 'http://a.com', thumbnailUrl: 'http://a.com/t' })
    const result = await r.list({ filters: {}, limit: 10 })
    expect(result.data).toHaveLength(1)
  })
})

describe('serializeUser / deserializeUser', () => {
  it('serializes and deserializes address and company on create', async () => {
    const r = createCaller.users as any
    const created = await r.create({
      name: 'Test User',
      address: { street: '123 Main', city: 'Springfield' },
      company: { name: 'Acme Corp' },
    })
    expect(created.address).toEqual({ street: '123 Main', city: 'Springfield' })
    expect(created.company).toEqual({ name: 'Acme Corp' })
  })

  it('serializes and deserializes address on update', async () => {
    const r = createCaller.users as any
    const created = await r.create({ name: 'Test User 2' })
    const updated = await r.update({
      id: created.id,
      data: { address: { street: '456 Oak' } },
    })
    expect(updated.address).toEqual({ street: '456 Oak' })
  })

  it('serializes and deserializes company on update', async () => {
    const r = createCaller.users as any
    const created = await r.create({ name: 'Test User 3' })
    const updated = await r.update({
      id: created.id,
      data: { company: { name: 'Big Corp' } },
    })
    expect(updated.company).toEqual({ name: 'Big Corp' })
  })
})
