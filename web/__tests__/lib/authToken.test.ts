// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { setAuthToken, getAuthToken } from '@/lib/authToken'

describe('authToken', () => {
  it('returns null by default', () => {
    expect(getAuthToken()).toBeNull()
  })

  it('stores and retrieves a token', () => {
    setAuthToken('my-token')
    expect(getAuthToken()).toBe('my-token')
  })

  it('clears token when set to null', () => {
    setAuthToken('temp')
    setAuthToken(null)
    expect(getAuthToken()).toBeNull()
  })

  it('overwrites previous token', () => {
    setAuthToken('first')
    setAuthToken('second')
    expect(getAuthToken()).toBe('second')
  })
})
