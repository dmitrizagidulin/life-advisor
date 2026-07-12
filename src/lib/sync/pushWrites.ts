/**
 * The push side of the WAS replication adapter: fans each local change out to
 * conditional WAS writes and assembles the RxDB conflict entry when the server
 * rejects a write with `412`.
 *
 * A single RxDB document spans two independently-versioned sub-resources: the
 * content (`data` / `version`, at `PUT/DELETE /:id`) and the metadata (`custom`
 * / `metaVersion`, at `PUT /:id/meta`). This handler diffs the new local state
 * against the assumed master to route each half:
 *
 * - content changed -> `PUT /:id` (`If-Match: "<version>"`) or, on create,
 *   `PUT /:id` (`If-None-Match: *`); a delete -> `DELETE /:id`.
 * - metadata changed -> `PUT /:id/meta` (`If-Match: "<metaVersion>"`, or
 *   `If-None-Match: *` when the resource has no metadata yet).
 *
 * Content is written before metadata on a create, because the server rejects a
 * `/meta` write to a resource that does not yet exist.
 *
 * RxDB's push contract asks only for *conflicts* back (the current master state
 * of each rejected row). These are MUTABLE-head collections, though (an update
 * re-encrypts under the same id with `sequence`+1), so the server bumps the
 * content `version` (and, on a `/meta` write, the `metaVersion`) on every
 * successful write. If the handler let those new versions go unrecorded, RxDB's
 * assumed-master versions would stay at the values we pushed, and a second edit
 * inside the poll window would push a stale `If-Match`, drawing a spurious `412`
 * and a full conflict round trip. So on a successful write the handler reports
 * the resource's NEW master state (same body, advanced `version` and/or
 * `metaVersion`) back through the conflicts channel -- the one seam RxDB exposes
 * for correcting the assumed master. Because the body and deletion flag are
 * unchanged, the LWW conflict handler recognises it as our own echo and resolves
 * without a re-push, so the assumed-master versions simply advance. Each new
 * version comes from its write response `ETag` when the server exposes it, else
 * from the server's monotonic `+1` rule (a wrong guess is self-correcting: it
 * merely re-draws the occasional `412`).
 */
import type { WithDeleted } from 'rxdb/plugins/core'
import type { Json, MasterState, SyncedDoc, WasSyncPort } from './types.js'
import { WasResourceAbsentError, WasSyncConflictError } from './types.js'

/**
 * Formats a master revision (`version` or `metaVersion`) as the quoted strong
 * ETag the server compares `If-Match` against (revision `3` becomes `"3"`).
 *
 * @param revision {number}
 * @returns {string}
 */
export function formatEtag(revision: number): string {
  return `"${revision}"`
}

/**
 * Structural equality over two opaque bodies, by canonical-free JSON string.
 * Used to decide whether the content or the metadata half changed (and thus
 * which endpoint(s) to write) and, on a re-pushed conflict echo, to recognise
 * that the body already matches the assumed master so no re-write is issued.
 * Every real edit re-encrypts to fresh bytes, so this coarse comparison is
 * sufficient for routing.
 *
 * @param left {Json | undefined}
 * @param right {Json | undefined}
 * @returns {boolean}
 */
function bodiesEqual(left: Json | undefined, right: Json | undefined): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

/**
 * Builds the RxDB conflict entry (the real current master state) for a row whose
 * conditional write was rejected with `412`. Re-reads the resource; when it is
 * genuinely absent (a delete/delete race) the master is a tombstone synthesized
 * from what we know locally.
 *
 * @param options {object}
 * @param options.port {WasSyncPort}
 * @param options.id {string}
 * @param options.fallbackUpdatedAt {string}   used if the resource is now absent
 * @param options.fallbackVersion {number}     used if the resource is now absent
 * @returns {Promise<WithDeleted<SyncedDoc>>}
 */
async function assembleConflict({
  port,
  id,
  fallbackUpdatedAt,
  fallbackVersion
}: {
  port: WasSyncPort
  id: string
  fallbackUpdatedAt: string
  fallbackVersion: number
}): Promise<WithDeleted<SyncedDoc>> {
  const master: MasterState | null = await port.get({ id })
  if (master === null) {
    return {
      id,
      updatedAt: fallbackUpdatedAt,
      version: fallbackVersion,
      _deleted: true
    }
  }
  const conflict: WithDeleted<SyncedDoc> = {
    id,
    updatedAt: master.updatedAt,
    version: master.version,
    _deleted: master.deleted
  }
  if (master.data !== undefined) {
    conflict.data = master.data
  }
  if (master.metaVersion !== undefined) {
    conflict.metaVersion = master.metaVersion
  }
  if (master.custom !== undefined) {
    conflict.custom = master.custom
  }
  return conflict
}

/**
 * Sends one local change to the remote Collection as up to two conditional
 * writes (content, then metadata). Returns the master-state conflict entry on a
 * `412` at either step; on success, returns the post-write master state (same
 * body, advanced `version` and/or `metaVersion`) so RxDB can advance its
 * assumed master, or `null` when nothing was written (a no-op, or a delete).
 *
 * @param options {object}
 * @param options.port {WasSyncPort}
 * @param options.newDocumentState {WithDeleted<SyncedDoc>}
 * @param [options.assumedMasterState] {WithDeleted<SyncedDoc>}
 * @returns {Promise<WithDeleted<SyncedDoc> | null>}
 */
async function pushRow({
  port,
  newDocumentState,
  assumedMasterState
}: {
  port: WasSyncPort
  newDocumentState: WithDeleted<SyncedDoc>
  assumedMasterState?: WithDeleted<SyncedDoc>
}): Promise<WithDeleted<SyncedDoc> | null> {
  const { id } = newDocumentState
  const assumedVersion = assumedMasterState?.version
  const isCreate = assumedMasterState === undefined
  try {
    if (newDocumentState._deleted) {
      // Delete supersedes any metadata write: drop the content, tombstone wins.
      await port.deleteContent({
        id,
        ...(assumedVersion !== undefined && {
          ifMatch: formatEtag(assumedVersion)
        })
      })
      return null
    }

    // Content half: write on create, or when the content body changed. On a
    // mutable head an update re-encrypts to fresh bytes, so this fires on nearly
    // every edit.
    const contentChanged =
      isCreate || !bodiesEqual(newDocumentState.data, assumedMasterState?.data)
    let newContentVersion: number | undefined
    if (contentChanged) {
      const reported = await port.putContent({
        id,
        data: newDocumentState.data ?? null,
        ...(isCreate
          ? { ifNoneMatch: true }
          : assumedVersion !== undefined && {
              ifMatch: formatEtag(assumedVersion)
            })
      })
      // Prefer the version the server reported (the write `ETag`); otherwise the
      // server's monotonic `+1` rule -- a create lands at `1` (from an absent
      // resource's implicit `0`), an update at the matched version `+1`.
      newContentVersion =
        reported ?? (isCreate ? 1 : (assumedVersion ?? 0) + 1)
    }

    // Metadata half: write when the resource has metadata and it changed. On a
    // create this runs after the content write (the resource must exist first).
    const metadataChanged = !bodiesEqual(
      newDocumentState.custom,
      assumedMasterState?.custom
    )
    let newMetaVersion: number | undefined
    if (newDocumentState.custom !== undefined && metadataChanged) {
      const assumedMetaVersion = assumedMasterState?.metaVersion
      const reported = await port.putMeta({
        id,
        custom: newDocumentState.custom,
        ...(assumedMetaVersion !== undefined
          ? { ifMatch: formatEtag(assumedMetaVersion) }
          : { ifNoneMatch: true })
      })
      // Same monotonic `+1` fallback as the content half: a first metadata
      // write lands at `1`, an update at the matched `metaVersion` `+1`.
      newMetaVersion = reported ?? (assumedMetaVersion ?? 0) + 1
    }

    // Report the advanced version(s) back through the conflicts channel so
    // RxDB's assumed master catches up (see the file header). The body is
    // unchanged, so the LWW conflict handler treats it as our own echo and
    // resolves without re-pushing.
    if (newContentVersion !== undefined || newMetaVersion !== undefined) {
      return {
        ...newDocumentState,
        ...(newContentVersion !== undefined && { version: newContentVersion }),
        ...(newMetaVersion !== undefined && { metaVersion: newMetaVersion })
      }
    }
    return null
  } catch (err) {
    if (err instanceof WasSyncConflictError) {
      return assembleConflict({
        port,
        id,
        fallbackUpdatedAt: newDocumentState.updatedAt,
        fallbackVersion: assumedVersion ?? newDocumentState.version
      })
    }
    // A delete whose target is already absent is a terminal no-op: the row was
    // created and deleted locally before any push reached the server, so there
    // is nothing to tombstone. Swallowing it keeps a phantom tombstone from
    // wedging the collection's push queue (which RxDB would retry forever).
    if (err instanceof WasResourceAbsentError && newDocumentState._deleted) {
      return null
    }
    // Any non-conflict error (network, 5xx, auth) propagates so RxDB retries
    // the whole batch with backoff.
    throw err
  }
}

/**
 * Builds the RxDB push handler that fans a batch of local changes out to
 * conditional WAS writes and returns, per row, the master state RxDB should
 * adopt: a genuine conflict's current master on a `412`, or the post-write
 * master (advanced `version` and/or `metaVersion`, unchanged body) on a
 * successful write so the assumed-master versions stay in step. Rows that wrote
 * nothing (no-op, delete) report nothing.
 *
 * Rows are pushed concurrently; if any non-conflict error is thrown the whole
 * batch rejects (RxDB re-sends it later), matching RxDB's all-or-nothing retry.
 *
 * @param port {WasSyncPort}
 * @returns {(rows: Array<{ newDocumentState: WithDeleted<SyncedDoc>,
 *   assumedMasterState?: WithDeleted<SyncedDoc> }>) =>
 *   Promise<WithDeleted<SyncedDoc>[]>}
 */
export function createPushHandler(port: WasSyncPort) {
  return async function push(
    rows: Array<{
      newDocumentState: WithDeleted<SyncedDoc>
      assumedMasterState?: WithDeleted<SyncedDoc>
    }>
  ): Promise<WithDeleted<SyncedDoc>[]> {
    const results = await Promise.all(
      rows.map(row =>
        pushRow({
          port,
          newDocumentState: row.newDocumentState,
          assumedMasterState: row.assumedMasterState
        })
      )
    )
    return results.filter(
      (conflict): conflict is WithDeleted<SyncedDoc> => conflict !== null
    )
  }
}
