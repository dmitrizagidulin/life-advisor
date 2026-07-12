/**
 * Pure shaping for the export-all-JSON action: assemble the eight decrypted
 * entity collections into one bundle keyed by WAS collection name (the generic,
 * unprefixed names shared across interoperable apps). Tombstones are already
 * excluded upstream (the entity stores hold only live docs); this layer only
 * orders and re-keys, so it stays pure and unit-testable.
 *
 * The `current-focus` singleton is emitted as an array (zero or one element) so
 * every value in the bundle has the same array shape for consumers.
 */
import type {
  ActionItemDoc,
  ProjectDoc,
  GoalDoc,
  QuestionDoc,
  AnswerDoc,
  WebLinkDoc,
  ThoughtDoc,
  CurrentFocusDoc
} from '@/types/domain'
import { LA_COLLECTIONS } from '@/app.config'
import type { CollectionKey, WasCollectionId } from '@/app.config'

/** Any decrypted document held by one of the seven generic list stores. */
export type ExportDoc =
  | ActionItemDoc
  | ProjectDoc
  | GoalDoc
  | QuestionDoc
  | AnswerDoc
  | WebLinkDoc
  | ThoughtDoc

/**
 * The live value of one collection: an array of docs for the seven list stores,
 * or the singleton's held doc (or `null`) for `current-focus`.
 */
export type ExportValue = ExportDoc[] | CurrentFocusDoc | null

/** The decrypted live docs of every collection, keyed by collection key. */
export type ExportInput = Record<CollectionKey, ExportValue>

/** The exported bundle: one array per WAS collection, keyed by collection name. */
export type ExportBundle = Record<WasCollectionId, ExportDoc[] | CurrentFocusDoc[]>

/**
 * Shapes the decrypted per-collection docs into the export bundle keyed by WAS
 * collection name. Every value is emitted as an array (the singleton becomes a
 * zero- or one-element array) so consumers see one uniform shape. The roster is
 * derived from {@link LA_COLLECTIONS} -- the single enumeration of collections.
 *
 * @param input {ExportInput}   the live docs of each collection (already tombstone-free)
 * @returns {ExportBundle}
 */
export function buildExportBundle(input: ExportInput): ExportBundle {
  const bundle: Record<string, ExportDoc[] | CurrentFocusDoc[]> = {}
  for (const { key, id } of LA_COLLECTIONS) {
    const value = input[key]
    bundle[id] = Array.isArray(value) ? value : value ? [value] : []
  }
  return bundle as ExportBundle
}
