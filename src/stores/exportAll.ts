/**
 * Export-all-JSON (settings action): collect every decrypted payload out of the
 * eight in-memory entity stores and download them as one JSON file. Replaces the
 * old server-side export script. The shaping is the pure {@link buildExportBundle}
 * (unit-tested); this module wires it to the live stores and a browser download.
 */
import { buildExportBundle } from '@/lib/exportData'
import type { ExportBundle, ExportInput } from '@/lib/exportData'
import { COLLECTION_REGISTRY } from '@/stores/collectionRegistry'
import type { CollectionKey } from '@/app.config'

/** Reads the current live docs from every entity store into an export bundle. */
function collectExportBundle(): ExportBundle {
  const input = {} as ExportInput
  for (const key of Object.keys(COLLECTION_REGISTRY) as CollectionKey[]) {
    input[key] = COLLECTION_REGISTRY[key].collect()
  }
  return buildExportBundle(input)
}

/** Serializes the export bundle and triggers a browser download. */
export function downloadExportBundle(): void {
  const bundle = collectExportBundle()
  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `life-advisor-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
