/**
 * Ported Rails `<=>` comparators. Order is load-bearing and matches the enum
 * orders in `types/domain.ts`; do not "improve" the tie-breaks. Every comparator
 * returns the usual -1/0/1 so `[...xs].sort(compareX)` reproduces the Rails
 * `sort` (ascending on `<=>`) result.
 *
 * ISO-8601 timestamp strings sort lexically the same as chronologically, so
 * string comparison is the correct time comparison here.
 */
import { AREAS } from '@/types/domain'
import type {
  ActionItemDoc,
  GoalDoc,
  ProjectDoc,
  QuestionDoc
} from '@/types/domain'

/** -1/0/1 lexical comparison of two strings. */
export function cmpStr(a: string, b: string): number {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}

/** -1/0/1 numeric comparison. */
function cmpNum(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Action items: bumpCount DESC, then AREAS enum order ASC, then createdAt DESC.
 * The area step is skipped when either area is absent (ported guard).
 */
export function compareActionItems(a: ActionItemDoc, b: ActionItemDoc): number {
  const bump = cmpNum(b.bumpCount, a.bumpCount)
  if (bump !== 0) {
    return bump
  }
  if (a.area != null && b.area != null) {
    const area = cmpNum(AREAS.indexOf(a.area), AREAS.indexOf(b.area))
    if (area !== 0) {
      return area
    }
  }
  return cmpStr(b.createdAt, a.createdAt)
}

/** bumpCount DESC, then name ASC. Shared by projects and goals. */
function compareByBumpThenName(
  a: { bumpCount: number; name: string },
  b: { bumpCount: number; name: string }
): number {
  if (a.bumpCount !== b.bumpCount) {
    return cmpNum(b.bumpCount, a.bumpCount)
  }
  return cmpStr(a.name, b.name)
}

/** Projects: bumpCount DESC, then name ASC. */
export const compareProjects: (a: ProjectDoc, b: ProjectDoc) => number =
  compareByBumpThenName

/** Goals: bumpCount DESC, then name ASC. */
export const compareGoals: (a: GoalDoc, b: GoalDoc) => number =
  compareByBumpThenName

/** Questions: bumpCount DESC, then createdAt ASC. */
export function compareQuestions(a: QuestionDoc, b: QuestionDoc): number {
  const bump = cmpNum(b.bumpCount, a.bumpCount)
  if (bump !== 0) {
    return bump
  }
  return cmpStr(a.createdAt, b.createdAt)
}

/** Children of a parent (the Parentable list): createdAt DESC. */
export function compareChildren(
  a: { createdAt: string },
  b: { createdAt: string }
): number {
  return cmpStr(b.createdAt, a.createdAt)
}

/**
 * The history/day timestamp for an action item: its completion time when done
 * (and set), otherwise its creation time.
 */
export function daySortKey(item: ActionItemDoc): string {
  if (item.done && item.completedAt) {
    return item.completedAt
  }
  return item.createdAt
}

/** Day-history items ordered by `daySortKey` ASC. */
export function compareDayItems(a: ActionItemDoc, b: ActionItemDoc): number {
  return cmpStr(daySortKey(a), daySortKey(b))
}

/**
 * Completed items as the project-show screen orders them: the action-item
 * comparator applied in reverse (`sort {|x,y| y <=> x}`).
 */
export function sortActionItemsCompletedDesc(
  items: ActionItemDoc[]
): ActionItemDoc[] {
  return [...items].sort((x, y) => compareActionItems(y, x))
}
