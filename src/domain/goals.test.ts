/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { splitGoals, subGoals } from './goals'
import { createGoal } from './factories'

const D = 'dev'
const goal = (o: Omit<Parameters<typeof createGoal>[0], 'deviceId'>) =>
  createGoal({ ...o, deviceId: D })

describe('subGoals', () => {
  it('returns goal-parented children ordered createdAt DESC', () => {
    const parent = goal({ name: 'parent' })
    const older = goal({
      name: 'older',
      parentType: 'goal',
      parentKey: parent.id,
      createdAt: '2026-01-01T00:00:00Z'
    })
    const newer = goal({
      name: 'newer',
      parentType: 'goal',
      parentKey: parent.id,
      createdAt: '2026-02-01T00:00:00Z'
    })
    const unrelated = goal({ name: 'unrelated', parentType: 'goal', parentKey: 'x' })
    expect(
      subGoals([parent, older, newer, unrelated], parent.id).map((g) => g.name)
    ).toEqual(['newer', 'older'])
  })
})

describe('splitGoals', () => {
  it('splits active (unaccomplished, sorted), accomplished, and inactive', () => {
    const active1 = goal({ name: 'Beta', active: true, accomplished: false, bumpCount: 0 })
    const active2 = goal({ name: 'Alpha', active: true, accomplished: false, bumpCount: 0 })
    const accomplished = goal({ name: 'Done', active: true, accomplished: true })
    const inactive = goal({ name: 'Off', active: false, accomplished: false })
    const { active, accomplished: acc, inactive: inact } = splitGoals([
      active1,
      active2,
      accomplished,
      inactive
    ])
    expect(active.map((g) => g.name)).toEqual(['Alpha', 'Beta'])
    expect(acc.map((g) => g.name)).toEqual(['Done'])
    expect(inact.map((g) => g.name)).toEqual(['Off'])
  })

  it('an accomplished-but-active goal is not in active', () => {
    const g = goal({ name: 'g', active: true, accomplished: true })
    expect(splitGoals([g]).active).toEqual([])
    expect(splitGoals([g]).accomplished.map((x) => x.name)).toEqual(['g'])
  })
})
