/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  changeStatus,
  nextAction,
  serveGoalToggle,
  timeElapsed
} from './projects'
import { createActionItem, createProject } from './factories'

const D = 'dev'
const NOW = '2026-07-06T12:00:00.000Z'
const proj = (o: Omit<Parameters<typeof createProject>[0], 'deviceId'>) =>
  createProject({ ...o, deviceId: D })
const ai = (o: Omit<Parameters<typeof createActionItem>[0], 'deviceId'>) =>
  createActionItem({ ...o, deviceId: D })

describe('changeStatus', () => {
  it('completed sets completedAt, clears canceledAt', () => {
    const p = proj({ name: 'p', canceledAt: '2026-01-01T00:00:00Z' })
    const r = changeStatus(p, 'completed', NOW)
    expect(r.status).toBe('completed')
    expect(r.completedAt).toBe(NOW)
    expect(r.canceledAt).toBe(null)
  })

  it('canceled sets canceledAt, clears completedAt', () => {
    const p = proj({ name: 'p', completedAt: '2026-01-01T00:00:00Z' })
    const r = changeStatus(p, 'canceled', NOW)
    expect(r.status).toBe('canceled')
    expect(r.canceledAt).toBe(NOW)
    expect(r.completedAt).toBe(null)
  })

  it.each(['idea', 'active', 'someday'] as const)(
    'status %s clears both timestamps',
    (status) => {
      const p = proj({
        name: 'p',
        completedAt: '2026-01-01T00:00:00Z',
        canceledAt: '2026-01-01T00:00:00Z'
      })
      const r = changeStatus(p, status, NOW)
      expect(r.status).toBe(status)
      expect(r.completedAt).toBe(null)
      expect(r.canceledAt).toBe(null)
    }
  )
})

describe('nextAction', () => {
  it('returns the first not-done child by the action-item comparator', () => {
    const p = proj({ name: 'p' })
    const low = ai({
      name: 'low',
      parentType: 'project',
      parentKey: p.id,
      bumpCount: 1
    })
    const high = ai({
      name: 'high',
      parentType: 'project',
      parentKey: p.id,
      bumpCount: 9
    })
    const done = ai({
      name: 'done',
      parentType: 'project',
      parentKey: p.id,
      bumpCount: 99,
      done: true
    })
    const other = ai({ name: 'other', parentType: 'project', parentKey: 'zzz' })
    expect(nextAction(p, [low, high, done, other])?.name).toBe('high')
  })

  it('returns undefined when no todo children', () => {
    const p = proj({ name: 'p' })
    expect(nextAction(p, [])).toBeUndefined()
  })
})

describe('timeElapsed', () => {
  it('sums timeElapsed across items', () => {
    const items = [
      ai({ name: 'a', timeElapsed: 1.5 }),
      ai({ name: 'b', timeElapsed: 2 }),
      ai({ name: 'c', timeElapsed: 0 })
    ]
    expect(timeElapsed(items)).toBe(3.5)
  })
})

describe('serveGoalToggle', () => {
  it('adds a goal not yet served', () => {
    const p = proj({ name: 'p', goalIds: [] })
    const r = serveGoalToggle(p, 'g1', NOW)
    expect(r.goalIds).toEqual(['g1'])
    expect(r.updatedAt).toBe(NOW)
  })

  it('removes a goal already served', () => {
    const p = proj({ name: 'p', goalIds: ['g1', 'g2'] })
    expect(serveGoalToggle(p, 'g1', NOW).goalIds).toEqual(['g2'])
  })
})
