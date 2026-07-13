/**
 * Dev-mode bootstrap: opens the one encrypted {@link LocalStore} from the dev
 * seed and hydrates all eight entity stores from it, then flips the library's
 * `useAppReady` flag the router's gate (`ProtectedRoute`) waits on. Idempotent
 * -- concurrent callers share one in-flight promise.
 *
 * Wallet mode does not use `initApp`; there the library's auth store owns the
 * open/hydrate ordering (seed from the wallet session) and the same
 * `useAppReady` gate.
 */
import {
  LocalStore,
  setLocalStore,
  hasStore,
  hydrateAll,
  useAppReady
} from '@interop/was-react'
import { WAS_APP_CONFIG, WAS_DEV_SYNC } from '@/app.config'
import { DEV_SEED } from '@/stores/devSeed'
import { COLLECTION_REGISTRY } from '@/stores/collectionRegistry'

let inFlight: Promise<void> | null = null

/** Open the store (once) from the dev seed and hydrate every collection. */
export function initApp(): Promise<void> {
  if (inFlight) {
    return inFlight
  }
  inFlight = (async () => {
    try {
      if (!hasStore()) {
        const store = await LocalStore.init({
          seed: DEV_SEED,
          collections: WAS_APP_CONFIG.collections,
          dbName: WAS_APP_CONFIG.dbName
        })
        setLocalStore(store)
      }
      await hydrateAll(COLLECTION_REGISTRY)
      useAppReady.getState().setReady()
      // Dev-sync: start WAS replication in the background AFTER the UI gate
      // opens, so a missing/unreachable server never blocks first paint. The
      // module is imported lazily to keep the RxDB replication machinery out of
      // the offline entry chunk.
      if (WAS_DEV_SYNC) {
        void import('@/stores/devSync')
          .then(({ startDevSync }) => startDevSync())
          .catch(err => console.warn('Dev-sync failed to start:', err))
      }
    } catch (cause) {
      // Un-cache the failed attempt so a retry (StrictMode remount, user
      // reload of the route) re-runs init instead of getting the same
      // rejected promise back forever.
      inFlight = null
      const message = cause instanceof Error ? cause.message : String(cause)
      useAppReady.getState().setError(message)
      throw cause
    }
  })()
  return inFlight
}
