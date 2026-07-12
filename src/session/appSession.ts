/**
 * The persisted app session: what a reload needs to restore the authenticated
 * state with ZERO wallet popups (modeled on freewallet's delegatedSession
 * restore path, adapted to the RP model where the seed itself is persisted --
 * the wallet remains the recovery source of truth, this is only the hot cache).
 *
 * Record: `{ seed, controllerDid, serverUrl, spaceId, grants, expires }`.
 * `expires` is the earliest `expires` across the granted zcaps; a record past
 * it is cleared on load and the caller falls through to the returning-login
 * flow (same seed comes back from the wallet, same DID, same vault keys).
 */
import type { IZcap } from '@interop/data-integrity-core'
import {
  loadRecord,
  loadSeed,
  saveRecord,
  saveSeed,
  clearSeedStore,
  clearSessionRecord
} from '@/app-identity/seedStore'

export interface AppSessionRecord {
  controllerDid: string
  serverUrl: string
  spaceId: string
  grants: IZcap[]
  /** ISO timestamp: the earliest expiry across the granted zcaps. */
  expires: string
}

/** A restored session: the record plus the separately persisted seed. */
export interface RestoredAppSession extends AppSessionRecord {
  seed: Uint8Array
}

/** Whether an ISO `expires` timestamp is in the past (or malformed). */
export function isExpired(expires: string, now: Date = new Date()): boolean {
  const at = new Date(expires).getTime()
  return Number.isNaN(at) || at <= now.getTime()
}

/**
 * Whether an ISO `expires` timestamp is within `thresholdMs` of now (or already
 * past, or malformed) -- the signal to surface the reconnect banner proactively,
 * before a live request fails with 401/403.
 */
export function isNearExpiry(
  expires: string,
  thresholdMs: number,
  now: Date = new Date()
): boolean {
  const at = new Date(expires).getTime()
  if (Number.isNaN(at)) {
    return true
  }
  return at - now.getTime() <= thresholdMs
}

/**
 * The earliest `expires` across a grant set. Grants without a parseable
 * `expires` are ignored; returns `null` when none carries one (callers treat
 * that as not restorable -- wallet grants always carry an expiry).
 */
export function earliestExpiry(grants: IZcap[]): string | null {
  let earliest: string | null = null
  for (const grant of grants) {
    const expires = (grant as { expires?: unknown }).expires
    if (typeof expires !== 'string') {
      continue
    }
    const at = new Date(expires).getTime()
    if (Number.isNaN(at)) {
      continue
    }
    if (earliest === null || at < new Date(earliest).getTime()) {
      earliest = expires
    }
  }
  return earliest
}

/** Persists the session (seed + record) for hot restore. */
export async function persistAppSession({
  session,
  idb
}: {
  session: RestoredAppSession
  idb?: IDBFactory
}): Promise<void> {
  const { seed, ...record } = session
  await saveSeed({ seed, ...(idb && { idb }) })
  await saveRecord({ record, ...(idb && { idb }) })
}

/**
 * Restores the persisted session, or returns `null` (clearing any stale state)
 * when it is missing, malformed, or expired.
 */
export async function restoreAppSession({
  idb
}: { idb?: IDBFactory } = {}): Promise<RestoredAppSession | null> {
  const [seed, stored] = await Promise.all([
    loadSeed({ ...(idb && { idb }) }),
    loadRecord({ ...(idb && { idb }) })
  ])
  const record = stored as AppSessionRecord | null
  if (
    !seed ||
    !record ||
    typeof record.controllerDid !== 'string' ||
    typeof record.serverUrl !== 'string' ||
    typeof record.spaceId !== 'string' ||
    !Array.isArray(record.grants) ||
    record.grants.length === 0 ||
    typeof record.expires !== 'string'
  ) {
    return null
  }
  if (isExpired(record.expires)) {
    // Clear only the stale session record; the seed survives grant expiry so a
    // reconnect can renew the grants in place against the same controller DID.
    await clearSessionRecord({ ...(idb && { idb }) })
    return null
  }
  return { seed, ...record }
}

/**
 * Loads just the persisted master seed, independently of session validity. A
 * reconnect uses this because the seed outlives grant expiry (only the grants
 * need renewing); returns `null` when no seed is persisted.
 */
export async function loadPersistedSeed({
  idb
}: { idb?: IDBFactory } = {}): Promise<Uint8Array | null> {
  return await loadSeed({ ...(idb && { idb }) })
}

/** Wipes the persisted session (seed + record). */
export async function clearAppSession({
  idb
}: { idb?: IDBFactory } = {}): Promise<void> {
  await clearSeedStore({ ...(idb && { idb }) })
}
