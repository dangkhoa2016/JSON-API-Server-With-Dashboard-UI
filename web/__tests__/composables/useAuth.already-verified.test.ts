// @vitest-environment jsdom
//
// Tests the "already verified" skip path in useAuth() (line 42 false branch):
// when getAuthToken() returns a token whose verify has already completed
// (lastVerifiedToken === currentToken), useAuth() skips calling verifyToken()
// and does not enter either branch of the if/else-if.
import { describe, it, expect, vi } from 'vitest'

const queryMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/authToken', () => ({
  getAuthToken: () => 'already-verified-token',
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

describe('useAuth already-verified skip', () => {
  it('does not call verifyToken when token was already verified', async () => {
    queryMock.mockResolvedValue({ ok: true, username: 'admin', role: 'admin' })

    const first = useAuth()
    await vi.waitFor(() => {
      expect(first.isAuthenticated.value).toBe(true)
    })

    queryMock.mockClear()

    const second = useAuth()
    expect(second.isAuthenticated.value).toBe(true)
    expect(queryMock).not.toHaveBeenCalled()
  })
})
