/**
 * A generic zustand store over one localStore collection. Holds the decrypted
 * payloads as a `Map<uuid, Doc>` and exposes the CRUD verbs that (1) persist
 * through the encrypted {@link LocalStore} and (2) patch the in-memory Map. UI
 * reads through selectors and applies the pure `domain/*` comparators/filters;
 * this layer stays domain-agnostic so every entity shares it.
 *
 * Reactivity note: local writes patch the Map optimistically after the localStore
 * write resolves. Pulled remote changes are applied per-doc by the sync layer
 * through `patch` / `drop` (no whole-collection re-hydrate), keeping multi-device
 * edits and tombstones live without re-hydrate storms.
 */
import { create, type UseBoundStore, type StoreApi } from 'zustand'
import { requireStore } from '@/stores/storageManager'
import { remotePayloadWins } from '@/domain/lww'

/**
 * Reads the last-write-wins fields off a decrypted payload, or `null` when they
 * are absent (a payload shape without domain timestamps). Kept local so the
 * generic store stays domain-agnostic while still honouring LWW on remote patches.
 */
function lwwFields(
  doc: unknown
): { updatedAt: string; deviceId: string } | null {
  const candidate = doc as { updatedAt?: unknown; deviceId?: unknown }
  if (
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.deviceId === 'string'
  ) {
    return { updatedAt: candidate.updatedAt, deviceId: candidate.deviceId }
  }
  return null
}

export interface EntityStore<T extends { id: string }> {
  /** Decrypted payloads keyed by logical uuid. */
  byId: Map<string, T>
  /** Decrypt every live row of the collection into the Map. */
  hydrate: () => Promise<void>
  /** Encrypt+insert a new doc, then add it to the Map. */
  insert: (doc: T) => Promise<void>
  /** Re-encrypt a doc in place (sequence+1), then replace it in the Map. */
  update: (doc: T) => Promise<void>
  /** Tombstone a doc, then drop it from the Map. */
  remove: (uuid: string) => Promise<void>
  /** Replace the whole Map (used by hydrate and, later, the sync stream). */
  replaceAll: (docs: T[]) => void
  /**
   * Upsert one already-decrypted doc into the Map WITHOUT persisting (the sync
   * stream owns the persisted row already). Used for per-doc reactive patching
   * of pulled/conflict-resolved remote changes. Guarded by last-write-wins: an
   * incoming payload OLDER than the one already held is dropped, so two remote
   * change events that decrypt out of order (or a remote echo racing a newer
   * optimistic local edit) cannot overwrite a newer value with a stale one.
   */
  patch: (doc: T) => void
  /** Drop one doc from the Map WITHOUT persisting (remote tombstone patch). */
  drop: (uuid: string) => void
}

/**
 * Builds a zustand hook for the collection whose localStore key is `collectionKey`.
 */
export function createEntityStore<T extends { id: string }>(
  collectionKey: string
): UseBoundStore<StoreApi<EntityStore<T>>> {
  return create<EntityStore<T>>((set) => ({
    byId: new Map<string, T>(),
    hydrate: async () => {
      const docs = await requireStore().listEntities<T>(collectionKey)
      set({ byId: new Map(docs.map((d) => [d.id, d])) })
    },
    insert: async (doc) => {
      await requireStore().insertEntity(collectionKey, doc)
      set((state) => {
        const byId = new Map(state.byId)
        byId.set(doc.id, doc)
        return { byId }
      })
    },
    update: async (doc) => {
      await requireStore().updateEntity(collectionKey, doc)
      set((state) => {
        const byId = new Map(state.byId)
        byId.set(doc.id, doc)
        return { byId }
      })
    },
    remove: async (uuid) => {
      await requireStore().deleteEntity(collectionKey, uuid)
      set((state) => {
        const byId = new Map(state.byId)
        byId.delete(uuid)
        return { byId }
      })
    },
    replaceAll: (docs) => {
      set({ byId: new Map(docs.map((d) => [d.id, d])) })
    },
    patch: (doc) => {
      set((state) => {
        const stored = state.byId.get(doc.id)
        // LWW guard: only apply the incoming payload when it wins over the one
        // already held (or when either side lacks comparable timestamps). An
        // exact tie is a no-op replace of identical data, so skipping it is safe.
        if (stored !== undefined) {
          const incoming = lwwFields(doc)
          const current = lwwFields(stored)
          if (incoming && current && !remotePayloadWins(incoming, current)) {
            return state
          }
        }
        const byId = new Map(state.byId)
        byId.set(doc.id, doc)
        return { byId }
      })
    },
    drop: (uuid) => {
      set((state) => {
        if (!state.byId.has(uuid)) {
          return state
        }
        const byId = new Map(state.byId)
        byId.delete(uuid)
        return { byId }
      })
    }
  }))
}
