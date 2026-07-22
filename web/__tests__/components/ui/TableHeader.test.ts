// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TableHeader from '@/components/ui/TableHeader.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('TableHeader.vue', () => {
  it('renders thead element', () => {
    const wrapper = mount(TableHeader)
    expect(wrapper.find('thead').exists()).toBe(true)
  })

  it('renders slot content', () => {
    const wrapper = mount(TableHeader, { slots: { default: 'Header Content' } })
    expect(wrapper.text()).toBe('Header Content')
  })
})
