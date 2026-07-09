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
import type { ActionItemDoc } from '@/types/domain'

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
