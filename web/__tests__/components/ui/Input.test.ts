// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Input from '@/components/ui/Input.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('Input.vue', () => {
  it('renders input element', () => {
    const wrapper = mount(Input)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('renders input element with type attribute', () => {
    const wrapper = mount(Input, { props: { type: 'email' } })
    const el = wrapper.find('input').element
    expect(el.tagName.toLowerCase()).toBe('input')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(Input, { props: { modelValue: '' } })
    const input = wrapper.find('input')
    await input.setValue('new value')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['new value'])
  })

  it('displays modelValue', () => {
    const wrapper = mount(Input, { props: { modelValue: 'hello' } })
    const input = wrapper.find('input').element as HTMLInputElement
    expect(input.value).toBe('hello')
  })

  it('has data-slot="input"', () => {
    const wrapper = mount(Input)
    expect(wrapper.find('[data-slot="input"]').exists()).toBe(true)
  })
})
