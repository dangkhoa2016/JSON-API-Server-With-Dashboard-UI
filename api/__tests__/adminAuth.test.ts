import { describe, it, expect, vi, afterEach } from 'vitest'
import { createSession, verifySession, sign } from '../lib/adminAuth'

describe('adminAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createSession returns a signed token', () => {
    const token = createSession('admin')
    expect(token).toBeTruthy()
    expect(token.split('.')).toHaveLength(2)
  })

  it('verifySession returns session for valid token', () => {
    const token = createSession('testuser')
    const session = verifySession(token)
    expect(session).not.toBeNull()
    expect(session!.username).toBe('testuser')
    expect(session!.role).toBe('admin')
    expect(session!.createdAt).toBeGreaterThan(0)
  })

  it('verifySession returns null for non-existent token', () => {
    const session = verifySession('nonexistent-token')
    expect(session).toBeNull()
  })

  it('verifySession returns null for token with wrong signature', () => {
    const token = createSession('admin')
    const [data] = token.split('.')
    const realSig = sign(data)
    const fakeSig = realSig.split('').map((c, i) => i % 2 === 0 ? (c === 'A' ? 'B' : 'A') : c).join('')
    const session = verifySession(`${data}.${fakeSig}`)
    expect(session).toBeNull()
  })

  it('verifySession returns null for token with empty signature', () => {
    const token = createSession('admin')
    const [data] = token.split('.')
    const session = verifySession(`${data}.`)
    expect(session).toBeNull()
  })

  it('verifySession returns null for expired session', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const token = createSession('tempuser')
    vi.setSystemTime(now + 25 * 60 * 60 * 1000)
    const session = verifySession(token)
    expect(session).toBeNull()
  })

  it('verifySession returns null for empty token', () => {
    const session = verifySession('')
    expect(session).toBeNull()
  })

  it('verifySession returns null for token with invalid JSON payload', () => {
    const data = Buffer.from('not-json').toString('base64url')
    const sig = sign(data)
    const session = verifySession(`${data}.${sig}`)
    expect(session).toBeNull()
  })
})
