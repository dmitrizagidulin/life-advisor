/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  currentFocus,
  focusOn,
  nonDefaultFocusExists,
  resetFocus
} from './focus'
import { createCurrentFocus } from './factories'

const D = 'dev'
const TODAY = '2026-07-06'

describe('currentFocus', () => {
  it('defaults to today when the doc is missing', () => {
    expect(currentFocus(null, TODAY)).toEqual({ focusType: 'day', focusKey: TODAY })
  })

  it("resolves the day/'today' sentinel to today's date", () => {
    const doc = createCurrentFocus({ focusType: 'day', focusKey: 'today', deviceId: D })
    expect(currentFocus(doc, TODAY)).toEqual({ focusType: 'day', focusKey: TODAY })
  })

  it('returns an entity focus verbatim', () => {
    const doc = createCurrentFocus({ focusType: 'project', focusKey: 'proj1', deviceId: D })
    expect(currentFocus(doc, TODAY)).toEqual({ focusType: 'project', focusKey: 'proj1' })
  })
})

describe('nonDefaultFocusExists', () => {
  it('false for missing doc and the today sentinel', () => {
    expect(nonDefaultFocusExists(null, TODAY)).toBe(false)
    const sentinel = createCurrentFocus({ focusType: 'day', focusKey: 'today', deviceId: D })
    expect(nonDefaultFocusExists(sentinel, TODAY)).toBe(false)
  })

  it("false when the focus is today's explicit date", () => {
    const doc = createCurrentFocus({ focusType: 'day', focusKey: TODAY, deviceId: D })
    expect(nonDefaultFocusExists(doc, TODAY)).toBe(false)
  })

  it('true for an entity focus', () => {
    const doc = createCurrentFocus({ focusType: 'goal', focusKey: 'g1', deviceId: D })
    expect(nonDefaultFocusExists(doc, TODAY)).toBe(true)
  })
})

describe('focusOn / resetFocus', () => {
  it('focusOn builds a fixed-id focus doc for the target', () => {
    const doc = focusOn('project', 'p1', D)
    expect(doc.id).toBe('_current_focus')
    expect(doc.focusType).toBe('project')
    expect(doc.focusKey).toBe('p1')
  })

  it('resetFocus builds the today sentinel', () => {
    const doc = resetFocus(D)
    expect(doc.focusType).toBe('day')
    expect(doc.focusKey).toBe('today')
    expect(nonDefaultFocusExists(doc, TODAY)).toBe(false)
  })
})
