/**
 * Seed persistence: the master seed at rest in the app's own IndexedDB, so a
 * reload restores the session with zero wallet popups. Modeled on freewallet's
 * `src/lib/sessionKey.ts` raw-IndexedDB pattern (one db, one object store,
 * fixed record keys, `db.close()` after every operation). Wiped on logout.
 *
 * The `idb` parameter is injectable for tests (fake-indexeddb).
 */
const SESSION_DB_NAME = 'life-advisor-session'
const SESSION_STORE = 'session'
const SEED_RECORD = 'seed'
const SESSION_RECORD = 'record'

async function openSessionDb({
  idb = indexedDB
}: {
  idb?: IDBFactory
}): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = idb.open(SESSION_DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SESSION_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'))
  })
}

async function withSessionStore(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
  idb?: IDBFactory
): Promise<unknown> {
  const db = await openSessionDb({ ...(idb && { idb }) })
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, mode)
      const request = operation(transaction.objectStore(SESSION_STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(request.error ?? new Error('IndexedDB operation failed.'))
    })
  } finally {
    db.close()
  }
}

/** Persists the 32-byte master seed. */
export async function saveSeed({
  seed,
  idb
}: {
  seed: Uint8Array
  idb?: IDBFactory
}): Promise<void> {
  await withSessionStore(
    'readwrite',
    (store) => store.put(seed, SEED_RECORD),
    idb
  )
}

/** Loads the persisted master seed, or `null`. */
export async function loadSeed({
  idb
}: { idb?: IDBFactory } = {}): Promise<Uint8Array | null> {
  const stored = await withSessionStore(
    'readonly',
    (store) => store.get(SEED_RECORD),
    idb
  )
  return stored instanceof Uint8Array && stored.length === 32 ? stored : null
}

/** Persists an opaque session record (see `session/appSession.ts`). */
export async function saveRecord({
  record,
  idb
}: {
  record: unknown
  idb?: IDBFactory
}): Promise<void> {
  await withSessionStore(
    'readwrite',
    (store) => store.put(record, SESSION_RECORD),
    idb
  )
}

/** Loads the persisted session record, or `null`. */
export async function loadRecord({
  idb
}: { idb?: IDBFactory } = {}): Promise<unknown | null> {
  const stored = await withSessionStore(
    'readonly',
    (store) => store.get(SESSION_RECORD),
    idb
  )
  return stored ?? null
}

/** Wipes the seed and the session record (logout). */
export async function clearSeedStore({
  idb
}: { idb?: IDBFactory } = {}): Promise<void> {
  await withSessionStore(
    'readwrite',
    (store) => store.delete(SEED_RECORD),
    idb
  )
  await withSessionStore(
    'readwrite',
    (store) => store.delete(SESSION_RECORD),
    idb
  )
}
