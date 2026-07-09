/**
 * The storage manager: a thin process-wide holder for the one {@link LocalStore}
 * instance plus the per-install device id. Entity stores reach for the store
 * through {@link requireStore} inside their CRUD actions rather than importing it
 * directly, which keeps this module free of store imports (no cycle) and lets
 * `bootstrap.ts` own the init/hydrate ordering.
 *
 * P1 is offline-only: the store is opened once from the hardcoded dev seed. P3
 * replaces {@link setLocalStore}'s caller with the unlocked wallet session.
 */
import { uuidv7 } from 'uuidv7'
import type { LocalStore } from '@/stores/localStore'

let localStore: LocalStore | null = null

/** Install the opened store (called once by the bootstrap). */
export function setLocalStore(store: LocalStore): void {
  localStore = store
}

/** The opened store, or throws if the app has not bootstrapped yet. */
export function requireStore(): LocalStore {
  if (!localStore) {
    throw new Error('LocalStore is not initialized; call initApp() first.')
  }
  return localStore
}

/** Whether the store has been opened. */
export function hasStore(): boolean {
  return localStore !== null
}

/** Releases the held store reference (logout; the caller closes the db). */
export function clearLocalStore(): void {
  localStore = null
}

const DEVICE_ID_KEY = 'la:deviceId'

/**
 * A stable per-install device id (the last-write-wins tiebreak stamped into
 * every payload), persisted in localStorage.
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = uuidv7()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}
