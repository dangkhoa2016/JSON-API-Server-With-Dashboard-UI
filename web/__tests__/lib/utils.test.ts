// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { cn, tryParseJson } from '@/lib/utils'

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('handles conditional classes', () => {
    const hidden = false
    const result = cn('base', hidden && 'hidden', 'visible')
    expect(result).not.toContain('hidden')
    expect(result).toContain('visible')
    expect(result).toContain('base')
  })

  it('handles undefined and null', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })

  it('merges tailwind classes correctly (last wins)', () => {
    expect(cn('px-4', 'px-2')).toBe('px-2')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('tryParseJson()', () => {
  it('parses valid JSON string', () => {
    expect(tryParseJson('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' })
  })

  it('returns empty object for invalid JSON', () => {
    expect(tryParseJson('not json')).toEqual({})
  })

  it('returns empty object for empty string', () => {
    expect(tryParseJson('')).toEqual({})
  })

  it('parses nested objects', () => {
    expect(tryParseJson('{"geo":{"lat":"40.7"}}')).toEqual({ geo: { lat: '40.7' } })
  })
})
