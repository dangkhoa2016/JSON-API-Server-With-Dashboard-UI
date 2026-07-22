import { describe, it, expect, vi } from 'vitest'

const mockSelect = vi.fn()
const mockInsert = vi.fn()

vi.mock('../queries/connection', () => ({
  getDb: () => ({
    select: mockSelect,
    insert: mockInsert,
    run: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }),
}))

vi.mock('../lib/redis', () => ({
  getCache: vi.fn().mockResolvedValue(null),
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

import { createCallerFactory } from '@trpc/server/unstable-core-do-not-import'
import { jsonServerRouter } from '../jsonServerRouter'

const ctx = { req: new Request('http://localhost'), resHeaders: new Headers() }
const createCaller = createCallerFactory<{ ctx: typeof ctx; meta: any; errorShape: any; transformer: any }>()(jsonServerRouter as any)(ctx)

describe('handleCreate error path', () => {
  it('throws when created record cannot be retrieved', async () => {
    const r = (createCaller as any).users
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 999 }]),
    }
    mockInsert.mockReturnValue(chain)
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    })

    await expect(r.create({ name: 'Ghost', email: 'g@h.com' })).rejects.toThrow('Failed to retrieve created record in users')
  })
})
