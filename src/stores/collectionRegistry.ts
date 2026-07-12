/**
 * The single collection-key to entity-store registry. Every per-collection flow
 * (hydrate, per-doc remote patch, logout clear, export) derives from this one
 * map instead of hand-maintaining a parallel roster, so adding a collection is a
 * single edit and the type checker rejects a missing or extra entry.
 *
 * The registry is typed as `Record<CollectionKey, CollectionEntry>`, keyed
 * against {@link LA_COLLECTIONS}: leaving a collection out (or adding one that
 * is not a real collection key) is a compile error. The seven list stores share
 * the generic {@link EntityStore} verbs; the `current-focus` singleton has a
 * different shape (a single held `doc`) and gets its own explicit entry rather
 * than being forced into the generic mold.
 */
import type { UseBoundStore, StoreApi } from 'zustand'
import {
  remotePayloadWins,
  type EntityStore,
  type StoreRegistryEntry
} from '@interop/was-react'
import type { CollectionKey } from '@/app.config'
import { useActionItems } from '@/stores/entities/actionItems'
import { useProjects } from '@/stores/entities/projects'
import { useGoals } from '@/stores/entities/goals'
import { useQuestions } from '@/stores/entities/questions'
import { useAnswers } from '@/stores/entities/answers'
import { useWebLinks } from '@/stores/entities/webLinks'
import { useThoughts } from '@/stores/entities/thoughts'
import { useFocus } from '@/stores/entities/focus'
import type { ExportDoc, ExportValue } from '@/lib/exportData'
import type { CurrentFocusDoc } from '@/types/domain'

/**
 * The per-collection operations shared by hydrate/patch/clear/export: the
 * library's `StoreRegistryEntry` contract (hydrate/upsert/drop/clear, driven
 * by the session and sync layers) plus the app's own `collect` verb, which
 * reads the live docs for export (an array for list stores, `null`/one doc for
 * the singleton).
 */
export interface CollectionEntry extends StoreRegistryEntry {
  /** Read the live docs for export. */
  collect: () => ExportValue
}

/**
 * Builds the entry for a generic list store. The `doc as T` narrows an
 * already-decrypted payload (the sync layer decrypted this collection's
 * envelope, so it is a `T`) to the store's doc type in one localized place.
 */
function listEntry<T extends ExportDoc>(
  store: UseBoundStore<StoreApi<EntityStore<T>>>
): CollectionEntry {
  return {
    hydrate: () => store.getState().hydrate(),
    clear: () => store.getState().replaceAll([]),
    upsert: doc => store.getState().patch(doc as T),
    drop: uuid => store.getState().drop(uuid),
    collect: () => [...store.getState().byId.values()]
  }
}

/** The current-focus singleton entry: a single held `doc`, not a Map. */
const focusEntry: CollectionEntry = {
  hydrate: () => useFocus.getState().hydrate(),
  clear: () => useFocus.setState({ doc: null }),
  upsert: doc =>
    useFocus.setState(state => {
      // Same LWW guard as the list stores' `patch`: an out-of-order or stale
      // remote singleton must not clobber a newer held doc.
      const incoming = doc as CurrentFocusDoc
      const current = state.doc
      if (current && !remotePayloadWins(incoming, current)) {
        return {}
      }
      return { doc: incoming }
    }),
  drop: () => useFocus.setState({ doc: null }),
  collect: () => useFocus.getState().doc
}

/**
 * The one registry every collection flow derives from. Typed against
 * {@link LA_COLLECTIONS} so a missing or extra collection key fails to compile.
 */
export const COLLECTION_REGISTRY: Record<CollectionKey, CollectionEntry> = {
  actionItems: listEntry(useActionItems),
  projects: listEntry(useProjects),
  goals: listEntry(useGoals),
  questions: listEntry(useQuestions),
  answers: listEntry(useAnswers),
  webLinks: listEntry(useWebLinks),
  thoughts: listEntry(useThoughts),
  currentFocus: focusEntry
}

/** Looks up the entry for a (possibly unknown) collection key from the sync layer. */
export function collectionEntry(key: string): CollectionEntry | undefined {
  return (COLLECTION_REGISTRY as Record<string, CollectionEntry | undefined>)[
    key
  ]
}
