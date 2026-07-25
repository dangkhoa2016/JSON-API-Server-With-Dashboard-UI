// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Table from '@/components/ui/Table.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('Table.vue', () => {
  it('renders div container with data-slot', () => {
    const wrapper = mount(Table)
    expect(wrapper.find('[data-slot="table-container"]').exists()).toBe(true)
  })

  it('renders table element with data-slot', () => {
    const wrapper = mount(Table)
    expect(wrapper.find('[data-slot="table"]').exists()).toBe(true)
  })

  it('renders slot content', () => {
    const wrapper = mount(Table, {
      slots: { default: '<thead><tr><th>Name</th></tr></thead>' },
    })
    expect(wrapper.text()).toContain('Name')
  })
})
