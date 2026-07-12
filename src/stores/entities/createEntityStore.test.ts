/**
 * Unit tests for the generic entity store's reactive `patch` verb, focusing on
 * the last-write-wins guard that protects against out-of-order remote change
 * events (two decrypts of the same doc landing in the wrong order, or a stale
 * remote echo racing a newer optimistic local edit).
 *
 * `patch` / `drop` touch only the in-memory Map (the sync stream owns the
 * persisted row), so these need no LocalStore.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { createEntityStore } from './createEntityStore'

interface Doc {
  id: string
  name: string
  updatedAt: string
  deviceId: string
}

function doc(over: Partial<Doc> & Pick<Doc, 'updatedAt'>): Doc {
  return {
    id: 'e1',
    name: 'n',
    deviceId: 'device-a',
    ...over
  }
}

describe('createEntityStore patch LWW guard', () => {
  it('applies a newer incoming payload over the held one', () => {
    const store = createEntityStore<Doc>('actionItems')
    store.getState().patch(doc({ name: 'old', updatedAt: '2026-01-01T00:00:00Z' }))
    store.getState().patch(doc({ name: 'new', updatedAt: '2026-02-02T00:00:00Z' }))
    expect(store.getState().byId.get('e1')!.name).toBe('new')
  })

  it('drops an older incoming payload (out-of-order decrypt)', () => {
    const store = createEntityStore<Doc>('actionItems')
    store.getState().patch(doc({ name: 'new', updatedAt: '2026-02-02T00:00:00Z' }))
    // A late-arriving OLDER event must not clobber the newer held value.
    store.getState().patch(doc({ name: 'old', updatedAt: '2026-01-01T00:00:00Z' }))
    expect(store.getState().byId.get('e1')!.name).toBe('new')
  })

  it('breaks an exact updatedAt tie by deviceId, keeping the held one on a loss', () => {
    const store = createEntityStore<Doc>('actionItems')
    const at = '2026-03-03T00:00:00Z'
    store.getState().patch(doc({ name: 'held', updatedAt: at, deviceId: 'device-z' }))
    // Same timestamp, lexically smaller deviceId: does not win, so skipped.
    store.getState().patch(doc({ name: 'other', updatedAt: at, deviceId: 'device-a' }))
    expect(store.getState().byId.get('e1')!.name).toBe('held')
  })

  it('inserts a brand-new doc unconditionally (no held value to compare)', () => {
    const store = createEntityStore<Doc>('actionItems')
    store.getState().patch(doc({ id: 'fresh', name: 'first', updatedAt: '2020-01-01T00:00:00Z' }))
    expect(store.getState().byId.get('fresh')!.name).toBe('first')
  })
})
