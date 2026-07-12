/**
 * Unit tests for the push side of the sync adapter (conditional-write routing
 * and the 412 conflict assembler), driven by a fake WAS port -- no server, no
 * RxDB engine.
 */
import { describe, it, expect } from 'vitest'
import type { WithDeleted } from 'rxdb/plugins/core'
import { createPushHandler, formatEtag } from './pushWrites'
import {
  WasResourceAbsentError,
  WasSyncConflictError,
  type MasterState,
  type SyncedDoc,
  type WasSyncPort
} from './types'

type WriteCall =
  | {
      kind: 'putContent'
      id: string
      data: unknown
      ifMatch?: string
      ifNoneMatch?: boolean
    }
  | { kind: 'deleteContent'; id: string; ifMatch?: string }
  | {
      kind: 'putMeta'
      id: string
      custom: unknown
      ifMatch?: string
      ifNoneMatch?: boolean
    }

/**
 * A fake port that records every write, optionally throws a conflict for a
 * chosen (kind,id), and serves a scripted `get` master state for the re-read.
 */
function fakePushPort(
  options: {
    conflictOn?: { kind: WriteCall['kind']; id: string }
    absentOnDelete?: string
    master?: MasterState | null
    /** Version the fake `putContent` reports (an exposed write `ETag`). */
    reportContentVersion?: number
    /** Version the fake `putMeta` reports (an exposed write `ETag`). */
    reportMetaVersion?: number
  } = {}
): WasSyncPort & { writes: WriteCall[]; getCalls: string[] } {
  const writes: WriteCall[] = []
  const getCalls: string[] = []
  const maybeConflict = (kind: WriteCall['kind'], id: string) => {
    if (options.conflictOn?.kind === kind && options.conflictOn.id === id) {
      throw new WasSyncConflictError()
    }
  }
  return {
    writes,
    getCalls,
    async query() {
      return { documents: [], checkpoint: null }
    },
    async putContent({ id, data, ifMatch, ifNoneMatch }) {
      writes.push({ kind: 'putContent', id, data, ifMatch, ifNoneMatch })
      maybeConflict('putContent', id)
      return options.reportContentVersion
    },
    async deleteContent({ id, ifMatch }) {
      writes.push({ kind: 'deleteContent', id, ifMatch })
      if (options.absentOnDelete === id) {
        throw new WasResourceAbsentError()
      }
      maybeConflict('deleteContent', id)
    },
    async putMeta({ id, custom, ifMatch, ifNoneMatch }) {
      writes.push({ kind: 'putMeta', id, custom, ifMatch, ifNoneMatch })
      maybeConflict('putMeta', id)
      return options.reportMetaVersion
    },
    async get({ id }) {
      getCalls.push(id)
      return options.master ?? null
    }
  }
}

function newDoc(over: Partial<WithDeleted<SyncedDoc>>): WithDeleted<SyncedDoc> {
  return {
    id: 'r1',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 0,
    _deleted: false,
    ...over
  }
}

describe('createPushHandler routing', () => {
  it('creates content with If-None-Match when there is no assumed master', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    const conflicts = await push([
      { newDocumentState: newDoc({ id: 'r1', data: { a: 1 } }) }
    ])

    // The successful create reports its post-write master (version bumped to 1).
    expect(conflicts).toEqual([
      { id: 'r1', updatedAt: '2026-01-01T00:00:00Z', version: 1, data: { a: 1 }, _deleted: false }
    ])
    expect(port.writes).toEqual([
      { kind: 'putContent', id: 'r1', data: { a: 1 }, ifNoneMatch: true }
    ])
  })

  it('creates content then metadata (content first) on a create with custom', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    await push([
      {
        newDocumentState: newDoc({
          id: 'r1',
          data: { a: 1 },
          custom: { jwe: 'x' }
        })
      }
    ])

    expect(port.writes.map(w => w.kind)).toEqual(['putContent', 'putMeta'])
    expect(port.writes[1]).toEqual({
      kind: 'putMeta',
      id: 'r1',
      custom: { jwe: 'x' },
      ifNoneMatch: true
    })
  })

  it('updates content with If-Match "<version>" when the body changed', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    await push([
      {
        assumedMasterState: newDoc({ version: 5, data: { a: 1 } }),
        newDocumentState: newDoc({ version: 5, data: { a: 2 } })
      }
    ])

    expect(port.writes).toEqual([
      { kind: 'putContent', id: 'r1', data: { a: 2 }, ifMatch: formatEtag(5) }
    ])
  })

  it('routes a metadata-only change to /meta with If-Match "<metaVersion>", no content write', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    await push([
      {
        assumedMasterState: newDoc({
          version: 5,
          metaVersion: 2,
          data: { a: 1 },
          custom: { jwe: 'old' }
        }),
        newDocumentState: newDoc({
          version: 5,
          metaVersion: 2,
          data: { a: 1 },
          custom: { jwe: 'new' }
        })
      }
    ])

    expect(port.writes).toEqual([
      {
        kind: 'putMeta',
        id: 'r1',
        custom: { jwe: 'new' },
        ifMatch: formatEtag(2)
      }
    ])
  })

  it('creates metadata with If-None-Match when the master has no metaVersion yet', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    await push([
      {
        assumedMasterState: newDoc({ version: 5, data: { a: 1 } }),
        newDocumentState: newDoc({
          version: 5,
          data: { a: 1 },
          custom: { jwe: 'x' }
        })
      }
    ])

    expect(port.writes).toEqual([
      { kind: 'putMeta', id: 'r1', custom: { jwe: 'x' }, ifNoneMatch: true }
    ])
  })

  it('deletes with If-Match "<version>" and skips any metadata write', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    await push([
      {
        assumedMasterState: newDoc({ version: 7, data: { a: 1 } }),
        newDocumentState: newDoc({
          version: 7,
          _deleted: true,
          custom: { jwe: 'x' }
        })
      }
    ])

    expect(port.writes).toEqual([
      { kind: 'deleteContent', id: 'r1', ifMatch: formatEtag(7) }
    ])
  })
})

describe('createPushHandler conflicts', () => {
  it('re-reads and returns the master state on a 412', async () => {
    const master: MasterState = {
      version: 9,
      updatedAt: '2026-02-02T00:00:00Z',
      deleted: false,
      data: { a: 99 }
    }
    const port = fakePushPort({
      conflictOn: { kind: 'putContent', id: 'r1' },
      master
    })
    const push = createPushHandler(port)

    const conflicts = await push([
      { newDocumentState: newDoc({ id: 'r1', data: { a: 1 } }) }
    ])

    expect(port.getCalls).toEqual(['r1'])
    expect(conflicts).toEqual([
      {
        id: 'r1',
        updatedAt: '2026-02-02T00:00:00Z',
        version: 9,
        data: { a: 99 },
        _deleted: false
      }
    ])
  })

  it('synthesizes a tombstone conflict when the resource is now absent', async () => {
    const port = fakePushPort({
      conflictOn: { kind: 'deleteContent', id: 'r1' },
      master: null
    })
    const push = createPushHandler(port)

    const conflicts = await push([
      {
        assumedMasterState: newDoc({ version: 4, data: { a: 1 } }),
        newDocumentState: newDoc({ version: 4, _deleted: true })
      }
    ])

    expect(conflicts).toEqual([
      {
        id: 'r1',
        updatedAt: '2026-01-01T00:00:00Z',
        version: 4,
        _deleted: true
      }
    ])
  })

  it('carries metaVersion/custom into the assembled conflict', async () => {
    const master: MasterState = {
      version: 3,
      metaVersion: 6,
      updatedAt: '2026-03-03T00:00:00Z',
      deleted: false,
      data: { a: 1 },
      custom: { jwe: 'srv' }
    }
    const port = fakePushPort({
      conflictOn: { kind: 'putMeta', id: 'r1' },
      master
    })
    const push = createPushHandler(port)

    const conflicts = await push([
      {
        assumedMasterState: newDoc({
          version: 3,
          metaVersion: 5,
          data: { a: 1 },
          custom: { jwe: 'old' }
        }),
        newDocumentState: newDoc({
          version: 3,
          metaVersion: 5,
          data: { a: 1 },
          custom: { jwe: 'mine' }
        })
      }
    ])

    expect(conflicts[0]).toMatchObject({
      id: 'r1',
      version: 3,
      metaVersion: 6,
      custom: { jwe: 'srv' },
      _deleted: false
    })
  })

  it('treats a 404-absent delete as a terminal no-op (never-pushed row)', async () => {
    const port = fakePushPort({ absentOnDelete: 'r1' })
    const push = createPushHandler(port)

    // A row created and deleted locally before any push: DELETE with no
    // If-Match hits a resource the server never saw, so it reports absent.
    const conflicts = await push([
      { newDocumentState: newDoc({ id: 'r1', _deleted: true }) }
    ])

    // Swallowed as success: no conflict, no re-read, nothing to wedge the queue.
    expect(conflicts).toEqual([])
    expect(port.getCalls).toEqual([])
    expect(port.writes).toEqual([{ kind: 'deleteContent', id: 'r1' }])
  })

  it('propagates a non-conflict error so RxDB retries the batch', async () => {
    const port: WasSyncPort = {
      async query() {
        return { documents: [], checkpoint: null }
      },
      async putContent() {
        throw new Error('network down')
      },
      async deleteContent() {},
      async putMeta() {},
      async get() {
        return null
      }
    }
    const push = createPushHandler(port)

    await expect(
      push([{ newDocumentState: newDoc({ data: { a: 1 } }) }])
    ).rejects.toThrow('network down')
  })

  it('reports the successful row and the genuine conflict distinctly', async () => {
    const port = fakePushPort({
      conflictOn: { kind: 'putContent', id: 'bad' },
      master: {
        version: 1,
        updatedAt: '2026-01-05T00:00:00Z',
        deleted: false,
        data: { server: true }
      }
    })
    const push = createPushHandler(port)

    const conflicts = await push([
      { newDocumentState: newDoc({ id: 'ok', data: { a: 1 } }) },
      { newDocumentState: newDoc({ id: 'bad', data: { a: 2 } }) }
    ])

    // Both rows report a master: 'ok' its own post-write echo (advanced
    // version, unchanged body), 'bad' the server's current state.
    const byId = Object.fromEntries(conflicts.map((c) => [c.id, c]))
    expect(byId.ok).toMatchObject({ id: 'ok', version: 1, data: { a: 1 } })
    expect(byId.bad).toMatchObject({ id: 'bad', version: 1, data: { server: true } })
  })
})

describe('createPushHandler version write-back', () => {
  it('reports version 1 for a create when the server does not expose the ETag', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    const [master] = await push([
      { newDocumentState: newDoc({ id: 'r1', data: { a: 1 } }) }
    ])

    expect(master).toMatchObject({ id: 'r1', version: 1, data: { a: 1 } })
  })

  it('reports assumedVersion + 1 for an update when the ETag is hidden', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    const [master] = await push([
      {
        assumedMasterState: newDoc({ version: 5, data: { a: 1 } }),
        newDocumentState: newDoc({ version: 5, data: { a: 2 } })
      }
    ])

    expect(master).toMatchObject({ version: 6, data: { a: 2 } })
  })

  it('prefers the server-reported version (exposed write ETag) over the +1 guess', async () => {
    const port = fakePushPort({ reportContentVersion: 42 })
    const push = createPushHandler(port)

    const [master] = await push([
      {
        assumedMasterState: newDoc({ version: 5, data: { a: 1 } }),
        newDocumentState: newDoc({ version: 5, data: { a: 2 } })
      }
    ])

    expect(master).toMatchObject({ version: 42, data: { a: 2 } })
  })

  it('advances metaVersion (+1) for a metadata-only change, content version untouched', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    const [master] = await push([
      {
        assumedMasterState: newDoc({
          version: 5,
          metaVersion: 2,
          data: { a: 1 },
          custom: { jwe: 'old' }
        }),
        newDocumentState: newDoc({
          version: 5,
          metaVersion: 2,
          data: { a: 1 },
          custom: { jwe: 'new' }
        })
      }
    ])

    expect(master).toMatchObject({
      version: 5,
      metaVersion: 3,
      custom: { jwe: 'new' }
    })
  })

  it('prefers the server-reported metaVersion over the +1 guess', async () => {
    const port = fakePushPort({ reportMetaVersion: 9 })
    const push = createPushHandler(port)

    const [master] = await push([
      {
        assumedMasterState: newDoc({
          version: 5,
          metaVersion: 2,
          data: { a: 1 },
          custom: { jwe: 'old' }
        }),
        newDocumentState: newDoc({
          version: 5,
          metaVersion: 2,
          data: { a: 1 },
          custom: { jwe: 'new' }
        })
      }
    ])

    expect(master).toMatchObject({ metaVersion: 9 })
  })

  it('reports metaVersion 1 for a first metadata write on an existing resource', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    const [master] = await push([
      {
        assumedMasterState: newDoc({ version: 5, data: { a: 1 } }),
        newDocumentState: newDoc({
          version: 5,
          data: { a: 1 },
          custom: { jwe: 'x' }
        })
      }
    ])

    expect(master).toMatchObject({ version: 5, metaVersion: 1 })
  })

  it('reports both advanced versions for a create with custom', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    const [master] = await push([
      {
        newDocumentState: newDoc({
          id: 'r1',
          data: { a: 1 },
          custom: { jwe: 'x' }
        })
      }
    ])

    expect(master).toMatchObject({ version: 1, metaVersion: 1 })
  })

  it('reports nothing for a delete', async () => {
    const port = fakePushPort()
    const push = createPushHandler(port)

    const conflicts = await push([
      {
        assumedMasterState: newDoc({ version: 7, data: { a: 1 } }),
        newDocumentState: newDoc({ version: 7, _deleted: true })
      }
    ])

    expect(conflicts).toEqual([])
  })
})
