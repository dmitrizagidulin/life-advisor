/**
 * Round-trip tests for the local encrypted store: real per-collection X25519
 * keys drive the was-client EDV codec end to end through RxDB (Dexie storage on
 * fake-indexeddb). Asserts create / list / in-place update (envelope id stable,
 * sequence advances) / delete, and that the at-rest row is ciphertext only.
 *
 * @vitest-environment node
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DEV_SEED } from '@/app-identity/agents'
import { LocalStore } from '@/stores/localStore'
import type { ActionItemDoc, CurrentFocusDoc } from '@/types/domain'

const COLLECTION = 'actionItems'

let dbCounter = 0
const openStores: LocalStore[] = []

async function openStore(dbName: string): Promise<LocalStore> {
  const store = await LocalStore.init({ seed: DEV_SEED, dbName })
  openStores.push(store)
  return store
}

function makeItem(name: string): ActionItemDoc {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    done: false,
    mywnCategory: 'someday',
    completedAt: null,
    area: 'admin',
    timeElapsed: 0,
    bumpCount: 0,
    createdAt: now,
    updatedAt: now,
    deviceId: 'device-a'
  }
}

/**
 * The single at-rest envelope in a collection, read raw (undecrypted).
 */
async function rawEnvelope(
  store: LocalStore
): Promise<{ id: string; sequence: number; jwe: unknown }> {
  const rows = await store.rxCollection(COLLECTION).find().exec()
  expect(rows).toHaveLength(1)
  return rows[0]!.toMutableJSON().data as unknown as {
    id: string
    sequence: number
    jwe: unknown
  }
}

afterEach(async () => {
  while (openStores.length > 0) {
    await openStores.pop()!.close()
  }
})

describe('LocalStore action-item CRUD', () => {
  it('round-trips insert / list and stores only ciphertext', async () => {
    const store = await openStore(`la-test-${++dbCounter}`)
    const item = makeItem('Buy distinctive-oat-milk-token')

    await store.insertEntity(COLLECTION, item)

    const listed = await store.listEntities<ActionItemDoc>(COLLECTION)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toEqual(item)

    const envelope = await rawEnvelope(store)
    expect(typeof envelope.jwe).toBe('object')
    expect(envelope.jwe).not.toBeNull()
    // No plaintext field value leaks into the stored row.
    expect(JSON.stringify(envelope)).not.toContain('distinctive-oat-milk-token')
    expect(JSON.stringify(envelope)).not.toContain('someday')
  })

  it('re-encrypts in place: same envelope id, advancing sequence', async () => {
    const store = await openStore(`la-test-${++dbCounter}`)
    const item = makeItem('First name')
    await store.insertEntity(COLLECTION, item)

    const before = await rawEnvelope(store)

    const updated: ActionItemDoc = {
      ...item,
      name: 'Second name',
      done: true,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await store.updateEntity(COLLECTION, updated)

    const after = await rawEnvelope(store)
    // Same physical envelope (stable random EDV id), advanced sequence.
    expect(after.id).toBe(before.id)
    expect(after.sequence).toBeGreaterThan(before.sequence)

    const listed = await store.listEntities<ActionItemDoc>(COLLECTION)
    expect(listed).toHaveLength(1)
    expect(listed[0]!.name).toBe('Second name')
    expect(listed[0]!.done).toBe(true)
  })

  it('tombstones on delete', async () => {
    const store = await openStore(`la-test-${++dbCounter}`)
    const item = makeItem('Ephemeral')
    await store.insertEntity(COLLECTION, item)
    expect(await store.listEntities<ActionItemDoc>(COLLECTION)).toHaveLength(1)

    await store.deleteEntity(COLLECTION, item.id)

    expect(await store.listEntities<ActionItemDoc>(COLLECTION)).toHaveLength(0)
    const rows = await store.rxCollection(COLLECTION).find().exec()
    expect(rows).toHaveLength(0)
  })

  it('upserts: inserts once then updates in place under a stable envelope', async () => {
    const store = await openStore(`la-test-${++dbCounter}`)
    const item = makeItem('Upserted')
    // Hydrate first so the index exists (the singleton store hydrates before it
    // ever writes).
    await store.listEntities<ActionItemDoc>(COLLECTION)

    await store.upsertEntity(COLLECTION, item)
    const first = await rawEnvelope(store)

    const edited: ActionItemDoc = { ...item, name: 'Upserted again' }
    await store.upsertEntity(COLLECTION, edited)
    const second = await rawEnvelope(store)

    // One row, same envelope id (update, not a second insert).
    expect(second.id).toBe(first.id)
    expect(second.sequence).toBeGreaterThan(first.sequence)
    const listed = await store.listEntities<ActionItemDoc>(COLLECTION)
    expect(listed).toHaveLength(1)
    expect(listed[0]!.name).toBe('Upserted again')
  })

  it('resurrects as a create when the envelope was deleted elsewhere', async () => {
    const store = await openStore(`la-test-${++dbCounter}`)
    const item = makeItem('Edited after remote delete')
    await store.insertEntity(COLLECTION, item)
    const original = await rawEnvelope(store)

    // Simulate a remote tombstone being pulled: the row is removed and the
    // uuid forgotten from the index (what forgetEnvelope + drop do).
    await store.deleteEntity(COLLECTION, item.id)
    expect(await store.listEntities<ActionItemDoc>(COLLECTION)).toHaveLength(0)

    // A concurrent local edit must not throw; it resurrects the entity.
    const edited: ActionItemDoc = {
      ...item,
      name: 'Resurrected',
      updatedAt: new Date().toISOString()
    }
    await store.updateEntity(COLLECTION, edited)

    const listed = await store.listEntities<ActionItemDoc>(COLLECTION)
    expect(listed).toHaveLength(1)
    expect(listed[0]!.name).toBe('Resurrected')
    // A fresh envelope was minted (the old one is gone).
    const resurrected = await rawEnvelope(store)
    expect(resurrected.id).not.toBe(original.id)
  })

  it('persists across a store reopen (survives reload)', async () => {
    const dbName = `la-test-${++dbCounter}`
    const store = await openStore(dbName)
    const item = makeItem('Durable item')
    await store.insertEntity(COLLECTION, item)
    await store.close()
    openStores.pop()

    const reopened = await openStore(dbName)
    const listed = await reopened.listEntities<ActionItemDoc>(COLLECTION)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toEqual(item)
  })
})

const FOCUS = 'currentFocus'

function makeFocus(
  over: Partial<CurrentFocusDoc> & Pick<CurrentFocusDoc, 'updatedAt' | 'deviceId'>
): CurrentFocusDoc {
  return {
    id: '_current_focus',
    focusType: 'day',
    focusKey: 'today',
    createdAt: over.updatedAt,
    ...over
  }
}

describe('LocalStore singleton hydration', () => {
  it('returns null and an empty collection when nothing is stored', async () => {
    const store = await openStore(`la-test-${++dbCounter}`)
    expect(await store.hydrateSingleton<CurrentFocusDoc>(FOCUS)).toBeNull()
  })

  it('reconciles duplicate singletons to the LWW winner and tombstones the rest', async () => {
    const store = await openStore(`la-test-${++dbCounter}`)
    // Two devices each created the singleton before syncing: distinct envelope
    // rows that both decrypt to `_current_focus`.
    const older = makeFocus({
      focusType: 'project',
      focusKey: 'proj-old',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deviceId: 'device-a'
    })
    const newer = makeFocus({
      focusType: 'goal',
      focusKey: 'goal-new',
      updatedAt: '2026-02-02T00:00:00.000Z',
      deviceId: 'device-b'
    })
    await store.insertEntity(FOCUS, older)
    await store.insertEntity(FOCUS, newer)
    // Two physical rows, one logical id.
    expect(await store.rxCollection(FOCUS).find().exec()).toHaveLength(2)

    const winner = await store.hydrateSingleton<CurrentFocusDoc>(FOCUS)
    expect(winner).toEqual(newer)
    // The loser row is tombstoned, so exactly one live row remains.
    expect(await store.rxCollection(FOCUS).find().exec()).toHaveLength(1)

    // A subsequent write routes as an in-place update on the surviving row (no
    // third envelope is minted).
    const moved: CurrentFocusDoc = { ...newer, focusKey: 'goal-moved' }
    await store.upsertEntity(FOCUS, moved)
    expect(await store.rxCollection(FOCUS).find().exec()).toHaveLength(1)
    const listed = await store.listEntities<CurrentFocusDoc>(FOCUS)
    expect(listed).toHaveLength(1)
    expect(listed[0]!.focusKey).toBe('goal-moved')
  })

  it('maps the logical id to the surviving envelope after reconciliation', async () => {
    const store = await openStore(`la-test-${++dbCounter}`)
    const older = makeFocus({
      focusKey: 'old',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deviceId: 'device-a'
    })
    const newer = makeFocus({
      focusKey: 'new',
      updatedAt: '2026-02-02T00:00:00.000Z',
      deviceId: 'device-b'
    })
    await store.insertEntity(FOCUS, older)
    await store.insertEntity(FOCUS, newer)

    await store.hydrateSingleton<CurrentFocusDoc>(FOCUS)
    // The index points at the one live row, so a tombstone for any OTHER
    // (reconciled-away) envelope can be told apart from a real deletion.
    const rows = await store.rxCollection(FOCUS).find().exec()
    expect(rows).toHaveLength(1)
    expect(store.envelopeIdFor(FOCUS, newer.id)).toBe(rows[0]!.id)
  })

  it('breaks an updatedAt tie by the greater deviceId', async () => {
    const store = await openStore(`la-test-${++dbCounter}`)
    const at = '2026-03-03T00:00:00.000Z'
    await store.insertEntity(
      FOCUS,
      makeFocus({ focusKey: 'a', updatedAt: at, deviceId: 'device-a' })
    )
    await store.insertEntity(
      FOCUS,
      makeFocus({ focusKey: 'z', updatedAt: at, deviceId: 'device-z' })
    )

    const winner = await store.hydrateSingleton<CurrentFocusDoc>(FOCUS)
    expect(winner!.deviceId).toBe('device-z')
    expect(await store.rxCollection(FOCUS).find().exec()).toHaveLength(1)
  })
})
