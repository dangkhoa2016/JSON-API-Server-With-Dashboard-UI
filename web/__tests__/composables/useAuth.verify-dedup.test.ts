// @vitest-environment jsdom
//
// Tests the dedup guard in verifyToken() (line 12): when verifyToken() is
// called while a previous verify is still in-flight, it returns the existing
// verifyPromise instead of creating a new one.
import { describe, it, expect, vi } from 'vitest'

const queryMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/authToken', () => ({
  getAuthToken: () => 'token-dedup',
  setAuthToken: vi.fn(),
}))

vi.mock('@/providers/trpc', () => ({
  trpc: {
    admin: {
      auth: {
        verify: { query: vi.fn() },
        login: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      },
    },
  },
  trpcClient: { query: queryMock },
}))

import { useAuth } from '@/composables/useAuth'

describe('useAuth verifyToken dedup', () => {
  it('reuses the existing verifyPromise when called twice in quick succession', async () => {
    let resolveQuery: (v: unknown) => void
    queryMock.mockImplementation(() => new Promise(r => { resolveQuery = r }))

    const { verifyToken } = useAuth()

    const p1 = verifyToken()
    const p2 = verifyToken()

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(p1).toBe(p2)

    resolveQuery!({ ok: true, username: 'admin', role: 'admin' })
    await p1
  })
})
