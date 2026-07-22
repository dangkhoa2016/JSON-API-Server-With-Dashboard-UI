// @vitest-environment jsdom
//
// This file tests the module-level initialization branch where getAuthToken()
// returns a truthy value at import time, causing the module-level `user` ref
// to be initialized as `{ username: '', role: 'admin' }`.
//
// It lives in a separate file because vi.mock runs before all imports in the
// same file, so the mock config must differ from useAuth.test.ts to cover
// the alternate code path.
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/authToken', () => ({
  getAuthToken: () => 'existing-token',
  setAuthToken: () => {},
}))

vi.mock('@/providers/trpc', () => ({
  trpc: {
    admin: {
      auth: {
        verify: {
          query: vi.fn().mockResolvedValue({ ok: true }),
        },
        login: {
          useMutation: () => ({ mutateAsync: () => {} }),
        },
      },
    },
  },
  trpcClient: { query: vi.fn().mockResolvedValue({ ok: true }) },
}))

import { useAuth } from '@/composables/useAuth'

describe('useAuth initial state with existing token', () => {
  it('is authenticated with admin role when token exists at module load', () => {
    const { isAuthenticated, isAdmin, currentUser } = useAuth()

    expect(isAuthenticated.value).toBe(true)
    expect(isAdmin.value).toBe(true)
    expect(currentUser.value).toEqual({ username: '', role: 'admin' })
  })
})
