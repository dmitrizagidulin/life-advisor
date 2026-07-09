/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  activeGoals,
  activeProjects,
  allCompleted,
  allForStatus,
  allTodo,
  focusOnArea,
  goalProjects
} from './queries'
import { createActionItem, createGoal, createProject } from './factories'

const D = 'dev'
const ai = (o: Omit<Parameters<typeof createActionItem>[0], 'deviceId'>) =>
  createActionItem({ ...o, deviceId: D })
const proj = (o: Omit<Parameters<typeof createProject>[0], 'deviceId'>) =>
  createProject({ ...o, deviceId: D })
const goal = (o: Omit<Parameters<typeof createGoal>[0], 'deviceId'>) =>
  createGoal({ ...o, deviceId: D })

describe('allTodo', () => {
  const items = [
    ai({ name: 'a', done: false, mywnCategory: 'critical', area: 'work' }),
    ai({ name: 'b', done: true, mywnCategory: 'critical', area: 'work' }),
    ai({ name: 'c', done: false, mywnCategory: 'someday', area: 'admin' }),
    ai({ name: 'd', done: false, mywnCategory: 'someday', area: 'assistant' }),
    ai({ name: 'e', done: false, mywnCategory: 'someday', area: 'work', parentType: 'project', parentKey: 'p1' })
  ]

  it('excludes done items', () => {
    expect(allTodo(items).map((x) => x.name)).not.toContain('b')
  })

  it('filters by category', () => {
    expect(allTodo(items, 'critical').map((x) => x.name)).toEqual(['a'])
  })

  it("admin area filter also matches assistant", () => {
    const names = allTodo(items, undefined, 'admin').map((x) => x.name).sort()
    expect(names).toEqual(['c', 'd'])
  })

  it('non-admin area is an exact match', () => {
    expect(allTodo(items, undefined, 'assistant').map((x) => x.name)).toEqual(['d'])
  })

  it('excludes parented items when includeProjectItems is false', () => {
    const names = allTodo(items, 'someday', undefined, false).map((x) => x.name).sort()
    // c and d have no parentKey; e is parented and excluded
    expect(names).toEqual(['c', 'd'])
  })
})

describe('allCompleted', () => {
  it('returns done items', () => {
    const items = [ai({ name: 'a', done: true }), ai({ name: 'b', done: false })]
    expect(allCompleted(items).map((x) => x.name)).toEqual(['a'])
  })
})

describe('project status selectors', () => {
  const projects = [
    proj({ name: 'idea', status: 'idea', area: 'work' }),
    proj({ name: 'active1', status: 'active', area: 'work' }),
    proj({ name: 'active2', status: 'active', area: 'soul' })
  ]

  it('allForStatus and activeProjects', () => {
    expect(allForStatus(projects, 'idea').map((p) => p.name)).toEqual(['idea'])
    expect(activeProjects(projects).map((p) => p.name).sort()).toEqual([
      'active1',
      'active2'
    ])
  })

  it('focusOnArea matches status and exact area', () => {
    expect(focusOnArea(projects, 'work', 'active').map((p) => p.name)).toEqual([
      'active1'
    ])
    // admin does NOT pull assistant here (unlike allTodo)
    const withAssistant = [proj({ name: 'asst', status: 'active', area: 'assistant' })]
    expect(focusOnArea(withAssistant, 'admin', 'active')).toEqual([])
  })
})

describe('activeGoals', () => {
  const goals = [
    goal({ name: 'a', active: true, accomplished: false }),
    goal({ name: 'b', active: true, accomplished: true }),
    goal({ name: 'c', active: false, accomplished: false })
  ]

  it('excludes inactive and (by default) accomplished', () => {
    expect(activeGoals(goals).map((g) => g.name)).toEqual(['a'])
  })

  it('includes accomplished when requested', () => {
    expect(activeGoals(goals, true).map((g) => g.name).sort()).toEqual(['a', 'b'])
  })
})

describe('goalProjects', () => {
  it('returns projects whose goalIds include the goal', () => {
    const projects = [
      proj({ name: 'a', goalIds: ['g1', 'g2'] }),
      proj({ name: 'b', goalIds: ['g2'] }),
      proj({ name: 'c', goalIds: [] })
    ]
    expect(goalProjects(projects, 'g1').map((p) => p.name)).toEqual(['a'])
    expect(goalProjects(projects, 'g2').map((p) => p.name).sort()).toEqual(['a', 'b'])
  })
})
