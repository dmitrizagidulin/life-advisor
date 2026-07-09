/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { enforceDefaultDayParent, forParent, hasParent } from './parent'

describe('forParent', () => {
  it('filters by type+key and sorts createdAt DESC', () => {
    const docs = [
      { parentType: 'project' as const, parentKey: 'p1', createdAt: '2026-01-01T00:00:00Z', name: 'a' },
      { parentType: 'project' as const, parentKey: 'p1', createdAt: '2026-03-01T00:00:00Z', name: 'b' },
      { parentType: 'project' as const, parentKey: 'p2', createdAt: '2026-02-01T00:00:00Z', name: 'c' },
      { parentType: 'day' as const, parentKey: 'p1', createdAt: '2026-04-01T00:00:00Z', name: 'd' }
    ]
    expect(forParent(docs, 'project', 'p1').map((d) => d.name)).toEqual(['b', 'a'])
  })
})

describe('hasParent', () => {
  it('true only when both fields present', () => {
    expect(hasParent({ parentType: 'project', parentKey: 'x' })).toBe(true)
    expect(hasParent({ parentType: 'project' })).toBe(false)
    expect(hasParent({})).toBe(false)
  })
})

describe('enforceDefaultDayParent', () => {
  it('defaults a doc with no parentType to today', () => {
    const r = enforceDefaultDayParent({}, '2026-07-06')
    expect(r).toEqual({ parentType: 'day', parentKey: '2026-07-06' })
  })

  it("maps the literal day/'today' sentinel to today's date", () => {
    const r = enforceDefaultDayParent({ parentType: 'day', parentKey: 'today' }, '2026-07-06')
    expect(r.parentKey).toBe('2026-07-06')
  })

  it('leaves a real parent untouched', () => {
    const doc = { parentType: 'project' as const, parentKey: 'p1' }
    expect(enforceDefaultDayParent(doc, '2026-07-06')).toEqual(doc)
  })

  it('leaves an explicit day date untouched', () => {
    const doc = { parentType: 'day' as const, parentKey: '2026-01-01' }
    expect(enforceDefaultDayParent(doc, '2026-07-06')).toEqual(doc)
  })
})
