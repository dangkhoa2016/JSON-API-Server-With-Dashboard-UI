// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TableHead from '@/components/ui/TableHead.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('TableHead.vue', () => {
  it('renders th element', () => {
    const wrapper = mount(TableHead)
    expect(wrapper.find('th').exists()).toBe(true)
  })

  it('renders slot content', () => {
    const wrapper = mount(TableHead, { slots: { default: 'Header' } })
    expect(wrapper.text()).toBe('Header')
  })
})
