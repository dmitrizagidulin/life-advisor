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

/** The exported bundle: one array per WAS collection, keyed by collection name. */
export interface ExportBundle {
  'action-items': ActionItemDoc[]
  projects: ProjectDoc[]
  goals: GoalDoc[]
  questions: QuestionDoc[]
  answers: AnswerDoc[]
  'web-links': WebLinkDoc[]
  thoughts: ThoughtDoc[]
  'current-focus': CurrentFocusDoc[]
}

/**
 * Shapes the decrypted per-collection docs into the keyed export bundle.
 *
 * @param input {object}   the live docs of each collection (already tombstone-free)
 * @returns {ExportBundle}
 */
export function buildExportBundle(input: {
  actionItems: ActionItemDoc[]
  projects: ProjectDoc[]
  goals: GoalDoc[]
  questions: QuestionDoc[]
  answers: AnswerDoc[]
  webLinks: WebLinkDoc[]
  thoughts: ThoughtDoc[]
  currentFocus: CurrentFocusDoc | null
}): ExportBundle {
  return {
    'action-items': input.actionItems,
    projects: input.projects,
    goals: input.goals,
    questions: input.questions,
    answers: input.answers,
    'web-links': input.webLinks,
    thoughts: input.thoughts,
    'current-focus': input.currentFocus ? [input.currentFocus] : []
  }
}
