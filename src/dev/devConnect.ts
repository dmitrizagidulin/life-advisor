/**
 * Dev-connect (CHAPI bypassed): fetches a locally provisioned grants file and
 * drives the session store's `connectWithGrants` path with the fixed dev seed,
 * landing the `connected` state (the same connected-state sync path a wallet
 * login drives). Like a wallet login, `connectWithGrants` defaults to adopting
 * (`adopt: 'merge'`), so any data in the anonymous `local` replica is merged
 * into the connected replica on connect. This stands in for Login With Wallet:
 * there the grants arrive over CHAPI; here they are minted by
 * `pnpm run provision:dev` against a running was-teaching-server.
 */
import type { IZcap, WasAuthStore } from '@interop/was-react'
import { WAS_DEV_GRANTS_URL } from '@/app.config'
import { DEV_SEED } from '@/dev/devSeed'

/**
 * Fetches and parses the dev grants file. Returns `null` (with a warning) when
 * it is missing or malformed, so a not-yet-provisioned dev environment degrades
 * to local-only rather than erroring.
 */
async function loadDevGrants(): Promise<IZcap[] | null> {
  try {
    const response = await fetch(WAS_DEV_GRANTS_URL, { cache: 'no-store' })
    if (!response.ok) {
      console.warn(
        `Dev grants not available at "${WAS_DEV_GRANTS_URL}" (status ${response.status}); running local-only.`
      )
      return null
    }
    const body = (await response.json()) as { grants?: IZcap[] } | IZcap[]
    const grants = Array.isArray(body) ? body : body.grants
    if (!grants || grants.length === 0) {
      console.warn('Dev grants file has no grants; running local-only.')
      return null
    }
    return grants
  } catch (err) {
    console.warn('Failed to load dev grants; running local-only.', err)
    return null
  }
}

let started = false

/**
 * Loads the provisioned grants (once) and connects the store under the dev
 * seed. Idempotent and best-effort -- any failure leaves the app in local mode.
 * The `started` claim happens BEFORE the first await: StrictMode double-runs
 * the driving effect, and two concurrent `connectWithGrants` calls race RxDB's
 * collection creation on the same connected database (error COL23).
 */
export async function runDevConnect(store: WasAuthStore): Promise<void> {
  if (started) {
    return
  }
  started = true
  try {
    const grants = await loadDevGrants()
    if (!grants) {
      started = false
      return
    }
    await store.getState().connectWithGrants({ seed: DEV_SEED, grants })
  } catch (cause) {
    started = false
    throw cause
  }
}
