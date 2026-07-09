/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  compareActionItems,
  compareChildren,
  compareDayItems,
  compareGoals,
  compareProjects,
  compareQuestions,
  daySortKey,
  sortActionItemsCompletedDesc
} from './sort'
import { createActionItem, createGoal, createProject, createQuestion } from './factories'

const D = 'dev'
const ai = (o: Omit<Parameters<typeof createActionItem>[0], 'deviceId'>) =>
  createActionItem({ ...o, deviceId: D })

describe('compareActionItems', () => {
  it('sorts by bumpCount DESC first', () => {
    const a = ai({ name: 'a', bumpCount: 1, createdAt: '2026-01-01T00:00:00Z' })
    const b = ai({ name: 'b', bumpCount: 5, createdAt: '2026-01-01T00:00:00Z' })
    expect([a, b].sort(compareActionItems).map((x) => x.name)).toEqual(['b', 'a'])
  })

  it('then by AREAS enum order (work < soul < admin < assistant)', () => {
    const admin = ai({ name: 'admin', area: 'admin', bumpCount: 0 })
    const work = ai({ name: 'work', area: 'work', bumpCount: 0 })
    const assistant = ai({ name: 'asst', area: 'assistant', bumpCount: 0 })
    expect(
      [admin, assistant, work].sort(compareActionItems).map((x) => x.area)
    ).toEqual(['work', 'admin', 'assistant'])
  })

  it('then by createdAt DESC', () => {
    const older = ai({
      name: 'older',
      area: 'work',
      bumpCount: 0,
      createdAt: '2026-01-01T00:00:00Z'
    })
    const newer = ai({
      name: 'newer',
      area: 'work',
      bumpCount: 0,
      createdAt: '2026-02-01T00:00:00Z'
    })
    expect(
      [older, newer].sort(compareActionItems).map((x) => x.name)
    ).toEqual(['newer', 'older'])
  })

  it('bumpCount dominates area order', () => {
    const highBumpAssistant = ai({ name: 'hi', area: 'assistant', bumpCount: 9 })
    const lowBumpWork = ai({ name: 'lo', area: 'work', bumpCount: 1 })
    expect(
      [lowBumpWork, highBumpAssistant].sort(compareActionItems).map((x) => x.name)
    ).toEqual(['hi', 'lo'])
  })
})

describe('compareProjects / compareGoals', () => {
  it('projects: bumpCount DESC then name ASC', () => {
    const a = createProject({ deviceId: D, name: 'Banana', bumpCount: 2 })
    const b = createProject({ deviceId: D, name: 'Apple', bumpCount: 2 })
    const c = createProject({ deviceId: D, name: 'Cherry', bumpCount: 9 })
    expect([a, b, c].sort(compareProjects).map((x) => x.name)).toEqual([
      'Cherry',
      'Apple',
      'Banana'
    ])
  })

  it('goals: bumpCount DESC then name ASC', () => {
    const a = createGoal({ deviceId: D, name: 'Zeta', bumpCount: 0 })
    const b = createGoal({ deviceId: D, name: 'Alpha', bumpCount: 0 })
    expect([a, b].sort(compareGoals).map((x) => x.name)).toEqual(['Alpha', 'Zeta'])
  })
})

describe('compareQuestions', () => {
  it('bumpCount DESC then createdAt ASC', () => {
    const a = createQuestion({
      deviceId: D,
      name: 'a',
      bumpCount: 1,
      createdAt: '2026-02-01T00:00:00Z'
    })
    const b = createQuestion({
      deviceId: D,
      name: 'b',
      bumpCount: 1,
      createdAt: '2026-01-01T00:00:00Z'
    })
    const c = createQuestion({
      deviceId: D,
      name: 'c',
      bumpCount: 9,
      createdAt: '2026-03-01T00:00:00Z'
    })
    expect([a, b, c].sort(compareQuestions).map((x) => x.name)).toEqual([
      'c',
      'b',
      'a'
    ])
  })
})

describe('compareChildren', () => {
  it('createdAt DESC', () => {
    const a = { createdAt: '2026-01-01T00:00:00Z' }
    const b = { createdAt: '2026-02-01T00:00:00Z' }
    expect([a, b].sort(compareChildren)).toEqual([b, a])
  })
})

describe('daySortKey / compareDayItems', () => {
  it('uses completedAt when done and set, else createdAt', () => {
    const done = ai({
      name: 'done',
      done: true,
      completedAt: '2026-05-05T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z'
    })
    const todo = ai({ name: 'todo', createdAt: '2026-03-03T00:00:00Z' })
    expect(daySortKey(done)).toBe('2026-05-05T00:00:00Z')
    expect(daySortKey(todo)).toBe('2026-03-03T00:00:00Z')
    // ascending order by the day key
    expect([done, todo].sort(compareDayItems).map((x) => x.name)).toEqual([
      'todo',
      'done'
    ])
  })

  it('done item without completedAt falls back to createdAt', () => {
    const item = ai({ name: 'x', done: true, completedAt: null })
    expect(daySortKey(item)).toBe(item.createdAt)
  })
})

describe('sortActionItemsCompletedDesc', () => {
  it('is the reverse of the action-item comparator', () => {
    const a = ai({ name: 'a', bumpCount: 1 })
    const b = ai({ name: 'b', bumpCount: 5 })
    // forward puts b first; reverse puts a first
    expect(sortActionItemsCompletedDesc([a, b]).map((x) => x.name)).toEqual([
      'a',
      'b'
    ])
  })
})
