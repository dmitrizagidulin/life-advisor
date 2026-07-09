/**
 * Question domain operations, ported from the Rails Question model and questions
 * controller.
 *
 * Note: the Rails app carries `answered`/`answered_at` fields but never sets them
 * (no controller path toggles answering). `setAnswered` fills that gap following
 * the same set/clear-timestamp shape as action-item `toggleDone`.
 */
import { nowIso } from '@/lib/dates'
import type { QuestionDoc } from '@/types/domain'

/** Mark a question answered or not, stamping/clearing `answeredAt`. */
export function setAnswered(
  question: QuestionDoc,
  answered: boolean,
  now: string = nowIso()
): QuestionDoc {
  return {
    ...question,
    answered,
    answeredAt: answered ? now : null,
    updatedAt: now
  }
}

/**
 * The questions-index split into project-parented and everything else
 * (`parent_type == 'project'`).
 */
export function splitByProject(questions: QuestionDoc[]): {
  project: QuestionDoc[]
  nonProject: QuestionDoc[]
} {
  return {
    project: questions.filter((q) => q.parentType === 'project'),
    nonProject: questions.filter((q) => q.parentType !== 'project')
  }
}
