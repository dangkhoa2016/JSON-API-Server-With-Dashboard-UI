process.env.DATABASE_URL = ":memory:";
process.env.RATE_LIMIT_ENABLED = "false";
process.env.CACHE_ENABLED = "false";
process.env.REDIS_ENABLED = "false";
process.env.DEBUG_SQL = "false";
process.env.APP_SECRET = "test-secret";

// Workaround for vitest + Node 26 compatibility:
// Node 26 defines globalThis.localStorage/sessionStorage as experimental
// getters returning undefined. vitest's jsdom environment skips properties
// already on globalThis that aren't in its known keys list, so localStorage
// never gets wired up from jsdom's window. Patch it here instead.
const jsdom = (globalThis as Record<string, unknown>).jsdom as Record<string, unknown> | undefined
if (typeof jsdom !== 'undefined' && jsdom.window) {
  const win = jsdom.window as Record<string, unknown>
  if (typeof win.localStorage !== 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: win.localStorage,
      writable: true,
      configurable: true,
    })
  }
  if (typeof win.sessionStorage !== 'undefined') {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: win.sessionStorage,
      writable: true,
      configurable: true,
    })
  }
}
