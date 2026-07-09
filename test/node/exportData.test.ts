/**
 * Unit tests for the pure export-bundle shaping: correct WAS-collection keys,
 * pass-through of docs, and the singleton current-focus becoming a 0/1-element
 * array.
 */
import { describe, it, expect } from 'vitest'
import { buildExportBundle } from '@/lib/exportData'
import type {
  ActionItemDoc,
  CurrentFocusDoc,
  ThoughtDoc
} from '@/types/domain'

function emptyInput() {
  return {
    actionItems: [] as ActionItemDoc[],
    projects: [],
    goals: [],
    questions: [],
    answers: [],
    webLinks: [],
    thoughts: [] as ThoughtDoc[],
    currentFocus: null as CurrentFocusDoc | null
  }
}

describe('buildExportBundle', () => {
  it('keys every collection by its WAS collection name', () => {
    const bundle = buildExportBundle(emptyInput())
    expect(Object.keys(bundle).sort()).toEqual(
      [
        'action-items',
        'answers',
        'current-focus',
        'goals',
        'projects',
        'questions',
        'thoughts',
        'web-links'
      ].sort()
    )
    for (const value of Object.values(bundle)) {
      expect(Array.isArray(value)).toBe(true)
    }
  })

  it('passes decrypted docs straight through', () => {
    const item = {
      id: 'a1',
      name: 'Write report',
      done: false,
      mywnCategory: 'someday',
      completedAt: null,
      area: 'admin',
      timeElapsed: 0,
      bumpCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    } as ActionItemDoc
    const bundle = buildExportBundle({ ...emptyInput(), actionItems: [item] })
    expect(bundle['action-items']).toEqual([item])
  })

  it('emits current-focus as a one-element array when present', () => {
    const focus = {
      id: '_current_focus',
      focusType: 'day',
      focusKey: '2026-07-07',
      createdAt: '2026-07-07T00:00:00.000Z',
      updatedAt: '2026-07-07T00:00:00.000Z'
    } as CurrentFocusDoc
    const bundle = buildExportBundle({ ...emptyInput(), currentFocus: focus })
    expect(bundle['current-focus']).toEqual([focus])
  })

  it('emits an empty current-focus array when unset', () => {
    const bundle = buildExportBundle(emptyInput())
    expect(bundle['current-focus']).toEqual([])
  })
})
