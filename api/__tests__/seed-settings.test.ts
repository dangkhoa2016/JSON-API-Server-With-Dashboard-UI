import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getDb } from '../queries/connection'
import { sql } from 'drizzle-orm'
import { seedSettings } from '@db/seed-settings'

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

beforeAll(async () => {
  const db = getDb()
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'string',
      label TEXT,
      description TEXT,
      "group" TEXT,
      is_public INTEGER NOT NULL DEFAULT 0
    )
  `)
})

describe('seedSettings', () => {
  const envBackup: Record<string, string | undefined> = {}

  beforeAll(() => {
    for (const key of Object.keys(process.env)) {
      envBackup[key] = process.env[key]
    }
  })

  afterAll(() => {
    for (const key of Object.keys(envBackup)) {
      if (envBackup[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = envBackup[key]
      }
    }
  })

  it('inserts settings for env vars that are set', async () => {
    process.env.REDIS_HOST = 'redis.example.com'
    process.env.RATE_LIMIT_MAX_REQUESTS = '50'

    const db = getDb()
    await seedSettings(db)

    const rows = await db.all(sql`SELECT * FROM settings`) as any[]
    const redisHost = rows.find((r: any) => r.key === 'REDIS_HOST')
    const rateLimitMax = rows.find((r: any) => r.key === 'RATE_LIMIT_MAX_REQUESTS')

    expect(redisHost).toBeDefined()
    expect(redisHost.value).toBe('redis.example.com')
    expect(rateLimitMax).toBeDefined()
    expect(rateLimitMax.value).toBe('50')
  })

  it('skips settings for env vars that are not set', async () => {
    delete process.env.DEBUG_SQL
    delete process.env.REDIS_TTL

    const db = getDb()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await seedSettings(db)

    expect(logSpy).toHaveBeenCalledWith('  Skip: DEBUG_SQL (not set in .env)')
    expect(logSpy).toHaveBeenCalledWith('  Skip: REDIS_TTL (not set in .env)')

    logSpy.mockRestore()
  })

  it('masks secret values in logs', async () => {
    process.env.APP_SECRET = 'super-secret-value'

    const db = getDb()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await seedSettings(db)

    const logCall = logSpy.mock.calls.find(
      (call: string[]) => call[0] != null && call[0].includes('APP_SECRET')
    )
    expect(logCall).toBeDefined()
    expect(logCall![0]).toContain('***')
    expect(logCall![0]).not.toContain('super-secret-value')

    logSpy.mockRestore()
  })

  it('formats boolean values in logs', async () => {
    process.env.REDIS_ENABLED = 'true'
    process.env.DEBUG_SQL = 'false'

    const db = getDb()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await seedSettings(db)

    const redisCall = logSpy.mock.calls.find(
      (call: string[]) => call[0] != null && call[0].includes('REDIS_ENABLED')
    )
    const debugCall = logSpy.mock.calls.find(
      (call: string[]) => call[0] != null && call[0].includes('DEBUG_SQL')
    )
    expect(redisCall).toBeDefined()
    expect(redisCall![0]).toContain('= true')

    expect(debugCall).toBeDefined()
    expect(debugCall![0]).toContain('= false')

    logSpy.mockRestore()
  })

  it('handles onConflictDoNothing for duplicate keys', async () => {
    const db = getDb()
    await db.run(sql`DELETE FROM settings`)

    process.env.REDIS_HOST = 'first-value'
    await seedSettings(db)

    process.env.REDIS_HOST = 'second-value'
    await seedSettings(db)

    const rows = await db.all(sql`SELECT * FROM settings WHERE key = 'REDIS_HOST'`) as any[]
    expect(rows.length).toBe(1)
    expect(rows[0].value).toBe('first-value')
  })

  it('has correct settingDefs structure', async () => {
    const { settingDefs } = await import('@db/seed-settings')

    expect(settingDefs.length).toBeGreaterThan(0)
    for (const def of settingDefs) {
      expect(def).toHaveProperty('key')
      expect(def).toHaveProperty('type')
      expect(def).toHaveProperty('label')
      expect(def).toHaveProperty('description')
      expect(def).toHaveProperty('group')
      expect(def).toHaveProperty('isPublic')
      expect(['string', 'number', 'boolean']).toContain(def.type)
    }
  })
})
