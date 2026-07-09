/**
 * Shared hydration plumbing: the per-collection re-hydrate hooks (decrypt the
 * localStore rows into the zustand entity stores) plus the debounced
 * remote-change scheduler used by every sync entry point (dev-sync and the
 * wallet session).
 */
import type { Json } from '@/lib/sync'
import { requireStore } from '@/stores/storageManager'
import { useActionItems } from '@/stores/entities/actionItems'
import { useProjects } from '@/stores/entities/projects'
import { useGoals } from '@/stores/entities/goals'
import { useQuestions } from '@/stores/entities/questions'
import { useAnswers } from '@/stores/entities/answers'
import { useWebLinks } from '@/stores/entities/webLinks'
import { useThoughts } from '@/stores/entities/thoughts'
import { useFocus } from '@/stores/entities/focus'
import type { CurrentFocusDoc } from '@/types/domain'

/** Re-hydrate hooks keyed by localStore/RxDB collection key. */
export const HYDRATORS: Record<string, () => Promise<void>> = {
  actionItems: () => useActionItems.getState().hydrate(),
  projects: () => useProjects.getState().hydrate(),
  goals: () => useGoals.getState().hydrate(),
  questions: () => useQuestions.getState().hydrate(),
  answers: () => useAnswers.getState().hydrate(),
  webLinks: () => useWebLinks.getState().hydrate(),
  thoughts: () => useThoughts.getState().hydrate(),
  currentFocus: () => useFocus.getState().hydrate()
}

/** Hydrates every entity store from the (already opened) localStore. */
export async function hydrateAll(): Promise<void> {
  await Promise.all(Object.values(HYDRATORS).map((hydrate) => hydrate()))
}

/** Empties every entity store (logout). */
export function clearAllEntityStores(): void {
  useActionItems.getState().replaceAll([])
  useProjects.getState().replaceAll([])
  useGoals.getState().replaceAll([])
  useQuestions.getState().replaceAll([])
  useAnswers.getState().replaceAll([])
  useWebLinks.getState().replaceAll([])
  useThoughts.getState().replaceAll([])
  useFocus.setState({ doc: null, exists: false, hydrated: false })
}

/**
 * Per-collection per-doc patchers: `upsert` an already-decrypted payload into
 * the store, `drop` one by uuid. The seven list stores share the generic
 * entity-store verbs; the current-focus singleton patches its own shape.
 */
const PATCHERS: Record<
  string,
  { upsert: (doc: { id: string }) => void; drop: (uuid: string) => void }
> = {
  actionItems: {
    upsert: (d) => useActionItems.getState().patch(d as never),
    drop: (id) => useActionItems.getState().drop(id)
  },
  projects: {
    upsert: (d) => useProjects.getState().patch(d as never),
    drop: (id) => useProjects.getState().drop(id)
  },
  goals: {
    upsert: (d) => useGoals.getState().patch(d as never),
    drop: (id) => useGoals.getState().drop(id)
  },
  questions: {
    upsert: (d) => useQuestions.getState().patch(d as never),
    drop: (id) => useQuestions.getState().drop(id)
  },
  answers: {
    upsert: (d) => useAnswers.getState().patch(d as never),
    drop: (id) => useAnswers.getState().drop(id)
  },
  webLinks: {
    upsert: (d) => useWebLinks.getState().patch(d as never),
    drop: (id) => useWebLinks.getState().drop(id)
  },
  thoughts: {
    upsert: (d) => useThoughts.getState().patch(d as never),
    drop: (id) => useThoughts.getState().drop(id)
  },
  currentFocus: {
    upsert: (d) =>
      useFocus.setState({
        doc: d as CurrentFocusDoc,
        exists: true,
        hydrated: true
      }),
    drop: () => useFocus.setState({ doc: null, exists: false })
  }
}

/**
 * Patches ONE store from a single RxDB change event (per-doc, no whole-collection
 * re-hydrate): decrypt the changed envelope, then upsert the payload (INSERT /
 * UPDATE, including conflict-resolved rows) or drop it (DELETE / tombstone). The
 * `uuid -> envelopeId` index is kept in step so a later local edit of a
 * remotely-created doc still finds its envelope. Falls back to a debounced
 * whole-collection re-hydrate if the envelope is missing or fails to decrypt.
 *
 * @param collectionKey {string}
 * @param event {object}   an RxDB change event (operation + documentData)
 * @returns {Promise<void>}
 */
export async function patchFromChange(
  collectionKey: string,
  event: {
    operation: string
    documentData?: { id: string; data?: Json; _deleted?: boolean }
  }
): Promise<void> {
  const patcher = PATCHERS[collectionKey]
  if (!patcher) {
    return
  }
  const row = event.documentData
  const envelope = row?.data
  const deleted = event.operation === 'DELETE' || row?._deleted === true
  if (!row || envelope === undefined) {
    scheduleRehydrate(collectionKey)
    return
  }
  let payload: { id: string }
  try {
    payload = await requireStore().decryptEnvelope<{ id: string }>(
      collectionKey,
      envelope
    )
  } catch {
    scheduleRehydrate(collectionKey)
    return
  }
  if (deleted) {
    requireStore().forgetEnvelope(collectionKey, payload.id)
    patcher.drop(payload.id)
  } else {
    requireStore().rememberEnvelope(collectionKey, payload.id, row.id)
    patcher.upsert(payload)
  }
}

/** Per-collection debounce timers coalescing a pull burst into one hydrate. */
const rehydrateTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Schedules a debounced re-hydrate of one collection's store after a pull.
 *
 * @param collectionKey {string}
 * @returns {void}
 */
export function scheduleRehydrate(collectionKey: string): void {
  const hydrate = HYDRATORS[collectionKey]
  if (!hydrate) {
    return
  }
  const existing = rehydrateTimers.get(collectionKey)
  if (existing) {
    clearTimeout(existing)
  }
  rehydrateTimers.set(
    collectionKey,
    setTimeout(() => {
      rehydrateTimers.delete(collectionKey)
      void hydrate()
    }, 50)
  )
}
