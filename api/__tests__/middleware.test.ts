import { describe, it, expect, vi } from 'vitest'
import { createCallerFactory } from '@trpc/server/unstable-core-do-not-import'
import { createRouter, adminQuery } from '../middleware'
import { createSession } from '../lib/adminAuth'

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

const testRouter = createRouter({
  adminPing: adminQuery.query(() => ({ ok: true })),
})

type TestCtx = { req: Request; resHeaders: Headers }

const createCaller = createCallerFactory<{ ctx: TestCtx; meta: any; errorShape: any; transformer: any }>()(testRouter as any)

describe('adminQuery middleware', () => {
  it('allows request with valid Bearer token', async () => {
    const token = createSession('admin')
    const ctx = {
      req: new Request('http://localhost', {
        headers: { authorization: `Bearer ${token}` },
      }),
      resHeaders: new Headers(),
    }
    const caller = createCaller(ctx)
    const result = await (caller as any).adminPing()
    expect(result).toEqual({ ok: true })
  })

  it('throws UNAUTHORIZED when no auth header', async () => {
    const ctx = {
      req: new Request('http://localhost'),
      resHeaders: new Headers(),
    }
    const caller = createCaller(ctx)
    await expect((caller as any).adminPing()).rejects.toThrow('Admin authentication required')
  })

  it('throws UNAUTHORIZED when auth header is not Bearer', async () => {
    const ctx = {
      req: new Request('http://localhost', {
        headers: { authorization: 'Basic xxx' },
      }),
      resHeaders: new Headers(),
    }
    const caller = createCaller(ctx)
    await expect((caller as any).adminPing()).rejects.toThrow('Admin authentication required')
  })

  it('throws UNAUTHORIZED with invalid Bearer token', async () => {
    const ctx = {
      req: new Request('http://localhost', {
        headers: { authorization: 'Bearer invalid-token' },
      }),
      resHeaders: new Headers(),
    }
    const caller = createCaller(ctx)
    await expect((caller as any).adminPing()).rejects.toThrow('Invalid or expired session')
  })
})
