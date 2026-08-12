/**
 * Current-focus store: a singleton doc with the fixed logical id `_current_focus`
 * (see `domain/focus.ts`). Unlike the other collections there is at most one row,
 * so the store holds a single `doc`. Hydration reconciles any duplicate rows (two
 * devices that each set focus before syncing) down to the LWW winner, and writes
 * go through the store's upsert (the hydration index decides insert vs in-place
 * update), so the app never mints a second envelope for the singleton. This is
 * the app's one write path that does not run through an entity store, so it
 * stamps the last-write-wins fields itself via `stampLww`.
 */
import { create } from 'zustand'
import { requireStore, stampLww } from '@interop/was-react'
import { focusOn, resetFocus } from '@/domain/focus'
import type { CurrentFocusDoc } from '@/types/domain'

const COLLECTION = 'currentFocus'

interface FocusStore {
  doc: CurrentFocusDoc | null
  hydrate: () => Promise<void>
  /** Point focus at an entity or day, persisting the singleton. */
  setFocus: (
    focusType: CurrentFocusDoc['focusType'],
    focusKey: string
  ) => Promise<void>
  /** Reset to the default (today's day) focus. */
  reset: () => Promise<void>
}

export const useFocus = create<FocusStore>(set => ({
  doc: null,
  hydrate: async () => {
    const doc =
      await requireStore().hydrateSingleton<CurrentFocusDoc>(COLLECTION)
    set({ doc })
  },
  setFocus: async (focusType, focusKey) => {
    const doc = stampLww(focusOn(focusType, focusKey))
    await requireStore().upsertEntity(COLLECTION, doc)
    set({ doc })
  },
  reset: async () => {
    const doc = stampLww(resetFocus())
    await requireStore().upsertEntity(COLLECTION, doc)
    set({ doc })
  }
}))
