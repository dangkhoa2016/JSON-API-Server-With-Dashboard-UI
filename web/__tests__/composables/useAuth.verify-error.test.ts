// @vitest-environment jsdom
//
// Tests the module-level initialization path where the verify query throws
// (e.g. network error), exercising the .catch() branch in useAuth().
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetAuthToken = vi.hoisted(() => vi.fn())

vi.mock('@/lib/authToken', () => ({
  getAuthToken: () => 'stale-token',
  setAuthToken: mockSetAuthToken,
}))

vi.mock('@/providers/trpc', () => ({
  trpc: {
    admin: {
      auth: {
        verify: {
          query: vi.fn().mockRejectedValue(new Error('Network failure')),
        },
        login: {
          useMutation: () => ({ mutateAsync: () => {} }),
        },
      },
    },
  },
  trpcClient: { query: vi.fn().mockRejectedValue(new Error('Network failure')) },
}))

import { useAuth } from '@/composables/useAuth'

describe('useAuth when verify throws', () => {
  beforeEach(() => {
    mockSetAuthToken.mockClear()
  })

  it('keeps user when verify throws (network error, benefit of the doubt)', async () => {
    const { isAuthenticated, isAdmin, currentUser } = useAuth()

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(isAuthenticated.value).toBe(true)
    expect(isAdmin.value).toBe(true)
    expect(currentUser.value).toEqual({ username: '', role: 'admin' })
    expect(mockSetAuthToken).not.toHaveBeenCalled()
  })
})
