/**
 * The wallet-mode auth store (zustand, adapted from freewallet's authStore):
 * owns the session lifecycle -- hot restore (zero popups), Login With Wallet,
 * logout, and the expired-access reconnect -- and the open/hydrate ordering
 * that dev mode's `initApp` owns.
 *
 * On a successful login/restore it opens the encrypted {@link LocalStore} from
 * the session seed (a per-controller database name, so two wallet users on one
 * browser never collide), hydrates the entity stores, flips the shared
 * `useAppReady` gate, and starts WAS replication from the granted zcaps.
 *
 * `restoreStatus` is the router gate: `ProtectedRoute` waits for the restore
 * attempt to settle before deciding between the app and the login page.
 */
import { create } from 'zustand'
import { WAS_SERVER_URL } from '@/app.config'
import type { IZcap } from '@interop/data-integrity-core'
import { initAppSession } from '@/app-identity/initAppSession'
import type { IdentityAgents } from '@/app-identity/agents'
import {
  loginWithWallet,
  requestGrants,
  LoginCancelledError,
  type LoginPhase
} from '@/auth/loginFlow'
import {
  clearAppSession,
  persistAppSession,
  restoreAppSession,
  isNearExpiry
} from '@/session/appSession'
import { parseGrants, type ParsedGrants } from '@/stores/grants'
import { LocalStore } from '@/stores/localStore'
import {
  clearLocalStore,
  hasStore,
  requireStore,
  setLocalStore
} from '@/stores/storageManager'
import { clearAllEntityStores, hydrateAll } from '@/stores/rehydrate'
import { startWasSync } from '@/stores/wasSync'
import { syncController } from '@/stores/syncController'
import { useAppReady } from '@/stores/bootstrap'
import { useSyncStatusStore } from '@/stores/syncStatusStore'

export type AuthStatus =
  | 'idle'
  | 'restoring'
  | 'unauthenticated'
  | 'authenticating'
  | 'authenticated'

interface ActiveSession {
  seed: Uint8Array
  identity: IdentityAgents
  parsed: ParsedGrants
  grants: IZcap[]
  expires: string
}

interface AuthState {
  status: AuthStatus
  /** The current login phase, for the login page's progress line. */
  phase: LoginPhase | null
  error: string | null
  controllerDid: string | null
  /** ISO expiry of the current grant set (earliest zcap expiry). */
  expires: string | null
  /** A live 401/403 was seen mid-session: show the reconnect banner. */
  accessExpired: boolean
  reconnecting: boolean
  /** Hot restore from the persisted session; falls to `unauthenticated`. */
  restore: () => Promise<void>
  /** Full Login With Wallet (first-run or returning). */
  login: () => Promise<void>
  /** Re-run the grants flow with the existing seed (expired access). */
  reconnect: () => Promise<void>
  logout: () => Promise<void>
  notifyAccessExpired: () => void
}

/**
 * How close to grant expiry the reconnect banner is raised proactively (so the
 * user re-grants before a live request fails). Wallet grants default to a 30-day
 * TTL, so a one-hour lead time never fires spuriously mid-session.
 */
const EXPIRY_WARNING_MS = 60 * 60 * 1000

/** Poll interval for the near-expiry watch (grant expiry is coarse-grained). */
const EXPIRY_WATCH_MS = 60 * 1000

let expiryTimer: ReturnType<typeof setInterval> | undefined

/** Stops the near-expiry watch (logout / re-grant). */
function disarmExpiryWatch(): void {
  if (expiryTimer) {
    clearInterval(expiryTimer)
    expiryTimer = undefined
  }
}

/**
 * Watches the session's earliest grant expiry and raises the reconnect banner
 * once it is within {@link EXPIRY_WARNING_MS} (or already past). Checks
 * immediately, then on a coarse interval; re-armed with the fresh expiry after a
 * successful reconnect.
 */
function armExpiryWatch(expires: string): void {
  disarmExpiryWatch()
  const check = () => {
    if (isNearExpiry(expires, EXPIRY_WARNING_MS)) {
      useAuthStore.getState().notifyAccessExpired()
    }
  }
  check()
  expiryTimer = setInterval(check, EXPIRY_WATCH_MS)
}

/** A stable, RxDB-safe database name per controller DID (FNV-1a hex). */
export function dbNameForController(controllerDid: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < controllerDid.length; i++) {
    hash ^= controllerDid.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `life-advisor-${hash.toString(16).padStart(8, '0')}`
}

/**
 * Opens storage + hydrates + starts sync for a validated session, persists it,
 * and flips the ready gate. Shared by login and restore.
 */
async function activateSession(session: ActiveSession): Promise<void> {
  if (!hasStore()) {
    const store = await LocalStore.init({
      seed: session.seed,
      dbName: dbNameForController(session.identity.controllerDid)
    })
    setLocalStore(store)
  }
  await hydrateAll()
  useAppReady.getState().setReady()

  await persistAppSession({
    session: {
      seed: session.seed,
      controllerDid: session.identity.controllerDid,
      serverUrl: session.parsed.serverUrl,
      spaceId: session.parsed.spaceId,
      grants: session.grants,
      expires: session.expires
    }
  })

  // Replication starts in the background; a down server never blocks entry.
  void startWasSync({
    parsed: session.parsed,
    zcapClient: session.identity.zcapClient,
    onAuthError: () => useAuthStore.getState().notifyAccessExpired()
  }).catch((err) => console.warn('WAS sync failed to start:', err))

  armExpiryWatch(session.expires)
}

/** Tears down storage + sync + entity stores (logout and re-login paths). */
async function deactivateSession(): Promise<void> {
  disarmExpiryWatch()
  await syncController.stop()
  if (hasStore()) {
    try {
      await requireStore().close()
    } catch (err) {
      console.warn('Error closing the local store:', err)
    }
    clearLocalStore()
  }
  clearAllEntityStores()
  useSyncStatusStore.getState().reset()
  useAppReady.getState().reset()
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'idle',
  phase: null,
  error: null,
  controllerDid: null,
  expires: null,
  accessExpired: false,
  reconnecting: false,

  restore: async () => {
    if (get().status !== 'idle') {
      return
    }
    set({ status: 'restoring' })
    try {
      const restored = await restoreAppSession()
      if (!restored) {
        set({ status: 'unauthenticated' })
        return
      }
      const identity = await initAppSession({ seed: restored.seed })
      if (identity.controllerDid !== restored.controllerDid) {
        // A corrupt record; treat as logged out.
        await clearAppSession()
        set({ status: 'unauthenticated' })
        return
      }
      const parsed = parseGrants(restored.grants)
      if (WAS_SERVER_URL !== undefined && parsed.serverUrl !== WAS_SERVER_URL) {
        await clearAppSession()
        set({ status: 'unauthenticated' })
        return
      }
      await activateSession({
        seed: restored.seed,
        identity,
        parsed,
        grants: restored.grants,
        expires: restored.expires
      })
      set({
        status: 'authenticated',
        controllerDid: identity.controllerDid,
        expires: restored.expires,
        error: null
      })
    } catch (err) {
      console.warn('Session restore failed:', err)
      set({ status: 'unauthenticated' })
    }
  },

  login: async () => {
    const { status } = get()
    if (status === 'authenticating' || status === 'authenticated') {
      return
    }
    set({ status: 'authenticating', error: null, phase: 'probing' })
    try {
      const outcome = await loginWithWallet({
        onPhase: (phase) => set({ phase })
      })
      await activateSession({
        seed: outcome.seed,
        identity: outcome.identity,
        parsed: outcome.parsed,
        grants: outcome.grants,
        expires: outcome.expires
      })
      set({
        status: 'authenticated',
        controllerDid: outcome.identity.controllerDid,
        expires: outcome.expires,
        phase: null,
        error: null,
        accessExpired: false
      })
    } catch (err) {
      const message =
        err instanceof LoginCancelledError
          ? err.message
          : err instanceof Error
            ? `Login failed: ${err.message}`
            : 'Login failed.'
      set({ status: 'unauthenticated', phase: null, error: message })
    }
  },

  reconnect: async () => {
    const { reconnecting, status } = get()
    if (reconnecting || status !== 'authenticated') {
      return
    }
    set({ reconnecting: true, error: null })
    try {
      const restored = await restoreAppSession()
      // The seed survives grant expiry; only the grants need renewing. A
      // missing seed means the session is unrecoverable in place.
      const seed = restored?.seed
      if (!seed) {
        await get().logout()
        return
      }
      const identity = await initAppSession({ seed })
      const checked = await requestGrants({ identity })
      await syncController.stop()
      await persistAppSession({
        session: {
          seed,
          controllerDid: identity.controllerDid,
          serverUrl: checked.parsed.serverUrl,
          spaceId: checked.parsed.spaceId,
          grants: checked.grants,
          expires: checked.expires
        }
      })
      void startWasSync({
        parsed: checked.parsed,
        zcapClient: identity.zcapClient,
        onAuthError: () => useAuthStore.getState().notifyAccessExpired()
      }).catch((err) => console.warn('WAS sync failed to restart:', err))
      armExpiryWatch(checked.expires)
      set({
        accessExpired: false,
        expires: checked.expires,
        reconnecting: false
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Reconnect failed.'
      set({ reconnecting: false, error: message })
    }
  },

  logout: async () => {
    await deactivateSession()
    await clearAppSession()
    set({
      status: 'unauthenticated',
      phase: null,
      error: null,
      controllerDid: null,
      expires: null,
      accessExpired: false,
      reconnecting: false
    })
  },

  notifyAccessExpired: () => {
    if (!get().accessExpired) {
      set({ accessExpired: true })
    }
  }
}))
