/**
 * Dev-mode bootstrap: opens the one encrypted {@link LocalStore} from the dev
 * seed and hydrates all eight entity stores from it, then flips an `appReady`
 * flag the router's gate (`ProtectedRoute`) waits on. Idempotent -- concurrent
 * callers share one in-flight promise.
 *
 * Wallet mode does not use `initApp`; there the authStore owns the open/hydrate
 * ordering (seed from the wallet session) and reuses the same `useAppReady`
 * gate and {@link hydrateAll}.
 */
import { create } from 'zustand'
import { WAS_DEV_SYNC } from '@/app.config'
import { DEV_SEED } from '@/app-identity/agents'
import { LocalStore } from '@/stores/localStore'
import { setLocalStore, hasStore } from '@/stores/storageManager'
import { hydrateAll } from '@/stores/rehydrate'

interface AppReadyState {
  ready: boolean
  error: string | null
  setReady: () => void
  setError: (message: string) => void
  reset: () => void
}

export const useAppReady = create<AppReadyState>((set) => ({
  ready: false,
  error: null,
  setReady: () => set({ ready: true, error: null }),
  setError: (message) => set({ error: message }),
  reset: () => set({ ready: false, error: null })
}))

let inFlight: Promise<void> | null = null

/** Open the store (once) from the dev seed and hydrate every collection. */
export function initApp(): Promise<void> {
  if (inFlight) {
    return inFlight
  }
  inFlight = (async () => {
    try {
      if (!hasStore()) {
        const store = await LocalStore.init({ seed: DEV_SEED })
        setLocalStore(store)
      }
      await hydrateAll()
      useAppReady.getState().setReady()
      // Dev-sync: start WAS replication in the background AFTER the UI gate
      // opens, so a missing/unreachable server never blocks first paint. The
      // module is imported lazily to keep the RxDB replication machinery out of
      // the offline entry chunk.
      if (WAS_DEV_SYNC) {
        void import('@/stores/devSync')
          .then(({ startDevSync }) => startDevSync())
          .catch((err) => console.warn('Dev-sync failed to start:', err))
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      useAppReady.getState().setError(message)
      throw cause
    }
  })()
  return inFlight
}
