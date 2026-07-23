import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { getDb } from '../queries/connection'

describe('LIKE escape behavior — filter path', () => {
  const db = getDb()

  beforeAll(async () => {
    await db.run(sql`CREATE TABLE IF NOT EXISTS like_test_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )`)
    await db.run(sql`DELETE FROM like_test_items`)
    await db.run(sql`
      INSERT INTO like_test_items (name) VALUES
        ('price is 100%'),
        ('100% off today'),
        ('discount 50%'),
        ('test_user_123'),
        ('testUser456'),
        ('hello cat'),
        ('1000 items'),
        ('Dave'),
        ('Daniel')
    `)
  })

  afterAll(async () => {
    await db.run(sql`DROP TABLE IF EXISTS like_test_items`)
  })

  function filterEscape(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&').replace(/\*/g, '%')
  }

  it('prefix wildcard D* matches only names starting with D', async () => {
    const escaped = filterEscape('D*')
    const rows = await db.all(sql`SELECT name FROM like_test_items WHERE name LIKE ${escaped} ESCAPE ${'\\'}`)
    const names = rows.map(r => r.name)
    expect(names).toContain('Dave')
    expect(names).toContain('Daniel')
    expect(names).not.toContain('hello cat')
  })

  it('contains wildcard *100* matches names containing 100', async () => {
    const escaped = filterEscape('*100*')
    const rows = await db.all(sql`SELECT name FROM like_test_items WHERE name LIKE ${escaped} ESCAPE ${'\\'}`)
    const names = rows.map(r => r.name)
    expect(names).toContain('price is 100%')
    expect(names).toContain('100% off today')
    expect(names).toContain('1000 items')
    expect(names).not.toContain('hello cat')
    expect(names).not.toContain('Dave')
  })

  it('literal % in value does not act as wildcard', async () => {
    const escaped = filterEscape('*100%*')
    const rows = await db.all(sql`SELECT name FROM like_test_items WHERE name LIKE ${escaped} ESCAPE ${'\\'}`)
    const names = rows.map(r => r.name)
    expect(names).toContain('price is 100%')
    expect(names).toContain('100% off today')
    expect(names).not.toContain('1000 items')
  })

  it('literal _ in value does not act as single-char wildcard', async () => {
    const escaped = filterEscape('*test_user*')
    const rows = await db.all(sql`SELECT name FROM like_test_items WHERE name LIKE ${escaped} ESCAPE ${'\\'}`)
    const names = rows.map(r => r.name)
    expect(names).toContain('test_user_123')
    expect(names).not.toContain('testUser456')
  })

  it('suffix wildcard *cat matches names ending with cat', async () => {
    const escaped = filterEscape('*cat')
    const rows = await db.all(sql`SELECT name FROM like_test_items WHERE name LIKE ${escaped} ESCAPE ${'\\'}`)
    const names = rows.map(r => r.name)
    expect(names).toContain('hello cat')
    expect(names).not.toContain('Dave')
  })

  it('Drizzle parameterized ESCAPE is treated as SQL keyword, not string literal', async () => {
    const rows = await db.all(sql`SELECT name FROM like_test_items WHERE name LIKE ${'%test\\_user%'} ESCAPE ${'\\'}`)
    const names = rows.map(r => r.name)
    expect(names).toContain('test_user_123')
    expect(names).not.toContain('testUser456')
  })

  it('without ESCAPE clause, backslash does not escape _', async () => {
    const rows = await db.all(sql`SELECT name FROM like_test_items WHERE name LIKE ${'%test\\_user%'}`)
    const names = rows.map(r => r.name)
    expect(names).not.toContain('test_user_123')
  })
})
