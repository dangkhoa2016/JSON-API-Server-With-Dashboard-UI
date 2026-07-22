// @vitest-environment jsdom
//
// Tests the module-level initialization path where the stored token is invalid,
// exercising the verify-failure branch in useAuth() that clears the user.
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
          query: vi.fn().mockResolvedValue({ ok: false }),
        },
        login: {
          useMutation: () => ({ mutateAsync: () => {} }),
        },
      },
    },
  },
  trpcClient: { query: vi.fn().mockResolvedValue({ ok: false }) },
}))

import { useAuth } from '@/composables/useAuth'

describe('useAuth with invalid stored token', () => {
  beforeEach(() => {
    mockSetAuthToken.mockClear()
  })

  it('clears user and removes token when verify returns ok: false', async () => {
    const { isAuthenticated, isAdmin, currentUser } = useAuth()

    // The verify call is async; flush microtasks to let the .then() run
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(isAuthenticated.value).toBe(false)
    expect(isAdmin.value).toBe(false)
    expect(currentUser.value).toBeNull()
    expect(mockSetAuthToken).toHaveBeenCalledWith(null)
  })
})
