import { ref, computed } from 'vue'
import { trpc, trpcClient } from '@/providers/trpc'
import { getAuthToken, setAuthToken } from '@/lib/authToken'

const user = ref<{ username: string; role: string } | null>(
  getAuthToken() ? { username: '', role: 'admin' } : null
)

let lastVerifiedToken: string | null = null

export function useAuth() {
  const currentToken = getAuthToken()
  if (user.value && currentToken && lastVerifiedToken !== currentToken) {
    lastVerifiedToken = currentToken
    trpcClient.query('admin.auth.verify')
      .then((result: { ok: boolean }) => {
        if (!result.ok) {
          setAuthToken(null)
          user.value = null
          lastVerifiedToken = null
        }
      })
      .catch((err) => {
        console.warn('[auth] verify failed:', err)
      })
  }

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const currentUser = computed(() => user.value)

  const loginMutation = trpc.admin.auth.login.useMutation()

  async function login(username: string, password: string): Promise<boolean> {
    try {
      const result = await loginMutation.mutateAsync({ username, password })
      if (result.ok && result.token && result.username && result.role) {
        setAuthToken(result.token)
        user.value = { username: result.username, role: result.role }
        return true
      }
      return false
    } catch {
      return false
    }
  }

  function logout() {
    setAuthToken(null)
    user.value = null
    lastVerifiedToken = null
  }

  return { isAuthenticated, isAdmin, currentUser, login, logout }
}
