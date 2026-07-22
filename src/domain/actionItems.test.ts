/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  bump,
  categoryMove,
  enforceCompletedAt,
  isValidCategory,
  setMywnCategory,
  toggleDone
} from './actionItems'
import { createActionItem } from './factories'

const D = 'dev'
const NOW = '2026-07-06T12:00:00.000Z'
const ai = (o: Omit<Parameters<typeof createActionItem>[0], 'clientId'>) =>
  createActionItem({ ...o, clientId: D })

describe('toggleDone', () => {
  it('marks undone item done and stamps completedAt', () => {
    const item = ai({ name: 'x', done: false, completedAt: null })
    const result = toggleDone(item, NOW)
    expect(result.done).toBe(true)
    expect(result.completedAt).toBe(NOW)
    expect(result.updatedAt).toBe(NOW)
  })

  it('marks done item undone and clears completedAt', () => {
    const item = ai({ name: 'x', done: true, completedAt: '2026-01-01T00:00:00Z' })
    const result = toggleDone(item, NOW)
    expect(result.done).toBe(false)
    expect(result.completedAt).toBe(null)
  })

  it('does not mutate the input', () => {
    const item = ai({ name: 'x', done: false })
    toggleDone(item, NOW)
    expect(item.done).toBe(false)
  })
})

describe('enforceCompletedAt', () => {
  it('stamps a done item that is missing completedAt', () => {
    const item = ai({ name: 'x', done: true, completedAt: null })
    expect(enforceCompletedAt(item, NOW).completedAt).toBe(NOW)
  })

  it('leaves an existing completedAt untouched', () => {
    const item = ai({ name: 'x', done: true, completedAt: '2026-01-01T00:00:00Z' })
    expect(enforceCompletedAt(item, NOW).completedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('does NOT clear completedAt on a not-done item (ported Rails behavior)', () => {
    const item = ai({ name: 'x', done: false, completedAt: '2026-01-01T00:00:00Z' })
    expect(enforceCompletedAt(item, NOW).completedAt).toBe('2026-01-01T00:00:00Z')
  })
})

describe('bump', () => {
  it('increments bumpCount and bumps updatedAt', () => {
    const item = ai({ name: 'x', bumpCount: 2 })
    const result = bump(item, NOW)
    expect(result.bumpCount).toBe(3)
    expect(result.updatedAt).toBe(NOW)
  })
})

describe('setMywnCategory', () => {
  it('sets the category and stamps updatedAt', () => {
    const item = ai({ name: 'x', mywnCategory: 'someday' })
    const result = setMywnCategory(item, 'critical', NOW)
    expect(result.mywnCategory).toBe('critical')
    expect(result.updatedAt).toBe(NOW)
  })

  it('does not mutate the input', () => {
    const item = ai({ name: 'x', mywnCategory: 'someday' })
    setMywnCategory(item, 'critical', NOW)
    expect(item.mywnCategory).toBe('someday')
  })
})

describe('isValidCategory', () => {
  it('accepts valid and rejects invalid', () => {
    expect(isValidCategory('critical')).toBe(true)
    expect(isValidCategory('someday')).toBe(true)
    expect(isValidCategory('bogus')).toBe(false)
  })
})

describe('categoryMove', () => {
  it('moves only not-done items of the source category and counts them', () => {
    const items = [
      ai({ name: 'a', mywnCategory: 'tomorrow', done: false }),
      ai({ name: 'b', mywnCategory: 'tomorrow', done: false }),
      ai({ name: 'c', mywnCategory: 'tomorrow', done: true }),
      ai({ name: 'd', mywnCategory: 'critical', done: false })
    ]
    const { moved, count } = categoryMove(items, 'tomorrow', 'critical', NOW)
    expect(count).toBe(2)
    expect(moved.map((m) => m.name).sort()).toEqual(['a', 'b'])
    expect(moved.every((m) => m.mywnCategory === 'critical')).toBe(true)
    expect(moved.every((m) => m.updatedAt === NOW)).toBe(true)
  })

  it('throws on an invalid category', () => {
    expect(() => categoryMove([], 'bogus', 'critical')).toThrow('Invalid MYWN Category')
    expect(() => categoryMove([], 'critical', 'bogus')).toThrow('Invalid MYWN Category')
  })
})
