/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { buildHistory, completedSameDay, dayHistory, hashByDate } from './history'
import { createActionItem } from './factories'

const D = 'dev'
// Build ISO timestamps from LOCAL wall-clock parts so day bucketing is stable
// regardless of the machine timezone.
const localIso = (y: number, m: number, d: number, h = 10) =>
  new Date(y, m - 1, d, h).toISOString()
const ai = (o: Omit<Parameters<typeof createActionItem>[0], 'clientId'>) =>
  createActionItem({ ...o, clientId: D })

describe('completedSameDay', () => {
  it('true when created and completed on the same local day', () => {
    const item = ai({
      name: 'x',
      done: true,
      createdAt: localIso(2026, 7, 6, 9),
      completedAt: localIso(2026, 7, 6, 17)
    })
    expect(completedSameDay(item)).toBe(true)
  })

  it('false across days and false with no completedAt', () => {
    const spanning = ai({
      name: 'x',
      done: true,
      createdAt: localIso(2026, 7, 5),
      completedAt: localIso(2026, 7, 6)
    })
    const open = ai({ name: 'y', createdAt: localIso(2026, 7, 6), completedAt: null })
    expect(completedSameDay(spanning)).toBe(false)
    expect(completedSameDay(open)).toBe(false)
  })
})

describe('hashByDate', () => {
  it('buckets by created day and completed day', () => {
    const item = ai({
      name: 'x',
      done: true,
      createdAt: localIso(2026, 7, 5),
      completedAt: localIso(2026, 7, 6)
    })
    const { createdByDay, completedByDay } = hashByDate([item])
    expect(createdByDay.get('2026-07-05')?.length).toBe(1)
    expect(completedByDay.get('2026-07-06')?.length).toBe(1)
  })
})

describe('dayHistory', () => {
  it('distinguishes same-day completion from carry-over', () => {
    const sameDay = ai({
      name: 'sameDay',
      done: true,
      createdAt: localIso(2026, 7, 6, 9),
      completedAt: localIso(2026, 7, 6, 17)
    })
    const createdOpen = ai({
      name: 'open',
      done: false,
      createdAt: localIso(2026, 7, 6, 8)
    })
    const completedFromEarlier = ai({
      name: 'earlier',
      done: true,
      createdAt: localIso(2026, 7, 1),
      completedAt: localIso(2026, 7, 6, 12)
    })
    const { createdByDay, completedByDay } = hashByDate([
      sameDay,
      createdOpen,
      completedFromEarlier
    ])
    const h = dayHistory('2026-07-06', createdByDay, completedByDay)
    expect(h.numCreatedItems).toBe(2) // sameDay + open
    expect(h.numCompletedSameDay).toBe(1) // just sameDay
    expect(h.createdNotCompleted.map((i) => i.name)).toEqual(['open'])
    expect(h.numCompletedItems).toBe(2) // sameDay + earlier
    expect(h.hasActivity).toBe(true)
    // items = completed (sameDay, earlier) + createdNotCompleted (open), by daySortKey ASC
    expect(h.items.map((i) => i.name)).toEqual(['open', 'earlier', 'sameDay'])
  })

  it('reports an empty day with no activity', () => {
    const h = dayHistory('2026-01-01', new Map(), new Map())
    expect(h.hasActivity).toBe(false)
    expect(h.items).toEqual([])
    expect(h.numCreatedItems).toBe(0)
  })
})

describe('buildHistory', () => {
  it('produces daysBack+1 descending entries', () => {
    const history = buildHistory([], '2026-07-06', 3)
    expect(history.map((h) => h.day)).toEqual([
      '2026-07-06',
      '2026-07-05',
      '2026-07-04',
      '2026-07-03'
    ])
  })

  it('places items on their day', () => {
    const item = ai({ name: 'x', createdAt: localIso(2026, 7, 5) })
    const history = buildHistory([item], '2026-07-06', 3)
    const day5 = history.find((h) => h.day === '2026-07-05')
    expect(day5?.numCreatedItems).toBe(1)
  })
})
