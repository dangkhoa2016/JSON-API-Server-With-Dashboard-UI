// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

type MQHandler = () => void

const matchMediaMock = vi.hoisted(() => {
  let changeHandler: MQHandler | null = null
  let matches = false

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (_query: string) => ({
      get matches() { return matches },
      media: _query,
      addEventListener(_event: string, handler: MQHandler) {
        if (_event === 'change') changeHandler = handler
      },
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  })

  return {
    setMatches(v: boolean) {
      matches = v
      if (changeHandler) changeHandler()
    },
    reset() {
      changeHandler = null
      matches = false
    },
  }
})

import { useTheme } from '@/composables/useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    matchMediaMock.setMatches(false)
  })

  it('applies dark class via setTheme', () => {
    const { setTheme } = useTheme()
    setTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes dark class via setTheme', () => {
    document.documentElement.classList.add('dark')
    const { setTheme } = useTheme()
    setTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists to localStorage on setTheme', () => {
    const { setTheme } = useTheme()
    setTheme('light')
    expect(localStorage.getItem('theme')).toBe('light')
    setTheme('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    setTheme('auto')
    expect(localStorage.getItem('theme')).toBe('auto')
  })

  it('applies dark when system prefers dark in auto mode', () => {
    matchMediaMock.setMatches(true)
    const { setTheme } = useTheme()
    setTheme('auto')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies light when system prefers light in auto mode', () => {
    document.documentElement.classList.add('dark')
    matchMediaMock.setMatches(false)
    const { setTheme } = useTheme()
    setTheme('auto')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('reacts to system theme change in auto mode', () => {
    matchMediaMock.setMatches(false)
    const { setTheme } = useTheme()
    setTheme('auto')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    matchMediaMock.setMatches(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not react to system theme change in non-auto mode', () => {
    const { setTheme } = useTheme()
    setTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    matchMediaMock.setMatches(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('theme ref updates on setTheme', () => {
    const { theme, setTheme } = useTheme()
    setTheme('dark')
    expect(theme.value).toBe('dark')
    setTheme('light')
    expect(theme.value).toBe('light')
  })

  it('handles matchMedia throwing', () => {
    const orig = window.matchMedia
    vi.spyOn(window, 'matchMedia').mockImplementation(() => {
      throw new Error('no matchMedia')
    })
    const { setTheme } = useTheme()
    setTheme('auto')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    window.matchMedia = orig
  })
})
