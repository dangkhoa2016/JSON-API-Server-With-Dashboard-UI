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

const TABLES = ['users', 'posts', 'comments', 'albums', 'photos', 'todos', 'settings'] as const

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
  settings: `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'string',
    label TEXT,
    description TEXT,
    "group" TEXT,
    is_public INTEGER NOT NULL DEFAULT 0
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

  it('searches with full-text query', async () => {
    await r.create({ name: 'Bob Smith', email: 'bob@test.com' })
    const result = await r.list({ q: 'Bob' })
    expect(result.data.length).toBeGreaterThanOrEqual(1)
  })

  it('full-text search with no results', async () => {
    const result = await r.list({ q: 'NonExistentName12345' })
    expect(result.data).toHaveLength(0)
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

describe('getCounts', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM settings`)
    await db.run(sql`DELETE FROM photos`)
    await db.run(sql`DELETE FROM comments`)
    await db.run(sql`DELETE FROM posts`)
    await db.run(sql`DELETE FROM albums`)
    await db.run(sql`DELETE FROM todos`)
    await db.run(sql`DELETE FROM users`)
  })

  it('returns 0 for all resources when DB is empty', async () => {
    const result = await (createCaller as any).getCounts()
    expect(result).toEqual({ users: 0, posts: 0, comments: 0, albums: 0, photos: 0, todos: 0 })
  })

  it('returns correct counts after inserting data', async () => {
    const db = getDb()
    await db.run(sql`INSERT INTO users (id, name) VALUES (1, 'u1'), (2, 'u2')`)
    await db.run(sql`INSERT INTO posts (id, user_id, title, body) VALUES (1, 1, 'p1', 'b1')`)
    await db.run(sql`INSERT INTO todos (id, user_id, title, completed) VALUES (1, 1, 't1', 0)`)
    const result = await (createCaller as any).getCounts()
    expect(result).toEqual({ users: 2, posts: 1, comments: 0, albums: 0, photos: 0, todos: 1 })
  })
})

describe('getFeatureCards', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM settings`)
    await db.run(sql`DELETE FROM photos`)
    await db.run(sql`DELETE FROM comments`)
    await db.run(sql`DELETE FROM posts`)
    await db.run(sql`DELETE FROM albums`)
    await db.run(sql`DELETE FROM todos`)
    await db.run(sql`DELETE FROM users`)
  })

  it('returns 3 default cards when no settings exist', async () => {
    const result = await (createCaller as any).getFeatureCards()
    expect(result).toHaveLength(3)
    expect(result[0].key).toBe('feature_card_sqlite')
    expect(result[1].key).toBe('feature_card_redis')
    expect(result[2].key).toBe('feature_card_ratelimit')
  })

  it('default cards keep unresolved template references when settings are absent', async () => {
    const result = await (createCaller as any).getFeatureCards()
    expect(result[1].description).toContain('{{REDIS_HOST}}')
    expect(result[2].description).toContain('{{RATE_LIMIT_MAX_REQUESTS}}')
  })

  it('default cards have healthy=false when enabling settings are absent', async () => {
    const result = await (createCaller as any).getFeatureCards()
    expect(result[1].healthy).toBe(false)
    expect(result[2].healthy).toBe(false)
  })

  it('resolves template references from settings table', async () => {
    const db = getDb()
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('REDIS_HOST', 'cache.example.com', 'string', 'Redis Host', '', 'redis', 1),
      ('REDIS_PORT', '7777', 'number', 'Redis Port', '', 'redis', 1),
      ('REDIS_TTL', '3600', 'number', 'Redis TTL', '', 'redis', 1),
      ('RATE_LIMIT_MAX_REQUESTS', '50', 'number', 'Rate Limit Max', '', 'rateLimit', 1),
      ('RATE_LIMIT_WINDOW_MS', '10000', 'number', 'Rate Limit Window', '', 'rateLimit', 1)
    `)
    const result = await (createCaller as any).getFeatureCards()
    expect(result[1].description).toContain('cache.example.com')
    expect(result[1].description).toContain('7777')
    expect(result[1].description).toContain('3600')
    expect(result[2].description).toContain('50')
    expect(result[2].description).toContain('10000')
  })

  it('sets healthy=true when REDIS_ENABLED and RATE_LIMIT_ENABLED are true', async () => {
    const db = getDb()
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('REDIS_ENABLED', 'true', 'boolean', 'Redis Enabled', '', 'redis', 1),
      ('RATE_LIMIT_ENABLED', 'true', 'boolean', 'Rate Limit Enabled', '', 'rateLimit', 1)
    `)
    const result = await (createCaller as any).getFeatureCards()
    expect(result[1].healthy).toBe(true)
    expect(result[2].healthy).toBe(true)
  })

  it('uses cards from settings table when featureCards group entries exist', async () => {
    const db = getDb()
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('my_card', '{"icon":"Zap","iconBg":"bg-purple-100","iconColor":"text-purple-600"}', 'string', 'My Custom Card', 'This is from DB', 'featureCards', 1)
    `)
    const result = await (createCaller as any).getFeatureCards()
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('my_card')
    expect(result[0].label).toBe('My Custom Card')
    expect(result[0].description).toBe('This is from DB')
    expect(result[0].icon).toBe('Zap')
    expect(result[0].iconBg).toBe('bg-purple-100')
    expect(result[0].iconColor).toBe('text-purple-600')
  })

  it('uses fallback icon when value JSON lacks icon field', async () => {
    const db = getDb()
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('minimal', '{}', 'string', 'Minimal', 'No icon specified', 'featureCards', 1)
    `)
    const result = await (createCaller as any).getFeatureCards()
    expect(result[0].icon).toBe('Database')
    expect(result[0].iconBg).toBe('bg-blue-100 dark:bg-blue-900/30')
    expect(result[0].iconColor).toBe('text-blue-600 dark:text-blue-400')
  })

  it('uses fallback meta when value is empty string', async () => {
    const db = getDb()
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('empty_card', '', 'string', 'Empty Value', 'No value set', 'featureCards', 1)
    `)
    const result = await (createCaller as any).getFeatureCards()
    expect(result[0].icon).toBe('Database')
    expect(result[0].iconBg).toBe('bg-blue-100 dark:bg-blue-900/30')
    expect(result[0].iconColor).toBe('text-blue-600 dark:text-blue-400')
  })

  it('skips template reference extraction when label or description is null', async () => {
    const db = getDb()
    await db.run(sql`INSERT INTO settings (key, value, type, label, description, "group", is_public) VALUES
      ('no_text', '{}', 'string', NULL, NULL, 'featureCards', 1)
    `)
    const result = await (createCaller as any).getFeatureCards()
    expect(result[0].key).toBe('no_text')
    expect(result[0].label).toBe('')
    expect(result[0].description).toBe('')
    expect(result[0].icon).toBe('Database')
  })
})
