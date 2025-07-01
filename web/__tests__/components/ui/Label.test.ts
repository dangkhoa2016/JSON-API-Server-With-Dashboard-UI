// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Label from '@/components/ui/Label.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('Label.vue', () => {
  it('renders label element', () => {
    const wrapper = mount(Label)
    expect(wrapper.find('label').exists()).toBe(true)
  })

  it('renders slot content', () => {
    const wrapper = mount(Label, { slots: { default: 'Name' } })
    expect(wrapper.text()).toBe('Name')
  })

  it('applies for attribute', () => {
    const wrapper = mount(Label, { props: { for: 'username' } })
    expect(wrapper.find('label').attributes('for')).toBe('username')
  })

  it('has data-slot="label"', () => {
    const wrapper = mount(Label)
    expect(wrapper.find('[data-slot="label"]').exists()).toBe(true)
  })
})
