import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { createSession, verifySession, sign } from '../lib/adminAuth'
import { setupTestDatabase, seedTestData, clearTestDatabase } from './helpers'

describe('adminAuth', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await clearTestDatabase()
    await seedTestData()
  })

  it('createSession returns a signed token', async () => {
    const token = await createSession('admin')
    expect(token).toBeTruthy()
    expect(token.split('.')).toHaveLength(2)
  })

  it('verifySession returns session for valid token', async () => {
    const token = await createSession('testuser')
    const session = await verifySession(token)
    expect(session).not.toBeNull()
    expect(session!.username).toBe('testuser')
    expect(session!.role).toBe('admin')
    expect(session!.createdAt).toBeGreaterThan(0)
  })

  it('verifySession returns null for non-existent token', async () => {
    const session = await verifySession('nonexistent-token')
    expect(session).toBeNull()
  })

  it('verifySession returns null for token with wrong signature', async () => {
    const token = await createSession('admin')
    const [data] = token.split('.')
    const realSig = await sign(data)
    const fakeSig = realSig.split('').map((c, i) => i % 2 === 0 ? (c === 'A' ? 'B' : 'A') : c).join('')
    const session = await verifySession(`${data}.${fakeSig}`)
    expect(session).toBeNull()
  })

  it('verifySession returns null for token with empty signature', async () => {
    const token = await createSession('admin')
    const [data] = token.split('.')
    const session = await verifySession(`${data}.`)
    expect(session).toBeNull()
  })

  it('verifySession returns null for expired session', async () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const token = await createSession('tempuser')
    vi.setSystemTime(now + 25 * 60 * 60 * 1000)
    const session = await verifySession(token)
    expect(session).toBeNull()
  })

  it('verifySession returns null for empty token', async () => {
    const session = await verifySession('')
    expect(session).toBeNull()
  })

  it('verifySession returns null for token with invalid JSON payload', async () => {
    const data = Buffer.from('not-json').toString('base64url')
    const sig = await sign(data)
    const session = await verifySession(`${data}.${sig}`)
    expect(session).toBeNull()
  })

  it('createSession throws when ADMIN_SESSION_SECRET is not in database', async () => {
    const { getDb } = await import('../queries/connection')
    const { sql } = await import('drizzle-orm')
    const db = getDb()
    await db.run(sql`DELETE FROM settings WHERE key = 'ADMIN_SESSION_SECRET'`)
    vi.setSystemTime(Date.now() + 120_000)
    await expect(createSession('admin')).rejects.toThrow('ADMIN_SESSION_SECRET not configured')
  })
})
