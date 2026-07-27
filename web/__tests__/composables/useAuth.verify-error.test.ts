// @vitest-environment jsdom
//
// Tests the module-level initialization path where the verify query throws
// (e.g. network error), exercising the .catch() branch in useAuth().
// With the fix, user starts as null and is not populated on verify error.
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

  it('keeps user as null when verify throws (not authenticated until verified)', async () => {
    const { isAuthenticated, isAdmin, currentUser } = useAuth()

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(isAuthenticated.value).toBe(false)
    expect(isAdmin.value).toBe(false)
    expect(currentUser.value).toBeNull()
    expect(mockSetAuthToken).not.toHaveBeenCalled()
  })
})
