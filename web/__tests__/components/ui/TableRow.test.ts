// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TableRow from '@/components/ui/TableRow.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('TableRow.vue', () => {
  it('renders tr element', () => {
    const wrapper = mount(TableRow)
    expect(wrapper.find('tr').exists()).toBe(true)
  })

  it('renders slot content', () => {
    const wrapper = mount(TableRow, { slots: { default: 'Row Content' } })
    expect(wrapper.text()).toBe('Row Content')
  })
})
