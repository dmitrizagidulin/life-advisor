import { describe, it, expect } from 'vitest'
import { formatTimestamp } from '@/lib/dates'

describe('formatTimestamp', () => {
  it('renders an ISO timestamp via the locale date+time format', () => {
    const iso = '2026-07-11T15:30:00Z'
    expect(formatTimestamp(iso)).toBe(new Date(iso).toLocaleString())
  })

  it('returns a non-empty string', () => {
    expect(formatTimestamp('2026-01-02T03:04:05Z')).not.toBe('')
  })
})
