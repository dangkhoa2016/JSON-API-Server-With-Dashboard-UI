// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'

const mockMutateAsync = vi.hoisted(() => vi.fn())
const mockSetAuthToken = vi.hoisted(() => vi.fn())

vi.mock('@/lib/authToken', () => ({
  getAuthToken: () => null,
  setAuthToken: mockSetAuthToken,
}))

vi.mock('@/providers/trpc', () => ({
  trpc: {
    admin: {
      auth: {
        verify: {
          query: vi.fn().mockResolvedValue({ ok: true }),
        },
        login: {
          useMutation: () => ({ mutateAsync: mockMutateAsync }),
        },
      },
    },
  },
  trpcClient: { query: vi.fn().mockResolvedValue({ ok: true }) },
}))

import { useAuth } from '@/composables/useAuth'

afterEach(() => {
  useAuth().logout()
  mockSetAuthToken.mockClear()
  mockMutateAsync.mockReset()
})

describe('useAuth', () => {
  describe('initial state', () => {
    it('is not authenticated when no token is stored', () => {
      const { isAuthenticated, isAdmin, currentUser } = useAuth()
      expect(isAuthenticated.value).toBe(false)
      expect(isAdmin.value).toBe(false)
      expect(currentUser.value).toBeNull()
    })
  })

  describe('login', () => {
    it('returns true on success and updates auth state', async () => {
      mockMutateAsync.mockResolvedValue({
        ok: true,
        token: 'jwt-abc-123',
        username: 'admin',
        role: 'admin',
      })

      const { login, isAuthenticated, isAdmin, currentUser } = useAuth()
      const result = await login('admin', 'password')

      expect(result).toBe(true)
      expect(isAuthenticated.value).toBe(true)
      expect(isAdmin.value).toBe(true)
      expect(currentUser.value).toEqual({ username: 'admin', role: 'admin' })
    })

    it('passes credentials to mutateAsync', async () => {
      mockMutateAsync.mockResolvedValue({ ok: true, token: 'jwt', username: 'admin', role: 'admin' })

      const { login } = useAuth()
      await login('myuser', 'mypass')

      expect(mockMutateAsync).toHaveBeenCalledWith({ username: 'myuser', password: 'mypass' })
    })

    it('persists token via setAuthToken on success', async () => {
      mockMutateAsync.mockResolvedValue({
        ok: true,
        token: 'persisted-token',
        username: 'admin',
        role: 'admin',
      })

      const { login } = useAuth()
      await login('admin', 'password')

      expect(mockSetAuthToken).toHaveBeenCalledWith('persisted-token')
    })

    it('returns false when server rejects credentials', async () => {
      mockMutateAsync.mockResolvedValue({ ok: false })

      const { login, isAuthenticated } = useAuth()
      const result = await login('admin', 'wrong')

      expect(result).toBe(false)
      expect(isAuthenticated.value).toBe(false)
    })

    it('does not call setAuthToken on rejected login', async () => {
      mockMutateAsync.mockResolvedValue({ ok: false })

      const { login } = useAuth()
      await login('admin', 'wrong')

      expect(mockSetAuthToken).not.toHaveBeenCalled()
    })

    it('returns false on network error', async () => {
      mockMutateAsync.mockRejectedValue(new Error('Network failure'))

      const { login, isAuthenticated } = useAuth()
      const result = await login('admin', 'password')

      expect(result).toBe(false)
      expect(isAuthenticated.value).toBe(false)
    })

    it('does not call setAuthToken on network error', async () => {
      mockMutateAsync.mockRejectedValue(new Error('Network failure'))

      const { login } = useAuth()
      await login('admin', 'password')

      expect(mockSetAuthToken).not.toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    it('clears auth state after successful login', async () => {
      mockMutateAsync.mockResolvedValue({
        ok: true,
        token: 'jwt',
        username: 'admin',
        role: 'admin',
      })
      const auth = useAuth()
      await auth.login('admin', 'password')

      auth.logout()

      expect(auth.isAuthenticated.value).toBe(false)
      expect(auth.isAdmin.value).toBe(false)
      expect(auth.currentUser.value).toBeNull()
    })

    it('removes token via setAuthToken(null)', () => {
      const { logout } = useAuth()
      logout()
      expect(mockSetAuthToken).toHaveBeenCalledWith(null)
    })
  })
})
