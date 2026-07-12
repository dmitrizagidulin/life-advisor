/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  createActionItem,
  createAnswer,
  createCurrentFocus,
  createGoal,
  createProject,
  createQuestion,
  createThought,
  createWebLink
} from './factories'

const D = 'dev'
const NOW = '2026-07-06T12:00:00.000Z'
const TODAY = '2026-07-06'

describe('createActionItem defaults', () => {
  it('applies the ported defaults', () => {
    const item = createActionItem({ name: 'x', deviceId: D }, NOW, 'id-1')
    expect(item).toMatchObject({
      id: 'id-1',
      name: 'x',
      done: false,
      mywnCategory: 'someday',
      completedAt: null,
      area: 'admin',
      timeElapsed: 0,
      bumpCount: 0,
      createdAt: NOW,
      updatedAt: NOW,
      deviceId: D
    })
  })

  it('lets a provided false done through', () => {
    expect(createActionItem({ name: 'x', deviceId: D, done: false }).done).toBe(false)
  })
})

describe('createProject defaults', () => {
  it('idea status, null timestamps, empty goalIds, admin area', () => {
    const p = createProject({ name: 'p', deviceId: D }, NOW)
    expect(p).toMatchObject({
      status: 'idea',
      completedAt: null,
      canceledAt: null,
      area: 'admin',
      bumpCount: 0,
      goalIds: []
    })
  })

  it('created with completed status stamps completedAt and clears canceledAt', () => {
    const p = createProject({ name: 'p', status: 'completed', deviceId: D }, NOW)
    expect(p.status).toBe('completed')
    expect(p.completedAt).toBe(NOW)
    expect(p.canceledAt).toBe(null)
  })

  it('created with canceled status stamps canceledAt and clears completedAt', () => {
    const p = createProject({ name: 'p', status: 'canceled', deviceId: D }, NOW)
    expect(p.status).toBe('canceled')
    expect(p.canceledAt).toBe(NOW)
    expect(p.completedAt).toBe(null)
  })

  it('created with active status leaves both timestamps null', () => {
    const p = createProject({ name: 'p', status: 'active', deviceId: D }, NOW)
    expect(p.status).toBe('active')
    expect(p.completedAt).toBe(null)
    expect(p.canceledAt).toBe(null)
  })
})

describe('createGoal defaults', () => {
  it('active true, accomplished false', () => {
    const g = createGoal({ name: 'g', deviceId: D })
    expect(g.active).toBe(true)
    expect(g.accomplished).toBe(false)
    expect(g.bumpCount).toBe(0)
  })
})

describe('createQuestion defaults', () => {
  it('answered false, answeredAt null', () => {
    const q = createQuestion({ name: 'q', deviceId: D })
    expect(q.answered).toBe(false)
    expect(q.answeredAt).toBe(null)
  })
})

describe('createAnswer', () => {
  it('is always question-parented', () => {
    const a = createAnswer({ deviceId: D, parentKey: 'q1' })
    expect(a.parentType).toBe('question')
    expect(a.parentKey).toBe('q1')
  })
})

describe('createWebLink / createThought day default', () => {
  it('web link with no parent defaults to today', () => {
    const l = createWebLink({ url: 'https://x.com', deviceId: D }, NOW, 'id', TODAY)
    expect(l.parentType).toBe('day')
    expect(l.parentKey).toBe(TODAY)
  })

  it("web link with 'today' sentinel maps to today's date", () => {
    const l = createWebLink(
      { url: 'https://x.com', deviceId: D, parentType: 'day', parentKey: 'today' },
      NOW,
      'id',
      TODAY
    )
    expect(l.parentKey).toBe(TODAY)
  })

  it('web link keeps an explicit real parent', () => {
    const l = createWebLink(
      { url: 'https://x.com', deviceId: D, parentType: 'project', parentKey: 'p1' },
      NOW,
      'id',
      TODAY
    )
    expect(l.parentType).toBe('project')
    expect(l.parentKey).toBe('p1')
  })

  it('thought defaults to today', () => {
    const t = createThought({ name: 'idea', deviceId: D }, NOW, 'id', TODAY)
    expect(t.parentType).toBe('day')
    expect(t.parentKey).toBe(TODAY)
  })
})

describe('createCurrentFocus', () => {
  it('has the fixed singleton id', () => {
    const f = createCurrentFocus({ focusType: 'day', focusKey: 'today', deviceId: D })
    expect(f.id).toBe('_current_focus')
  })
})
