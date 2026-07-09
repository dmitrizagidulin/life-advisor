/**
 * Current-focus store: a singleton doc with the fixed logical id `_current_focus`
 * (see `domain/focus.ts`). Unlike the other collections there is at most one row,
 * so the store holds a single `doc` and tracks whether it has ever been persisted
 * (to choose insert vs the in-place update path).
 */
import { create } from 'zustand'
import { requireStore, getDeviceId } from '@/stores/storageManager'
import { focusOn, resetFocus } from '@/domain/focus'
import type { CurrentFocusDoc } from '@/types/domain'

const COLLECTION = 'currentFocus'

interface FocusStore {
  doc: CurrentFocusDoc | null
  hydrated: boolean
  /** Whether a focus row already exists in the store (insert vs update). */
  exists: boolean
  hydrate: () => Promise<void>
  /** Point focus at an entity or day, persisting the singleton. */
  setFocus: (
    focusType: CurrentFocusDoc['focusType'],
    focusKey: string
  ) => Promise<void>
  /** Reset to the default (today's day) focus. */
  reset: () => Promise<void>
}

async function persist(doc: CurrentFocusDoc, exists: boolean): Promise<void> {
  const store = requireStore()
  if (exists) {
    await store.updateEntity(COLLECTION, doc)
  } else {
    await store.insertEntity(COLLECTION, doc)
  }
}

export const useFocus = create<FocusStore>((set, get) => ({
  doc: null,
  hydrated: false,
  exists: false,
  hydrate: async () => {
    const docs =
      await requireStore().listEntities<CurrentFocusDoc>(COLLECTION)
    const doc = docs[0] ?? null
    set({ doc, exists: doc !== null, hydrated: true })
  },
  setFocus: async (focusType, focusKey) => {
    const doc = focusOn(focusType, focusKey, getDeviceId())
    await persist(doc, get().exists)
    set({ doc, exists: true })
  },
  reset: async () => {
    const doc = resetFocus(getDeviceId())
    await persist(doc, get().exists)
    set({ doc, exists: true })
  }
}))
