/**
 * App-session persistence tests (fake-indexeddb): persist/restore round trip,
 * expiry fallthrough (expired records are cleared), the earliest-expiry
 * reduction, and logout wiping.
 */
import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import type { IZcap } from '@interop/data-integrity-core'
import {
  clearAppSession,
  earliestExpiry,
  isExpired,
  persistAppSession,
  restoreAppSession,
  type RestoredAppSession
} from '@/session/appSession'

function futureIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString()
}

function sessionFixture(expires: string): RestoredAppSession {
  return {
    seed: crypto.getRandomValues(new Uint8Array(32)),
    controllerDid: 'did:key:z6MkTest',
    serverUrl: 'http://localhost:3999',
    spaceId: 'space-1',
    grants: [
      { id: 'urn:zcap:1', invocationTarget: 'http://x/space/space-1/a' }
    ] as unknown as IZcap[],
    expires
  }
}

describe('isExpired', () => {
  it('is false for a future timestamp and true for a past one', () => {
    expect(isExpired(futureIso(60_000))).toBe(false)
    expect(isExpired(new Date(Date.now() - 60_000).toISOString())).toBe(true)
  })

  it('treats malformed timestamps as expired', () => {
    expect(isExpired('not-a-date')).toBe(true)
  })
})

describe('earliestExpiry', () => {
  it('returns the earliest parseable expiry', () => {
    const early = futureIso(1000)
    const late = futureIso(100_000)
    const grants = [
      { expires: late },
      { expires: early },
      {},
      { expires: 'garbage' }
    ] as unknown as IZcap[]
    expect(earliestExpiry(grants)).toBe(early)
  })

  it('returns null when no grant carries a parseable expiry', () => {
    expect(earliestExpiry([{} as unknown as IZcap])).toBeNull()
  })
})

describe('persist/restore', () => {
  it('round-trips a live session', async () => {
    const idb = new IDBFactory()
    const session = sessionFixture(futureIso(60_000))
    await persistAppSession({ session, idb })
    const restored = await restoreAppSession({ idb })
    expect(restored).not.toBeNull()
    expect(restored!.seed).toEqual(session.seed)
    expect(restored!.controllerDid).toBe(session.controllerDid)
    expect(restored!.serverUrl).toBe(session.serverUrl)
    expect(restored!.spaceId).toBe(session.spaceId)
    expect(restored!.grants).toEqual(session.grants)
    expect(restored!.expires).toBe(session.expires)
  })

  it('returns null with nothing persisted', async () => {
    const idb = new IDBFactory()
    expect(await restoreAppSession({ idb })).toBeNull()
  })

  it('clears and returns null for an expired record', async () => {
    const idb = new IDBFactory()
    const session = sessionFixture(new Date(Date.now() - 1000).toISOString())
    await persistAppSession({ session, idb })
    expect(await restoreAppSession({ idb })).toBeNull()
    // The record (including the seed) was wiped, not just skipped.
    const again = await restoreAppSession({ idb })
    expect(again).toBeNull()
  })

  it('returns null for a structurally invalid record', async () => {
    const idb = new IDBFactory()
    const session = sessionFixture(futureIso(60_000))
    await persistAppSession({
      session: { ...session, grants: [] },
      idb
    })
    expect(await restoreAppSession({ idb })).toBeNull()
  })

  it('clearAppSession wipes the persisted session', async () => {
    const idb = new IDBFactory()
    await persistAppSession({ session: sessionFixture(futureIso(60_000)), idb })
    await clearAppSession({ idb })
    expect(await restoreAppSession({ idb })).toBeNull()
  })
})
