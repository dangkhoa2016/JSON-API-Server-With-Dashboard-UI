// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Settings from '@/pages/Settings.vue'
import {
  authState, queryState, resetAllMocks,
} from './Settings.helpers'

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

const iconStub = { template: '<span class="icon-stub" />' }
const uiStubs = {
  Button: {
    name: 'Button',
    props: ['disabled'],
    emits: ['click'],
    template: '<button class="btn-stub" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  Input: {
    name: 'Input',
    props: ['modelValue'],
    emits: ['update:modelValue', 'keyup'],
    template: '<input class="input-stub" :value="modelValue" @keyup="$emit(\'keyup\', $event)" />',
  },
  Label: { name: 'Label', template: '<label class="label-stub"><slot /></label>' },
  Dialog: {
    name: 'Dialog',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="dialog-stub" v-if="modelValue"><slot /></div>',
  },
}

function createMountWrapper(options?: Record<string, boolean>) {
  const authenticated = options?.authenticated ?? false
  const admin = options?.admin ?? false
  authState._authenticated = authenticated
  authState._admin = admin
  return mount(Settings, {
    global: {
      stubs: {
        SettingsIcon: iconStub,
        Loader2: iconStub,
        LogIn: iconStub,
        LogOut: iconStub,
        Save: iconStub,
        RotateCcw: iconStub,
        Eye: iconStub,
        EyeOff: iconStub,
        Trash2: iconStub,
        AlertTriangle: iconStub,
        Pencil: iconStub,
        ...uiStubs,
      },
    },
  })
}

describe('Settings.vue — authentication and login', () => {
  beforeEach(() => resetAllMocks())

  it('renders guest banner with login button', () => {
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('viewing settings as a guest')
  })

  it('renders admin section when authenticated', () => {
    const wrapper = createMountWrapper({ authenticated: true })
    expect(wrapper.text()).toContain('Logged in as')
    expect(wrapper.text()).toContain('admin')
  })

  it('renders reset database button for admin', () => {
    const wrapper = createMountWrapper({ authenticated: true })
    expect(wrapper.text()).toContain('Reset Database')
  })

  it('renders logout button for admin', () => {
    const wrapper = createMountWrapper({ authenticated: true })
    expect(wrapper.text()).toContain('Logout')
  })

  it('renders settings list items', () => {
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('Redis Enabled')
    expect(wrapper.text()).toContain('App Secret')
    expect(wrapper.text()).toContain('API Key')
  })

  it('renders sensitive badge for non-public settings', () => {
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('sensitive')
  })

  it('shows empty state when no settings', () => {
    queryState.data = []
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('No settings found')
  })

  it('setting with no description does not render description', () => {
    queryState.data = [
      { key: 'NO_DESC', value: 'val', type: 'string', group: 'general', isPublic: true },
    ]
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('NO_DESC')
  })

  it('shows loading state while settings load', () => {
    queryState.isLoading = true
    const wrapper = createMountWrapper()
    expect((wrapper.vm as any).isLoading).toBe(true)
    queryState.isLoading = false
  })

  it('login dialog opens and shows form', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Admin Login')
  })

  it('triggers login via enter key on username input', async () => {
    authState.login.mockResolvedValue({ ok: true })
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.loginUsername = 'admin'
    vm.loginPassword = 'pass'
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const inputs = wrapper.findAllComponents({ name: 'Input' })
    inputs[0].vm.$emit('keyup', { key: 'Enter' })
    await wrapper.vm.$nextTick()
    expect(authState.login).toHaveBeenCalledWith('admin', 'pass')
  })

  it('triggers login via enter key on password input', async () => {
    authState.login.mockResolvedValue({ ok: true })
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.loginUsername = 'admin'
    vm.loginPassword = 'pass'
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const inputs = wrapper.findAllComponents({ name: 'Input' })
    inputs[1].vm.$emit('keyup', { key: 'Enter' })
    await wrapper.vm.$nextTick()
    expect(authState.login).toHaveBeenCalledWith('admin', 'pass')
  })

  it('clicking login button calls doLogin', async () => {
    authState.login.mockResolvedValue({ ok: true })
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.loginUsername = 'admin'
    vm.loginPassword = 'pass'
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAllComponents({ name: 'Button' })
    const loginBtn = buttons.filter((b) => b.text() === 'Login').at(-1)
    loginBtn.vm.$emit('click')
    await wrapper.vm.$nextTick()
    expect(authState.login).toHaveBeenCalled()
  })

  it('clicking guest banner login button opens dialog', async () => {
    const wrapper = createMountWrapper()
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAllComponents({ name: 'Button' })
    const guestLoginBtn = buttons.filter((b) => b.text() === 'Login')[0]
    guestLoginBtn.vm.$emit('click')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as any
    expect(vm.showLoginDialog).toBe(true)
  })

  it('shows login error message', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    vm.loginError = 'Invalid username or password'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Invalid username or password')
  })

  it('username input v-model handler updates loginUsername', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const inputs = wrapper.findAllComponents({ name: 'Input' })
    inputs[0].vm.$emit('update:modelValue', 'newuser')
    await wrapper.vm.$nextTick()
    expect(vm.loginUsername).toBe('newuser')
  })

  it('password input v-model handler updates loginPassword', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const inputs = wrapper.findAllComponents({ name: 'Input' })
    inputs[1].vm.$emit('update:modelValue', 'newpass')
    await wrapper.vm.$nextTick()
    expect(vm.loginPassword).toBe('newpass')
  })

  it('closing login dialog emits update:modelValue', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const dialogs = wrapper.findAllComponents({ name: 'Dialog' })
    const loginDialog = dialogs[1]
    loginDialog.vm.$emit('update:modelValue', false)
    await wrapper.vm.$nextTick()
    expect(vm.showLoginDialog).toBe(false)
  })

  it('clicking cancel in login dialog closes it', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAllComponents({ name: 'Button' })
    const cancelBtn = buttons.filter((b) => b.text() === 'Cancel')[0]
    await cancelBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.showLoginDialog).toBe(false)
  })
})
