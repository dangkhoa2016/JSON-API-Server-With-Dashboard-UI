import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { createCallerFactory } from '@trpc/server/unstable-core-do-not-import'
import { jsonServerRouter, VALID_RESOURCES } from '../jsonServerRouter'
import { getDb } from '../queries/connection'
import { sql } from 'drizzle-orm'
import { getCache, setCache } from '../lib/redis'

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

const TABLES = ['users', 'posts'] as const

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
}

const ctx = { req: new Request('http://localhost'), resHeaders: new Headers() }
const createCaller = createCallerFactory<{ ctx: typeof ctx; meta: any; errorShape: any; transformer: any }>()(jsonServerRouter as any)(ctx)

beforeAll(async () => {
  const db = getDb()
  for (const table of TABLES) {
    await db.run(sql.raw(`DROP TABLE IF EXISTS ${table}`))
    await db.run(sql.raw(CREATE_SQL[table]))
  }
})

beforeEach(async () => {
  vi.mocked(getCache).mockReset()
  vi.mocked(setCache).mockReset()
})

describe('VALID_RESOURCES', () => {
  it('contains all expected resources', () => {
    expect(VALID_RESOURCES).toEqual(['users', 'posts', 'comments', 'albums', 'photos', 'todos'])
  })
})

describe('users', () => {
  const r = createCaller.users as any

  it('list returns empty initially', async () => {
    const result = await r.list({})
    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })

  it('list with default filters works', async () => {
    const result = await r.list({ filters: {} })
    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })

  it('creates a user', async () => {
    const created = await r.create({ name: 'Alice', email: 'a@b.com' })
    expect(created.id).toBe(1)
    expect(created.name).toBe('Alice')
  })

  it('lists with one item', async () => {
    const result = await r.list({ filters: {} })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('counts users', async () => {
    const count = await r.count()
    expect(count).toBe(1)
  })

  it('gets user by id', async () => {
    const user = await r.getById({ id: 1 })
    expect(user.id).toBe(1)
    expect(user.name).toBe('Alice')
  })

  it('updates a user', async () => {
    const updated = await r.update({ id: 1, data: { name: 'Alice Updated' } })
    expect(updated.name).toBe('Alice Updated')
  })

  it('lists with filters, sorting, and pagination', async () => {
    await r.create({ name: 'Bob', email: 'b@b.com' })
    await r.create({ name: 'Charlie', email: 'c@c.com' })
    const result = await r.list({ filters: { name: 'Bob' }, sort: 'name', order: 'asc', limit: 10, page: 1 })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('filters by numeric column and wildcard', async () => {
    await r.create({ name: 'Dave', email: 'd@d.com' })
    const byId = await r.list({ filters: { id: '1' } })
    expect(byId.data).toHaveLength(1)
    const byWildcard = await r.list({ filters: { name: 'D*' } })
    expect(byWildcard.data).toHaveLength(1)
  })

  it('deletes a user', async () => {
    const deleted = await r.delete({ id: 1 })
    expect(deleted).toBe(true)
  })

  it('ignores filter keys that do not match any column', async () => {
    await r.create({ name: 'Eve', email: 'eve@test.com' })
    const result = await r.list({ filters: { nonexistent_column: 'value', name: 'Eve' } })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('Eve')
  })
})

describe('posts CRUD', () => {
  it('full lifecycle', async () => {
    const r = createCaller.posts as any
    const created = await r.create({ userId: 1, title: 'Post Title', body: 'Body text' })
    expect(created.id).toBe(1)

    const list = await r.list({ filters: {} })
    expect(list.data).toHaveLength(1)
    expect(list.total).toBe(1)

    const count = await r.count()
    expect(count).toBe(1)

    const got = await r.getById({ id: 1 })
    expect(got.title).toBe('Post Title')

    const updated = await r.update({ id: 1, data: { title: 'Updated' } })
    expect(updated.title).toBe('Updated')

    await r.delete({ id: 1 })
    const afterDelete = await r.list({ filters: {} })
    expect(afterDelete.data).toHaveLength(0)
  })
})

describe('caching (mocked env + redis)', () => {
  beforeEach(async () => {
    const db = getDb()
    for (const table of TABLES) {
      await db.run(sql`DELETE FROM ${sql.raw(table)}`)
    }
    vi.mocked(getCache).mockReset()
    vi.mocked(setCache).mockReset()
    vi.mocked(getCache).mockResolvedValue(null)
  })

  it('misses cache and stores result', async () => {
    const r = createCaller.users as any
    const result = await r.list({ filters: {} })
    expect(result.data).toEqual([])
    expect(vi.mocked(setCache)).toHaveBeenCalled()
  })

  it('returns cached list data on cache hit', async () => {
    const cached = JSON.stringify({ data: [{ id: 99, name: 'Cached' }], total: 1 })
    vi.mocked(getCache).mockResolvedValue(cached)
    const r = createCaller.users as any
    const result = await r.list({ filters: {} })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('Cached')
  })

  it('returns cached item on cache hit for getById', async () => {
    const cached = JSON.stringify({ id: 1, name: 'Cached User' })
    vi.mocked(getCache).mockResolvedValue(cached)
    const r = createCaller.users as any
    const user = await r.getById({ id: 1 })
    expect(user.name).toBe('Cached User')
  })

  it('falls through to fetcher on corrupted cache', async () => {
    vi.mocked(getCache).mockResolvedValue('not-json{')
    const r = createCaller.users as any
    const result = await r.list({ filters: {} })
    expect(result.data).toEqual([])
    expect(vi.mocked(setCache)).toHaveBeenCalled()
  })
})

describe('user serialization/deserialization', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM users`)
  })

  it('creates user with object address and company', async () => {
    const r = createCaller.users as any
    const address = { street: '123 Main St', city: 'Springfield' }
    const company = { name: 'Acme Corp', catchPhrase: 'We make things' }

    const created = await r.create({
      name: 'Test User',
      email: 'test@test.com',
      address: address,
      company: company,
    })

    expect(created.id).toBeDefined()
    expect(created.name).toBe('Test User')

    const user = await r.getById({ id: created.id })
    expect(user.address).toEqual(address)
    expect(user.company).toEqual(company)
  })

  it('updates user with object address', async () => {
    const r = createCaller.users as any
    const created = await r.create({ name: 'User', email: 'u@test.com' })

    const newAddress = { street: '456 Oak Ave', city: 'Shelbyville' }
    const updated = await r.update({ id: created.id, data: { address: newAddress } })

    expect(updated.address).toEqual(newAddress)
  })

  it('returns null for non-existent user', async () => {
    const r = createCaller.users as any
    const user = await r.getById({ id: 999 })
    expect(user).toBeNull()
  })
})

describe('handler edge cases', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM users`)
  })

  it('update returns null for non-existent record', async () => {
    const r = createCaller.users as any
    const result = await r.update({ id: 9999, data: { name: 'nope' } })
    expect(result).toBeNull()
  })

  it('list with desc sorting', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'Alice', email: 'a@b.com' })
    await r.create({ name: 'Bob', email: 'b@b.com' })

    const asc = await r.list({ filters: {}, sort: 'name', order: 'asc' })
    expect(asc.data[0].name).toBe('Alice')

    const desc = await r.list({ filters: {}, sort: 'name', order: 'desc' })
    expect(desc.data[0].name).toBe('Bob')
  })

  it('list with multiple sort fields and order', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'Zoe', email: 'z@b.com' })
    await r.create({ name: 'Adam', email: 'a@b.com' })

    const result = await r.list({ filters: {}, sort: 'name,id', order: 'asc,desc' })
    expect(result.data[0].name).toBe('Adam')
  })

  it('sorting with missing order defaults to asc', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'Zoe', email: 'z@b.com' })
    await r.create({ name: 'Adam', email: 'a@b.com' })

    const result = await r.list({ filters: {}, sort: 'name' })
    expect(result.data[0].name).toBe('Adam')
  })

  it('sorting by nonexistent column is ignored', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'Alice', email: 'a@b.com' })

    const result = await r.list({ filters: {}, sort: 'nonexistent' })
    expect(result.data).toHaveLength(1)
  })

  it('pagination with page 2', async () => {
    const r = createCaller.users as any
    for (let i = 0; i < 5; i++) {
      await r.create({ name: `User ${i}`, email: `u${i}@b.com` })
    }

    const page1 = await r.list({ filters: {}, limit: 2, page: 1 })
    expect(page1.data).toHaveLength(2)

    const page2 = await r.list({ filters: {}, limit: 2, page: 2 })
    expect(page2.data).toHaveLength(2)

    const page3 = await r.list({ filters: {}, limit: 2, page: 3 })
    expect(page3.data).toHaveLength(1)
  })

  it('pagination without page defaults to page 1', async () => {
    const r = createCaller.users as any
    for (let i = 0; i < 3; i++) {
      await r.create({ name: `User ${i}`, email: `u${i}@b.com` })
    }

    const result = await r.list({ filters: {}, limit: 2 })
    expect(result.data).toHaveLength(2)
  })

  it('reserved filter keys are skipped in buildWhereConditions', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'Alice', email: 'a@b.com' })

    const result = await r.list({
      filters: { _sort: 'name', _order: 'asc', _limit: '10', _page: '1', q: 'test', name: 'Alice' }
    })
    expect(result.data).toHaveLength(1)
  })
})
