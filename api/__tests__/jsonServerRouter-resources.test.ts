import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
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
describe('search (q parameter)', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM users`)
  })

  it('searches users by name', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'John Doe', email: 'john@test.com' })
    await r.create({ name: 'Jane Smith', email: 'jane@test.com' })

    const result = await r.list({ filters: {}, q: 'John' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('John Doe')
  })

  it('searches with special characters', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'Test%User', email: 'test@test.com' })

    const result = await r.list({ filters: {}, q: 'Test%User' })
    expect(result.data).toHaveLength(1)
  })
})


describe('handlers coverage - filtering', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM comments`)
    await db.run(sql`DELETE FROM albums`)
    await db.run(sql`DELETE FROM photos`)
    await db.run(sql`DELETE FROM todos`)
  })

  it('filters comments by wildcard', async () => {
    const r = createCaller.comments as any
    await r.create({ postId: 1, name: 'Test Comment', email: 'test@test.com', body: 'Body' })
    await r.create({ postId: 1, name: 'Another Comment', email: 'other@test.com', body: 'Body2' })

    const result = await r.list({ filters: { name: 'Test*' } })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('Test Comment')
  })

  it('filters albums by numeric field', async () => {
    const r = createCaller.albums as any
    await r.create({ userId: 1, title: 'Album 1' })
    await r.create({ userId: 2, title: 'Album 2' })

    const result = await r.list({ filters: { userId: '1' } })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].userId).toBe(1)
  })

  it('filters photos with multiple conditions', async () => {
    const r = createCaller.photos as any
    await r.create({ albumId: 1, title: 'Photo 1', url: 'http://example.com/1.jpg', thumbnailUrl: 'http://example.com/1t.jpg' })
    await r.create({ albumId: 2, title: 'Photo 2', url: 'http://example.com/2.jpg', thumbnailUrl: 'http://example.com/2t.jpg' })

    const result = await r.list({ filters: { albumId: '1', title: 'Photo 1' } })
    expect(result.data).toHaveLength(1)
  })

  it('filters todos by completed status', async () => {
    const r = createCaller.todos as any
    await r.create({ userId: 1, title: 'Todo 1', completed: true })
    await r.create({ userId: 1, title: 'Todo 2', completed: false })

    const result = await r.list({ filters: { completed: '1' } })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].completed).toBe(true)
  })
})

describe('handlers coverage - sorting', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM comments`)
    await db.run(sql`DELETE FROM albums`)
    await db.run(sql`DELETE FROM photos`)
    await db.run(sql`DELETE FROM todos`)
  })

  it('sorts comments by name ascending', async () => {
    const r = createCaller.comments as any
    await r.create({ postId: 1, name: 'Zebra', email: 'z@test.com', body: 'Body' })
    await r.create({ postId: 1, name: 'Apple', email: 'a@test.com', body: 'Body' })

    const result = await r.list({ filters: {}, sort: 'name', order: 'asc' })
    expect(result.data[0].name).toBe('Apple')
    expect(result.data[1].name).toBe('Zebra')
  })

  it('sorts albums by title descending', async () => {
    const r = createCaller.albums as any
    await r.create({ userId: 1, title: 'Album A' })
    await r.create({ userId: 1, title: 'Album Z' })

    const result = await r.list({ filters: {}, sort: 'title', order: 'desc' })
    expect(result.data[0].title).toBe('Album Z')
  })

  it('sorts photos with multiple fields', async () => {
    const r = createCaller.photos as any
    await r.create({ albumId: 1, title: 'Photo B', url: 'http://example.com/b.jpg', thumbnailUrl: 'http://example.com/bt.jpg' })
    await r.create({ albumId: 2, title: 'Photo A', url: 'http://example.com/a.jpg', thumbnailUrl: 'http://example.com/at.jpg' })

    const result = await r.list({ filters: {}, sort: 'albumId,title', order: 'asc,asc' })
    expect(result.data[0].title).toBe('Photo A')
  })

  it('sorts todos with default order', async () => {
    const r = createCaller.todos as any
    await r.create({ userId: 1, title: 'Todo B', completed: false })
    await r.create({ userId: 1, title: 'Todo A', completed: false })

    const result = await r.list({ filters: {}, sort: 'title' })
    expect(result.data[0].title).toBe('Todo A')
  })
})

describe('handlers coverage - pagination', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM comments`)
    await db.run(sql`DELETE FROM albums`)
    await db.run(sql`DELETE FROM photos`)
    await db.run(sql`DELETE FROM todos`)
  })

  it('paginates comments', async () => {
    const r = createCaller.comments as any
    for (let i = 0; i < 5; i++) {
      await r.create({ postId: 1, name: `Comment ${i}`, email: 'test@test.com', body: 'Body' })
    }

    const page1 = await r.list({ filters: {}, limit: 2, page: 1 })
    expect(page1.data).toHaveLength(2)
    expect(page1.total).toBe(5)

    const page3 = await r.list({ filters: {}, limit: 2, page: 3 })
    expect(page3.data).toHaveLength(1)
  })

  it('paginates albums', async () => {
    const r = createCaller.albums as any
    for (let i = 0; i < 4; i++) {
      await r.create({ userId: 1, title: `Album ${i}` })
    }

    const result = await r.list({ filters: {}, limit: 2, page: 2 })
    expect(result.data).toHaveLength(2)
  })

  it('paginates photos', async () => {
    const r = createCaller.photos as any
    for (let i = 0; i < 6; i++) {
      await r.create({ albumId: 1, title: `Photo ${i}`, url: `http://example.com/${i}.jpg`, thumbnailUrl: `http://example.com/${i}t.jpg` })
    }

    const result = await r.list({ filters: {}, limit: 3, page: 1 })
    expect(result.data).toHaveLength(3)
    expect(result.total).toBe(6)
  })

  it('paginates todos', async () => {
    const r = createCaller.todos as any
    for (let i = 0; i < 5; i++) {
      await r.create({ userId: 1, title: `Todo ${i}`, completed: false })
    }

    const result = await r.list({ filters: {}, limit: 2 })
    expect(result.data).toHaveLength(2)
  })
})

describe('handlers coverage - edge cases', () => {
  beforeEach(async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM comments`)
    await db.run(sql`DELETE FROM albums`)
    await db.run(sql`DELETE FROM photos`)
    await db.run(sql`DELETE FROM todos`)
  })

  it('update returns null for non-existent comment', async () => {
    const r = createCaller.comments as any
    const result = await r.update({ id: 9999, data: { name: 'nope' } })
    expect(result).toBeNull()
  })

  it('update returns null for non-existent album', async () => {
    const r = createCaller.albums as any
    const result = await r.update({ id: 9999, data: { title: 'nope' } })
    expect(result).toBeNull()
  })

  it('update returns null for non-existent photo', async () => {
    const r = createCaller.photos as any
    const result = await r.update({ id: 9999, data: { title: 'nope' } })
    expect(result).toBeNull()
  })

  it('update returns null for non-existent todo', async () => {
    const r = createCaller.todos as any
    const result = await r.update({ id: 9999, data: { title: 'nope' } })
    expect(result).toBeNull()
  })

  it('handles reserved filter keys for comments', async () => {
    const r = createCaller.comments as any
    await r.create({ postId: 1, name: 'Test', email: 'test@test.com', body: 'Body' })

    const result = await r.list({ filters: { _sort: 'name', name: 'Test' } })
    expect(result.data).toHaveLength(1)
  })

  it('handles reserved filter keys for albums', async () => {
    const r = createCaller.albums as any
    await r.create({ userId: 1, title: 'Test Album' })

    const result = await r.list({ filters: { _order: 'asc', title: 'Test Album' } })
    expect(result.data).toHaveLength(1)
  })

  it('handles reserved filter keys for photos', async () => {
    const r = createCaller.photos as any
    await r.create({ albumId: 1, title: 'Test Photo', url: 'http://example.com/test.jpg', thumbnailUrl: 'http://example.com/testt.jpg' })

    const result = await r.list({ filters: { _limit: '10', title: 'Test Photo' } })
    expect(result.data).toHaveLength(1)
  })

  it('handles reserved filter keys for todos', async () => {
    const r = createCaller.todos as any
    await r.create({ userId: 1, title: 'Test Todo', completed: false })

    const result = await r.list({ filters: { _page: '1', title: 'Test Todo' } })
    expect(result.data).toHaveLength(1)
  })
})

describe('handlers coverage - users and posts routes', () => {
  beforeEach(async () => {
    const db = getDb()
    for (const table of TABLES) {
      await db.run(sql.raw(`DROP TABLE IF EXISTS ${table}`))
      await db.run(sql.raw(CREATE_SQL[table]))
    }
  })

  it('creates and retrieves a user', async () => {
    const r = createCaller.users as any
    const created = await r.create({ name: 'Test User', email: 'test@test.com' })
    expect(created.id).toBe(1)

    const user = await r.getById({ id: 1 })
    expect(user.name).toBe('Test User')
  })

  it('updates a user', async () => {
    const r = createCaller.users as any
    const created = await r.create({ name: 'User', email: 'u@test.com' })

    const updated = await r.update({ id: created.id, data: { name: 'Updated' } })
    expect(updated.name).toBe('Updated')
  })

  it('deletes a user', async () => {
    const r = createCaller.users as any
    const created = await r.create({ name: 'User', email: 'u@test.com' })

    await r.delete({ id: created.id })
    const user = await r.getById({ id: created.id })
    expect(user).toBeNull()
  })

  it('creates and retrieves a post', async () => {
    const r = createCaller.posts as any
    const created = await r.create({ userId: 1, title: 'Test Post', body: 'Body' })
    expect(created.id).toBe(1)

    const post = await r.getById({ id: 1 })
    expect(post.title).toBe('Test Post')
  })

  it('updates a post', async () => {
    const r = createCaller.posts as any
    const created = await r.create({ userId: 1, title: 'Post', body: 'Body' })

    const updated = await r.update({ id: created.id, data: { title: 'Updated' } })
    expect(updated.title).toBe('Updated')
  })

  it('deletes a post', async () => {
    const r = createCaller.posts as any
    const created = await r.create({ userId: 1, title: 'Post', body: 'Body' })

    await r.delete({ id: created.id })
    const post = await r.getById({ id: created.id })
    expect(post).toBeNull()
  })

  it('filters users by name', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'Alice', email: 'a@test.com' })
    await r.create({ name: 'Bob', email: 'b@test.com' })

    const result = await r.list({ filters: { name: 'Alice' } })
    expect(result.data).toHaveLength(1)
  })

  it('filters posts by userId', async () => {
    const r = createCaller.posts as any
    await r.create({ userId: 1, title: 'Post 1', body: 'Body' })
    await r.create({ userId: 2, title: 'Post 2', body: 'Body' })

    const result = await r.list({ filters: { userId: '1' } })
    expect(result.data).toHaveLength(1)
  })

  it('searches users by name', async () => {
    const r = createCaller.users as any
    await r.create({ name: 'John Doe', email: 'john@test.com' })
    await r.create({ name: 'Jane Smith', email: 'jane@test.com' })

    const result = await r.list({ filters: {}, q: 'John' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('John Doe')
  })

  it('searches posts by title', async () => {
    const r = createCaller.posts as any
    await r.create({ userId: 1, title: 'First Post', body: 'Body' })
    await r.create({ userId: 1, title: 'Second Post', body: 'Body' })

    const result = await r.list({ filters: {}, q: 'First' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].title).toBe('First Post')
  })
})
