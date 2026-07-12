/**
 * Process-wide storage access, re-exported from `@interop/was-react` with this
 * app's pinned deviceId prefix baked into {@link getDeviceId} so call sites
 * (domain constructors, form pages, entity actions) need no per-call config.
 */
import { getDeviceId as libGetDeviceId } from '@interop/was-react'
import { WAS_APP_CONFIG } from '@/app.config'

export {
  setLocalStore,
  requireStore,
  hasStore,
  clearLocalStore
} from '@interop/was-react'

/**
 * A stable per-install device id (the last-write-wins tiebreak stamped into
 * every payload), persisted in localStorage under the pinned `la:` prefix.
 */
export function getDeviceId(): string {
  return libGetDeviceId({ storageKeyPrefix: WAS_APP_CONFIG.storageKeyPrefix })
}
