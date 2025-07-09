// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { RouterLinkStub } from '@vue/test-utils'
import { reactive } from 'vue'
import AppLayout from '@/components/AppLayout.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

const mockRoute = reactive({ path: '/users' })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
}))

const { setTheme: mockSetTheme, theme: mockTheme } = vi.hoisted(() => {
  const themeRef = { value: 'auto' }
  return {
    setTheme: vi.fn((mode: string) => { themeRef.value = mode }),
    theme: themeRef,
  }
})

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
}))

const globalOpts = {
  stubs: { RouterLink: RouterLinkStub },
}

describe('AppLayout.vue', () => {
  beforeEach(() => {
    mockSetTheme.mockReset()
    mockTheme.value = 'auto'
  })

  it('renders slot content', () => {
    const wrapper = shallowMount(AppLayout, {
      slots: { default: 'Main Content' },
      global: globalOpts,
    })
    expect(wrapper.text()).toContain('Main Content')
  })

  it('renders navigation items', () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Users')
    expect(wrapper.text()).toContain('Posts')
    expect(wrapper.text()).toContain('Comments')
    expect(wrapper.text()).toContain('Albums')
    expect(wrapper.text()).toContain('Photos')
    expect(wrapper.text()).toContain('Todos')
  })

  it('renders sidebar header', () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    expect(wrapper.text()).toContain('JSON API Server')
    expect(wrapper.text()).toContain('With Dashboard UI')
  })

  it('renders footer link', () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    expect(wrapper.text()).toContain('Inspired by json-server')
  })

  it('toggles sidebar on hamburger click', async () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    const toggleBtn = wrapper.find('button[aria-label="Toggle sidebar"]')
    expect(toggleBtn.exists()).toBe(true)
    await toggleBtn.trigger('click')
    const vm = wrapper.vm as any
    expect(vm.sidebarOpen).toBe(true)
    await toggleBtn.trigger('click')
    expect(vm.sidebarOpen).toBe(false)
  })

  it('closes sidebar via closeSidebar method', () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    const vm = wrapper.vm as any
    vm.sidebarOpen = true
    vm.closeSidebar()
    expect(vm.sidebarOpen).toBe(false)
  })

  it('has correct aria-labels', () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    const toggle = wrapper.find('button[aria-label="Toggle sidebar"]')
    expect(toggle.exists()).toBe(true)
    const close = wrapper.find('button[aria-label="Close sidebar"]')
    expect(close.exists()).toBe(true)
  })

  it('sidebar class changes with sidebarOpen state', () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    const vm = wrapper.vm as any
    expect(vm.sidebarOpen).toBe(false)
    vm.sidebarOpen = true
    expect((wrapper.vm as any).sidebarOpen).toBe(true)
  })

  it('renders router-links with correct "to" prop', () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    const links = wrapper.findAllComponents(RouterLinkStub)
    const toPaths = links.map(l => l.props('to'))
    expect(toPaths).toContain('/')
    expect(toPaths).toContain('/users')
    expect(toPaths).toContain('/posts')
    expect(toPaths).toContain('/comments')
  })

  it('shows theme toggle button with current theme', () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    expect(wrapper.text()).toContain('auto')
  })

  it('opens theme dropdown on toggle click', async () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    const toggleBtn = wrapper.findAll('button').filter(b => b.text().includes('auto'))[0]
    expect(toggleBtn.exists()).toBe(true)
    await toggleBtn.trigger('click')
    const vm = wrapper.vm as any
    expect(vm.showThemeMenu).toBe(true)
    expect(wrapper.text()).toContain('Light')
    expect(wrapper.text()).toContain('Dark')
    expect(wrapper.text()).toContain('Auto')
  })

  it('selects a theme from the dropdown', async () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    const toggleBtn = wrapper.findAll('button').filter(b => b.text().includes('auto'))[0]
    await toggleBtn.trigger('click')
    const darkBtn = wrapper.findAll('button').filter(b => b.text() === 'Dark')[0]
    await darkBtn.trigger('click')
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
    const vm = wrapper.vm as any
    expect(vm.showThemeMenu).toBe(false)
  })

  it('selecting light theme calls setTheme', async () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    const toggleBtn = wrapper.findAll('button').filter(b => b.text().includes('auto'))[0]
    await toggleBtn.trigger('click')
    const lightBtn = wrapper.findAll('button').filter(b => b.text() === 'Light')[0]
    await lightBtn.trigger('click')
    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })

  it('selecting auto theme calls setTheme', async () => {
    const wrapper = shallowMount(AppLayout, { global: globalOpts })
    const toggleBtn = wrapper.findAll('button').filter(b => b.text().includes('auto'))[0]
    await toggleBtn.trigger('click')
    const autoBtn = wrapper.findAll('button').filter(b => b.text() === 'Auto')[0]
    await autoBtn.trigger('click')
    expect(mockSetTheme).toHaveBeenCalledWith('auto')
  })

  it('closes dropdown when clicking outside', async () => {
    const wrapper = shallowMount(AppLayout, { attachTo: document.body, global: globalOpts })
    const toggleBtn = wrapper.findAll('button').filter(b => b.text().includes('auto'))[0]
    await toggleBtn.trigger('click')
    const vm = wrapper.vm as any
    expect(vm.showThemeMenu).toBe(true)
    document.body.click()
    expect(vm.showThemeMenu).toBe(false)
    wrapper.unmount()
  })

  it('scrolls main content to top when route path changes', async () => {
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo

    const wrapper = shallowMount(AppLayout, { global: globalOpts })

    mockRoute.path = '/'
    await wrapper.vm.$nextTick()

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  })
})
