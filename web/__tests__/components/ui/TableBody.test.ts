// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TableBody from '@/components/ui/TableBody.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('TableBody.vue', () => {
  it('renders tbody element', () => {
    const wrapper = mount(TableBody)
    expect(wrapper.find('tbody').exists()).toBe(true)
  })

  it('renders slot content', () => {
    const wrapper = mount(TableBody, { slots: { default: 'Body Content' } })
    expect(wrapper.text()).toBe('Body Content')
  })
})
