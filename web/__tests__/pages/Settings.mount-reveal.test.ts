// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Settings from '@/pages/Settings.vue'
import {
  authState, queryState, revealMutateAsync,
  resetAllMocks,
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

describe('Settings.vue — reveal sensitive values', () => {
  beforeEach(() => resetAllMocks())

  it('guest sees public setting values but not secret', () => {
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('false')
    expect(wrapper.text()).toContain('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')
    expect(wrapper.text()).not.toContain('secret123')
  })

  it('admin sees secret setting value as masked', () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    expect(wrapper.text()).toContain('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')
  })

  it('clicking eye button toggles visibleKeys', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    await wrapper.vm.$nextTick()
    vm.startEdit('APP_SECRET', 'val')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toEqual([])
    const eyeBtn = wrapper.find('button[title="Toggle password visibility"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toContain('APP_SECRET')
  })

  it('clicking non-edit eye button toggles visibleKeys', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toEqual([])
    expect(vm.editingValues['APP_SECRET']).toBeUndefined()
    const eyeBtn = wrapper.find('button[title="Reveal value"]')
    expect(eyeBtn.exists()).toBe(true)
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toContain('APP_SECRET')
    expect(wrapper.text()).toContain('revealed-value')
    expect(wrapper.text()).not.toContain('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')
  })

  it('clicking eye button twice hides then shows value', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    await wrapper.vm.$nextTick()
    const eyeBtn = wrapper.find('button[title="Reveal value"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toContain('APP_SECRET')
    const hideBtn = wrapper.find('button[title="Hide value"]')
    await hideBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toEqual([])
  })

  it('editing a secret setting shows password field', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    await wrapper.vm.$nextTick()
    vm.startEdit('APP_SECRET', 'secret123')
    await wrapper.vm.$nextTick()
    expect(Object.keys(vm.editingValues)).toContain('APP_SECRET')
  })

  it('editing secret key triggers SECRET branch in type prop', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.startEdit('APP_SECRET', 'val')
    await wrapper.vm.$nextTick()
    expect(vm.editingValues['APP_SECRET']).toBe('val')
    expect(vm.visibleKeys).toEqual([])
  })

  it('toggling visibleKeys while editing secret key', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.startEdit('APP_SECRET', 'val')
    await wrapper.vm.$nextTick()
    vm.visibleKeys = ['APP_SECRET']
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toContain('APP_SECRET')
  })

  it('editing key with PASSWORD triggers that branch', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.startEdit('DB_PASSWORD', 'pwd')
    await wrapper.vm.$nextTick()
    expect(vm.editingValues['DB_PASSWORD']).toBe('pwd')
  })

  it('public setting with empty value shows non-breaking space for guest', () => {
    queryState.data = [
      { key: 'EMPTY_PUBLIC', value: '', type: 'string', group: 'general', isPublic: true },
    ]
    const wrapper = createMountWrapper()
    expect(wrapper.html()).toContain('&nbsp;')
  })

  it('public setting with empty value shows non-breaking space for admin', () => {
    queryState.data = [
      { key: 'EMPTY_PUBLIC', value: '', type: 'string', group: 'general', isPublic: true },
    ]
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    expect(wrapper.html()).toContain('&nbsp;')
  })

  it('non-public setting with empty value shows non-breaking space when revealed', async () => {
    queryState.data = [
      { key: 'EMPTY_SECRET', value: '********', type: 'string', group: 'general', isPublic: false },
    ]
    revealMutateAsync.mockResolvedValue({ value: '' })
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const eyeBtn = wrapper.find('button[title="Reveal value"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    const hideBtn = wrapper.find('button[title="Hide value"]')
    expect(hideBtn.exists()).toBe(true)
    expect(wrapper.html()).toContain('&nbsp;')
  })

  it('hasChanges returns false for a key not in editingValues', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    expect(vm.hasChanges('NONEXISTENT_KEY')).toBe(false)
  })

  it('shows error toast when reveal fails', async () => {
    queryState.data = [
      { key: 'FAIL_REVEAL', value: '********', type: 'string', group: 'general', isPublic: false },
    ]
    revealMutateAsync.mockRejectedValue(new Error('Reveal failed'))
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const eyeBtn = wrapper.find('button[title="Reveal value"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect((await import('./Settings.helpers')).toastError).toHaveBeenCalledWith('Failed to reveal setting value')
    expect((wrapper.vm as any).visibleKeys).toEqual([])
  })

  it('reveal returning null does not crash', async () => {
    queryState.data = [
      { key: 'NULL_REVEAL', value: '********', type: 'string', group: 'general', isPublic: false },
    ]
    revealMutateAsync.mockResolvedValue(null as any)
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const eyeBtn = wrapper.find('button[title="Reveal value"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).visibleKeys).toContain('NULL_REVEAL')
  })
})
