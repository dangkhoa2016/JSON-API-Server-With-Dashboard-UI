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

describe('comments CRUD', () => {
  it('full lifecycle', async () => {
    const r = createCaller.comments as any
    const created = await r.create({ postId: 1, name: 'Commenter', email: 'c@d.com', body: 'Comment body' })
    expect(created.id).toBe(1)

    const list = await r.list({ filters: {} })
    expect(list.data).toHaveLength(1)

    const count = await r.count()
    expect(count).toBe(1)

    const got = await r.getById({ id: 1 })
    expect(got.name).toBe('Commenter')

    await r.update({ id: 1, data: { name: 'Updated' } })
    await r.delete({ id: 1 })
    const afterDelete = await r.list({ filters: {} })
    expect(afterDelete.data).toHaveLength(0)
  })
})

describe('albums CRUD', () => {
  it('full lifecycle', async () => {
    const r = createCaller.albums as any
    const created = await r.create({ userId: 1, title: 'Album Title' })
    expect(created.id).toBe(1)

    const list = await r.list({ filters: {} })
    expect(list.data).toHaveLength(1)

    const count = await r.count()
    expect(count).toBe(1)

    await r.getById({ id: 1 })
    await r.update({ id: 1, data: { title: 'Updated' } })
    await r.delete({ id: 1 })
    const afterDelete = await r.list({ filters: {} })
    expect(afterDelete.data).toHaveLength(0)
  })
})

describe('photos CRUD', () => {
  it('full lifecycle', async () => {
    const r = createCaller.photos as any
    const created = await r.create({ albumId: 1, title: 'Photo', url: 'http://example.com', thumbnailUrl: 'http://example.com/thumb' })
    expect(created.id).toBe(1)

    const list = await r.list({ filters: {} })
    expect(list.data).toHaveLength(1)

    const count = await r.count()
    expect(count).toBe(1)

    await r.getById({ id: 1 })
    await r.update({ id: 1, data: { title: 'Updated' } })
    await r.delete({ id: 1 })
    const afterDelete = await r.list({ filters: {} })
    expect(afterDelete.data).toHaveLength(0)
  })
})

describe('todos CRUD', () => {
  it('full lifecycle', async () => {
    const r = createCaller.todos as any
    const created = await r.create({ userId: 1, title: 'Todo Item', completed: false })
    expect(created.id).toBe(1)

    const list = await r.list({ filters: {} })
    expect(list.data).toHaveLength(1)

    const count = await r.count()
    expect(count).toBe(1)

    await r.getById({ id: 1 })
    await r.update({ id: 1, data: { completed: true } })
    await r.delete({ id: 1 })
    const afterDelete = await r.list({ filters: {} })
    expect(afterDelete.data).toHaveLength(0)
  })
})

describe('caching (mocked env + redis)', () => {
  beforeEach(() => {
    vi.mocked(getCache).mockReset()
    vi.mocked(setCache).mockReset()
    vi.mocked(getCache).mockResolvedValue(null)
  })

  it('misses cache and stores result', async () => {
    const r = createCaller.todos as any
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
    const r = createCaller.photos as any
    const result = await r.list({ filters: {} })
    expect(result.data).toEqual([])
    expect(vi.mocked(setCache)).toHaveBeenCalled()
  })
})
