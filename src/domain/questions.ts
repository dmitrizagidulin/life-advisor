/**
 * Question domain operations. `setAnswered` follows the same
 * set/clear-timestamp shape as action-item `toggleDone`.
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

/** Increment the bump count. */
export function bump(
  question: QuestionDoc,
  now: string = nowIso()
): QuestionDoc {
  return { ...question, bumpCount: question.bumpCount + 1, updatedAt: now }
}

/**
 * The questions-index split into project-parented and everything else.
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
