// @vitest-environment jsdom
//
// Tests verifyToken() called directly with no stored token.
// Covers lines 15-16 of useAuth.ts: the early-return branch inside verifyToken()
// when getAuthToken() returns null. This is the path exercised by the router
// guard in main.ts (calling verifyToken() directly on a requiresAuth route
// when the user has no session).
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/authToken', () => ({
  getAuthToken: () => null,
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
  trpcClient: { query: vi.fn() },
}))

import { useAuth } from '@/composables/useAuth'

describe('useAuth verifyToken with no token', () => {
  it('resolves immediately and does not call trpc query when called with no token', async () => {
    const { verifyToken, authResolved } = useAuth()

    // useAuth() already sets authResolved=true via the else-if branch (line 43)
    expect(authResolved.value).toBe(true)

    // Calling verifyToken() directly should also resolve (lines 15-16)
    await verifyToken()

    expect(authResolved.value).toBe(true)
  })

  it('does not call trpcClient.query when there is no token', async () => {
    const { verifyToken } = useAuth()
    const { trpcClient } = await import('@/providers/trpc')

    await verifyToken()

    expect(trpcClient.query).not.toHaveBeenCalled()
  })
})
