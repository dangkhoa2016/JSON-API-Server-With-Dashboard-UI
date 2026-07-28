// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Settings from '@/pages/Settings.vue'
import { authState, queryState, refetchFn, toastSuccess, resetAllMocks } from './Settings.helpers'

vi.mock('@/lib/utils', async () => {
  const { utilsMockFactory } = await import('./Settings.helpers')
  return utilsMockFactory()
})
vi.mock('vue-sonner', async () => {
  const { sonnerMockFactory } = await import('./Settings.helpers')
  return sonnerMockFactory()
})
vi.mock('@/composables/useAuth', async () => {
  const { authMockFactory } = await import('./Settings.helpers')
  return authMockFactory()
})
vi.mock('@tanstack/vue-query', async () => {
  const { queryClientMockFactory } = await import('./Settings.helpers')
  return queryClientMockFactory()
})
vi.mock('@/providers/trpc', async () => {
  const { trpcMockFactory } = await import('./Settings.helpers')
  return trpcMockFactory()
})

describe('Settings.vue — authentication and data', () => {
  beforeEach(() => resetAllMocks())

  function createWrapper() {
    return shallowMount(Settings)
  }

  it('shows guest banner when not authenticated', () => {
    const wrapper = createWrapper()
    const banner = wrapper.find('[class*="bg-amber"]')
    expect(banner.exists()).toBe(true)
    expect(wrapper.text()).toContain('viewing settings as a guest')
  })

  it('shows admin section when authenticated', () => {
    authState._authenticated = true
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Logged in as')
    expect(wrapper.text()).toContain('admin')
  })

  it('calls logout on doLogout', () => {
    authState._authenticated = true
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.doLogout()
    expect(authState.logout).toHaveBeenCalled()
    expect(refetchFn).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Logged out')
  })

  it('renders settings list with correct keys', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    expect(vm.settings).toHaveLength(3)
    expect(vm.settings[0].key).toBe('REDIS_ENABLED')
    expect(vm.settings[2].key).toBe('API_KEY')
  })

  it('shows empty state when no settings', () => {
    queryState.data = []
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('No settings found')
  })

  it('displays rate limit message from server', async () => {
    authState._authenticated = false
    authState.login.mockResolvedValue({ ok: false, message: 'Too many login attempts. Try again in 842s.' })
    const wrapper = createWrapper()
    const vm = wrapper.vm as any

    vm.loginUsername = 'admin'
    vm.loginPassword = 'wrong'
    await vm.doLogin()

    expect(vm.loginError).toBe('Too many login attempts. Try again in 842s.')
  })
})
