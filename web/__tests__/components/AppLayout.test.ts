// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { RouterLinkStub } from '@vue/test-utils'
import AppLayout from '@/components/AppLayout.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

const mockRoute = { path: '/users' }
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
}))

const globalOpts = {
  stubs: { RouterLink: RouterLinkStub },
}

describe('AppLayout.vue', () => {
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
})
