// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '@/components/ui/Button.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('Button.vue', () => {
  it('renders button element', () => {
    const wrapper = mount(Button)
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('renders slot content', () => {
    const wrapper = mount(Button, { slots: { default: 'Click me' } })
    expect(wrapper.text()).toBe('Click me')
  })

  it('applies default variant by default', () => {
    const wrapper = mount(Button)
    expect(wrapper.find('button').attributes('data-variant')).toBe('default')
  })

  it('applies default size by default', () => {
    const wrapper = mount(Button)
    expect(wrapper.find('button').attributes('data-size')).toBe('default')
  })

  it('accepts variant prop', () => {
    const wrapper = mount(Button, { props: { variant: 'destructive' } })
    expect(wrapper.find('button').attributes('data-variant')).toBe('destructive')
  })

  it('accepts size prop', () => {
    const wrapper = mount(Button, { props: { size: 'lg' } })
    expect(wrapper.find('button').attributes('data-size')).toBe('lg')
  })

  it('has data-slot="button"', () => {
    const wrapper = mount(Button)
    expect(wrapper.find('[data-slot="button"]').exists()).toBe(true)
  })
})
