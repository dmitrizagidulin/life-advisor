/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { dayKeysBack, localDayKey, nowIso, shiftDayKey, todayKey } from './dates'

describe('todayKey', () => {
  it('formats local Y-M-D with zero padding', () => {
    // Local March 5 2026 (constructed in local time)
    expect(todayKey(new Date(2026, 2, 5))).toBe('2026-03-05')
    expect(todayKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('localDayKey', () => {
  it('returns the local day of an ISO instant', () => {
    const iso = new Date(2026, 6, 6, 9, 30).toISOString()
    expect(localDayKey(iso)).toBe('2026-07-06')
  })
})

describe('shiftDayKey', () => {
  it('goes back and forward across month boundaries', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDayKey('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftDayKey('2026-07-06', 0)).toBe('2026-07-06')
  })
})

describe('dayKeysBack', () => {
  it('is inclusive on both ends and descending', () => {
    const keys = dayKeysBack('2026-07-06', 3)
    expect(keys).toEqual(['2026-07-06', '2026-07-05', '2026-07-04', '2026-07-03'])
  })

  it('defaults to 61 entries (60 days back, inclusive)', () => {
    expect(dayKeysBack('2026-07-06').length).toBe(61)
  })
})

describe('nowIso', () => {
  it('returns a parseable ISO string', () => {
    expect(Number.isNaN(Date.parse(nowIso()))).toBe(false)
  })
})
