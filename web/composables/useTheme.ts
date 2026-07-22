import { ref } from 'vue'

export type ThemeMode = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'theme'

const theme = ref<ThemeMode>('auto')

export function getSystemTheme(): 'light' | 'dark' {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function readStoredTheme(): ThemeMode | null {
  if (typeof localStorage === 'undefined') return null
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  return stored && ['auto', 'light', 'dark'].includes(stored) ? stored : null
}

let mql: MediaQueryList | null = null
let themeChangeHandler: (() => void) | null = null

export function listenForSystemThemeChanges() {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mql = window.matchMedia('(prefers-color-scheme: dark)')
    if (typeof mql.addEventListener === 'function') {
      themeChangeHandler = () => {
        if (theme.value === 'auto') {
          applyTheme('auto')
        }
      }
      mql.addEventListener('change', themeChangeHandler)
    }
  }
}

export function cleanupThemeListeners() {
  if (mql && themeChangeHandler && typeof mql.removeEventListener === 'function') {
    mql.removeEventListener('change', themeChangeHandler)
    mql = null
    themeChangeHandler = null
  }
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === 'auto' ? getSystemTheme() : mode
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

function init() {
  const stored = readStoredTheme()
  theme.value = stored ?? 'auto'

  applyTheme(theme.value)
  listenForSystemThemeChanges()
}

init()

export function useTheme() {
  function setTheme(mode: ThemeMode) {
    theme.value = mode
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* storage unavailable */ }
    applyTheme(mode)
  }

  return { theme, setTheme }
}
