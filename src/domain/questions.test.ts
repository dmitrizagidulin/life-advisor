/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { setAnswered, splitByProject } from './questions'
import { createQuestion } from './factories'

const D = 'dev'
const NOW = '2026-07-06T12:00:00.000Z'
const q = (o: Omit<Parameters<typeof createQuestion>[0], 'deviceId'>) =>
  createQuestion({ ...o, deviceId: D })

describe('setAnswered', () => {
  it('sets answered and stamps answeredAt', () => {
    const question = q({ name: 'why', answered: false, answeredAt: null })
    const r = setAnswered(question, true, NOW)
    expect(r.answered).toBe(true)
    expect(r.answeredAt).toBe(NOW)
    expect(r.updatedAt).toBe(NOW)
  })

  it('clears answeredAt when un-answering', () => {
    const question = q({ name: 'why', answered: true, answeredAt: '2026-01-01T00:00:00Z' })
    const r = setAnswered(question, false, NOW)
    expect(r.answered).toBe(false)
    expect(r.answeredAt).toBe(null)
  })
})

describe('splitByProject', () => {
  it('separates project-parented from the rest', () => {
    const p = q({ name: 'p', parentType: 'project', parentKey: 'proj1' })
    const day = q({ name: 'day', parentType: 'day', parentKey: '2026-07-06' })
    const bare = q({ name: 'bare' })
    const { project, nonProject } = splitByProject([p, day, bare])
    expect(project.map((x) => x.name)).toEqual(['p'])
    expect(nonProject.map((x) => x.name).sort()).toEqual(['bare', 'day'])
  })
})
