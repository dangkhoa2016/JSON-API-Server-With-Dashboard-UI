// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ResourceSearch from '@/components/ResourceSearch.vue'

function createWrapper(props?: Record<string, any>) {
  return mount(ResourceSearch, {
    props: {
      modelValue: '',
      searchMode: 'client',
      placeholder: 'Search...',
      ...props,
    },
  })
}

describe('ResourceSearch.vue', () => {
  it('renders with default props', () => {
    const wrapper = createWrapper()
    const textInput = wrapper.find('input[placeholder]')
    expect(textInput.exists()).toBe(true)
    expect(textInput.attributes('placeholder')).toBe('Search...')
  })

  it('updates localValue on input and emits after debounce', async () => {
    vi.useFakeTimers()
    const wrapper = createWrapper()
    const textInput = wrapper.find('input[placeholder]')
    await textInput.setValue('test')
    expect(wrapper.vm.localValue).toBe('test')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['test'])
    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('search')!.pop()).toEqual(['test'])
    vi.useRealTimers()
  })

  it('clears search on clearSearch', () => {
    const wrapper = createWrapper({ modelValue: 'test' })
    wrapper.vm.localValue = 'test'
    wrapper.vm.clearSearch()
    expect(wrapper.vm.localValue).toBe('')
    expect(wrapper.emitted('update:modelValue')!.pop()).toEqual([''])
    expect(wrapper.emitted('search')!.pop()).toEqual([''])
  })

  it('calls clearSearch on Esc key', async () => {
    const wrapper = createWrapper({ modelValue: 'test' })
    wrapper.vm.localValue = 'test'
    await wrapper.find('.group').trigger('keydown.esc')
    expect(wrapper.vm.localValue).toBe('')
    expect(wrapper.emitted('update:modelValue')!.pop()).toEqual([''])
    expect(wrapper.emitted('search')!.pop()).toEqual([''])
  })

  it('switches search mode to server', () => {
    const wrapper = createWrapper()
    wrapper.vm.switchMode('server')
    expect(wrapper.emitted('update:searchMode')![0]).toEqual(['server'])
    expect(wrapper.emitted('search')![0]).toEqual([''])
  })

  it('emits search on switchMode with current localValue', () => {
    const wrapper = createWrapper({ modelValue: 'hello' })
    wrapper.vm.localValue = 'hello'
    wrapper.vm.switchMode('server')
    expect(wrapper.emitted('search')![0]).toEqual(['hello'])
  })

  it('watches modelValue prop change', async () => {
    const wrapper = createWrapper({ modelValue: 'initial' })
    expect(wrapper.vm.localValue).toBe('initial')
    await wrapper.setProps({ modelValue: 'updated' })
    expect(wrapper.vm.localValue).toBe('updated')
  })

  it('unmounts without error', () => {
    const wrapper = createWrapper()
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('clears debounce timer on new input', async () => {
    vi.useFakeTimers()
    const wrapper = createWrapper()
    const textInput = wrapper.find('input[placeholder]')
    await textInput.setValue('first')
    const firstTimer = wrapper.vm.debounceTimer
    expect(firstTimer).not.toBeNull()
    await textInput.setValue('second')
    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('search')!.pop()).toEqual(['second'])
    vi.useRealTimers()
  })

  it('renders clear button when localValue is truthy', async () => {
    const wrapper = createWrapper({ modelValue: 'test' })
    wrapper.vm.localValue = 'test'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('renders kbd when localValue is empty', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('kbd').exists()).toBe(true)
    expect(wrapper.find('kbd').text()).toBe('/')
  })

  it('client radio is checked by default', () => {
    const wrapper = createWrapper()
    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios.length).toBe(2)
    expect((radios[0].element as HTMLInputElement).value).toBe('client')
    expect((radios[1].element as HTMLInputElement).value).toBe('server')
  })

  it('clicking server radio triggers switchMode', async () => {
    const wrapper = createWrapper()
    const serverRadio = wrapper.find('input[type="radio"][value="server"]')
    await serverRadio.trigger('change')
    expect(wrapper.emitted('update:searchMode')!.pop()).toEqual(['server'])
  })

  it('clicking client radio also triggers switchMode', async () => {
    const wrapper = createWrapper()
    const clientRadio = wrapper.find('input[type="radio"][value="client"]')
    await clientRadio.trigger('change')
    expect(wrapper.emitted('update:searchMode')!.pop()).toEqual(['client'])
  })

  it('updates ternary class when searchMode prop changes', async () => {
    const wrapper = createWrapper()
    const labels = wrapper.findAll('label')
    const clientLabelClasses = labels[0].classes()
    expect(clientLabelClasses).toContain('bg-blue-600')
    await wrapper.setProps({ searchMode: 'server' })
    expect(labels[0].classes()).toContain('text-muted-foreground')
    expect(labels[1].classes()).toContain('bg-blue-600')
  })

  it('clearDebounceNulls the timer', () => {
    const wrapper = createWrapper()
    wrapper.vm.debounceTimer = setTimeout(() => {}, 1000)
    wrapper.vm.clearDebounce()
    expect(wrapper.vm.debounceTimer).toBeNull()
  })

  it('input with no value sets localValue and emits empty', async () => {
    const wrapper = createWrapper()
    const textInput = wrapper.find('input[placeholder]')
    await textInput.setValue('')
    expect(wrapper.vm.localValue).toBe('')
    expect(wrapper.emitted('update:modelValue')!.pop()).toEqual([''])
  })
})
