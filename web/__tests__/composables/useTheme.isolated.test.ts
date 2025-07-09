// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getSystemTheme,
  readStoredTheme,
  listenForSystemThemeChanges,
  cleanupThemeListeners,
} from '@/composables/useTheme'

beforeEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('getSystemTheme', () => {
  it('returns light on matchMedia error', () => {
    const orig = window.matchMedia
    window.matchMedia = (() => { throw new Error('fail') }) as any
    try {
      expect(getSystemTheme()).toBe('light')
    } finally {
      window.matchMedia = orig
    }
  })
})

describe('readStoredTheme', () => {
  afterEach(() => {
    localStorage.removeItem('theme')
  })

  it('returns null when localStorage is undefined', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    try {
      expect(readStoredTheme()).toBeNull()
    } finally {
      if (desc) Object.defineProperty(globalThis, 'localStorage', desc)
    }
  })

  it('returns null when no theme is stored', () => {
    expect(readStoredTheme()).toBeNull()
  })

  it('returns stored theme when valid', () => {
    localStorage.setItem('theme', 'dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('returns null when stored value is invalid', () => {
    localStorage.setItem('theme', 'invalid')
    expect(readStoredTheme()).toBeNull()
  })
})

describe('listenForSystemThemeChanges', () => {
  it('does nothing when matchMedia is not a function', () => {
    const orig = window.matchMedia
    ;(window as any).matchMedia = undefined
    try {
      expect(() => listenForSystemThemeChanges()).not.toThrow()
    } finally {
      window.matchMedia = orig
    }
  })

  it('does nothing when addEventListener is not a function', () => {
    const orig = window.matchMedia
    window.matchMedia = (() => ({}) as unknown) as typeof window.matchMedia
    try {
      expect(() => listenForSystemThemeChanges()).not.toThrow()
    } finally {
      window.matchMedia = orig
    }
  })
})

describe('cleanupThemeListeners', () => {
  it('does nothing when no listener was registered', () => {
    expect(() => cleanupThemeListeners()).not.toThrow()
  })

  it('removes the registered listener', () => {
    const orig = window.matchMedia
    let removed = false
    window.matchMedia = (() => ({
      addEventListener: () => {},
      removeEventListener: () => { removed = true },
    }) as unknown) as typeof window.matchMedia
    try {
      listenForSystemThemeChanges()
      cleanupThemeListeners()
      expect(removed).toBe(true)
    } finally {
      window.matchMedia = orig
    }
  })

  it('handles removeEventListener not being a function', () => {
    const orig = window.matchMedia
    window.matchMedia = (() => ({
      addEventListener: () => {},
    }) as unknown) as typeof window.matchMedia
    try {
      listenForSystemThemeChanges()
      expect(() => cleanupThemeListeners()).not.toThrow()
    } finally {
      window.matchMedia = orig
    }
  })
})
