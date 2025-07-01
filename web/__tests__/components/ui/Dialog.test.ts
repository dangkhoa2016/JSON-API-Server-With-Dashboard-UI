// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Dialog from '@/components/ui/Dialog.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

describe('Dialog.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders content when open via teleport', () => {
    mount(Dialog, {
      props: { modelValue: true },
      slots: { default: 'Hello Dialog' },
      attachTo: document.body,
    })
    expect(document.body.innerHTML).toContain('Hello Dialog')
  })

  it('does not render when closed', () => {
    mount(Dialog, {
      props: { modelValue: false },
      slots: { default: 'Hidden' },
    })
    expect(document.body.innerHTML).not.toContain('Hidden')
  })

  it('closes when clicking backdrop', async () => {
    const wrapper = mount(Dialog, {
      props: { modelValue: true },
      attachTo: document.body,
    })
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50') ?? document.querySelector('[class*="inset-0"]')
    if (backdrop) {
      ;(backdrop as HTMLElement).click()
    }
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('closes when clicking close button', async () => {
    const wrapper = mount(Dialog, {
      props: { modelValue: true },
      attachTo: document.body,
    })
    const closeBtn = document.querySelector('[data-slot="dialog-close"]') as HTMLElement
    expect(closeBtn).toBeTruthy()
    closeBtn.click()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('renders dialog content with correct data-slot', () => {
    mount(Dialog, {
      props: { modelValue: true },
      slots: { default: 'Content' },
      attachTo: document.body,
    })
    const content = document.querySelector('[data-slot="dialog-content"]')
    expect(content).toBeTruthy()
  })
})
