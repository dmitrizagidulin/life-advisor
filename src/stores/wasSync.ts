/**
 * Shared WAS replication bootstrap: given a parsed grant set and the invoking
 * ZcapClient, builds the delegated {@link WasRemoteStore}, best-effort marks
 * each collection encrypted, and starts the {@link syncController} with
 * reactive store patching. Used by both dev-sync (P2 grants file) and the
 * wallet session (CHAPI grants).
 */
import type { ZcapClient } from '@interop/ezcap'
import type { ParsedGrants } from '@/stores/grants'
import { WasRemoteStore } from '@/stores/wasRemoteStore'
import { syncController } from '@/stores/syncController'
import { requireStore } from '@/stores/storageManager'
import { patchFromChange } from '@/stores/rehydrate'

/**
 * Builds the remote store and starts background replication.
 *
 * @param options {object}
 * @param options.parsed {ParsedGrants}
 * @param options.zcapClient {ZcapClient}   invocation signer = grants' controller
 * @param [options.onAuthError] {() => void}   fired when replication hits a
 *   401/403 (expired/revoked access) -- wired to the reconnect banner
 * @returns {Promise<WasRemoteStore>}
 */
export async function startWasSync({
  parsed,
  zcapClient,
  onAuthError
}: {
  parsed: ParsedGrants
  zcapClient: ZcapClient
  onAuthError?: () => void
}): Promise<WasRemoteStore> {
  const remoteStore = WasRemoteStore.fromGrants({ parsed, zcapClient })

  // Best-effort encryption marker; non-fatal either way (envelopes replicate
  // into an unmarked collection just the same).
  await Promise.all(
    Object.keys(parsed.byCollectionId).map(async (collectionId) => {
      const result = await remoteStore.markCollectionEncrypted(collectionId)
      if (!result.ok) {
        console.warn(
          `Encryption marker PUT not authorized for "${collectionId}" (status ${result.status ?? 'n/a'}).`
        )
      }
    })
  )

  await syncController.start({
    remoteStore,
    localStore: requireStore(),
    onRemoteChange: (collectionKey, event) => {
      void patchFromChange(collectionKey, event)
    },
    ...(onAuthError && { onAuthError })
  })
  return remoteStore
}
