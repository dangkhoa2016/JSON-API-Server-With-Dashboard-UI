// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TableCell from '@/components/ui/TableCell.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('TableCell.vue', () => {
  it('renders td element', () => {
    const wrapper = mount(TableCell)
    expect(wrapper.find('td').exists()).toBe(true)
  })

  it('renders slot content', () => {
    const wrapper = mount(TableCell, { slots: { default: 'Cell Content' } })
    expect(wrapper.text()).toBe('Cell Content')
  })
})
