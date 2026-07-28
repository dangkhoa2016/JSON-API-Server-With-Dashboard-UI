import { vi } from 'vitest'

const authState = vi.hoisted(() => ({
  _authenticated: false,
  _admin: false,
  get isAuthenticated() { return { __v_isRef: true, value: this._authenticated } },
  set isAuthenticated(v) { this._authenticated = v },
  get isAdmin() { return { __v_isRef: true, value: this._admin } },
  set isAdmin(v) { this._admin = v },
  login: vi.fn(),
  logout: vi.fn(),
}))

const queryState = vi.hoisted(() => ({
  data: [
    { key: 'REDIS_ENABLED', value: 'false', type: 'boolean', label: 'Redis Enabled', description: 'Enable Redis caching', group: 'redis', isPublic: true },
    { key: 'APP_SECRET', value: '********', type: 'string', label: 'App Secret', description: 'Secret key', group: 'general', isPublic: false },
    { key: 'API_KEY', value: 'sk-123456', type: 'string', label: 'API Key', description: 'API key', group: 'api', isPublic: true },
  ],
  isLoading: false,
}))

const hoistedMutations = vi.hoisted(() => {
  const opts: any = { update: null, reset: null, resetDb: null, reveal: null }
  const resetDbPending = { __v_isRef: true, value: false }
  return {
    updateMutate: vi.fn(),
    resetMutate: vi.fn(),
    resetDbMutate: vi.fn(),
    revealMutateAsync: vi.fn().mockResolvedValue({ value: 'revealed-value' }),
    mutationOpts: opts,
    isResetDbPending: resetDbPending,
  }
})
const { updateMutate, resetMutate, resetDbMutate, revealMutateAsync, mutationOpts, isResetDbPending } = hoistedMutations

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

const invalidateQueries = vi.hoisted(() => vi.fn())
const refetchFn = vi.hoisted(() => vi.fn())

export {
  authState, queryState,
  updateMutate, resetMutate, resetDbMutate, revealMutateAsync, mutationOpts, isResetDbPending,
  toastSuccess, toastError, invalidateQueries, refetchFn,
}

// --- Shared vi.mock() factories (called from each test file) ---

export function utilsMockFactory() {
  return { cn: (...inputs: any[]) => inputs.filter(Boolean).join(' ') }
}

export async function sonnerMockFactory() {
  const { toastSuccess, toastError } = await import('./Settings.helpers')
  return { toast: { success: toastSuccess, error: toastError } }
}

export async function authMockFactory() {
  const { authState } = await import('./Settings.helpers')
  return { useAuth: () => authState }
}

export function queryClientMockFactory() {
  return { useQueryClient: () => ({ invalidateQueries, refetch: refetchFn }) }
}

export async function trpcMockFactory() {
  const { queryState, updateMutate, resetMutate, resetDbMutate, revealMutateAsync, mutationOpts, isResetDbPending } = await import('./Settings.helpers')
  return {
    trpc: {
      admin: {
        settings: {
          list: { useQuery: () => ({ data: { __v_isRef: true, value: queryState.data }, isLoading: queryState.isLoading, refetch: refetchFn }) },
          update: { useMutation: (opts: any) => { mutationOpts.update = opts; return { mutate: updateMutate, isPending: false } } },
          reset: { useMutation: (opts: any) => { mutationOpts.reset = opts; return { mutate: resetMutate, isPending: false } } },
          reveal: { useMutation: () => ({ mutateAsync: revealMutateAsync, isPending: false }) },
        },
        data: {
          resetDatabase: { useMutation: (opts: any) => { mutationOpts.resetDb = opts; return { mutate: resetDbMutate, isPending: isResetDbPending } } },
        },
      },
      json: { getFeatureCards: {} },
    },
    trpcClient: { query: vi.fn() },
  }
}

export function resetAllMocks() {
  authState._authenticated = false
  authState._admin = false
  queryState.data = [
    { key: 'REDIS_ENABLED', value: 'false', type: 'boolean', label: 'Redis Enabled', description: 'Enable Redis caching', group: 'redis', isPublic: true },
    { key: 'APP_SECRET', value: '********', type: 'string', label: 'App Secret', description: 'Secret key', group: 'general', isPublic: false },
    { key: 'API_KEY', value: 'sk-123456', type: 'string', label: 'API Key', description: 'API key', group: 'api', isPublic: true },
  ]
  isResetDbPending.value = false
  authState.login.mockReset()
  authState.logout.mockReset()
  updateMutate.mockReset()
  resetMutate.mockReset()
  resetDbMutate.mockReset()
  revealMutateAsync.mockReset()
  revealMutateAsync.mockResolvedValue({ value: 'revealed-value' })
  mutationOpts.update = null
  mutationOpts.reset = null
  mutationOpts.resetDb = null
  vi.clearAllMocks()
}
