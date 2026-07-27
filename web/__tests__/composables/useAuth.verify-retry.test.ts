// @vitest-environment jsdom
//
// Tests that verifyToken() can retry after a transport failure.
// The promise cache is cleared in finally, so a subsequent call
// creates a fresh query.

import { describe, it, expect, vi } from 'vitest'

const queryMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/authToken', () => ({
  getAuthToken: () => 'valid-token',
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

describe('useAuth verifyToken retry', () => {
  it('first verify rejects, second returns valid admin; query called twice and auth becomes true', async () => {
    queryMock
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce({ ok: true, username: 'admin', role: 'admin' })

    const { verifyToken, isAuthenticated, isAdmin, currentUser, authResolved } = useAuth()

    await verifyToken()

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(isAuthenticated.value).toBe(false)
    expect(isAdmin.value).toBe(false)
    expect(currentUser.value).toBeNull()
    expect(authResolved.value).toBe(true)

    await verifyToken()

    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(isAuthenticated.value).toBe(true)
    expect(isAdmin.value).toBe(true)
    expect(currentUser.value).toEqual({ username: 'admin', role: 'admin' })
  })
})
