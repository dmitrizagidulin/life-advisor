/**
 * Project domain operations, ported from the Rails Project model.
 */
import { nowIso } from '@/lib/dates'
import type { ActionItemDoc, ProjectDoc, ProjectStatus } from '@/types/domain'
import { compareActionItems } from './sort'

/**
 * The status machine (`change_status!`): `completed` stamps `completedAt` and
 * clears `canceledAt`; `canceled` does the reverse; any other status clears both.
 */
export function changeStatus(
  project: ProjectDoc,
  newStatus: ProjectStatus,
  now: string = nowIso()
): ProjectDoc {
  if (newStatus === 'completed') {
    return {
      ...project,
      status: newStatus,
      completedAt: now,
      canceledAt: null,
      updatedAt: now
    }
  }
  if (newStatus === 'canceled') {
    return {
      ...project,
      status: newStatus,
      canceledAt: now,
      completedAt: null,
      updatedAt: now
    }
  }
  return {
    ...project,
    status: newStatus,
    completedAt: null,
    canceledAt: null,
    updatedAt: now
  }
}

/**
 * The project's first not-done action item by the action-item comparator
 * (`next_action`). `items` may be any action-item pool; only children of this
 * project are considered.
 */
export function nextAction(
  project: ProjectDoc,
  items: ActionItemDoc[]
): ActionItemDoc | undefined {
  return items
    .filter(
      (i) =>
        i.parentType === 'project' && i.parentKey === project.id && !i.done
    )
    .sort(compareActionItems)[0]
}

/** Sum of `timeElapsed` (hours) over the given items (`time_elapsed`). */
export function timeElapsed(items: ActionItemDoc[]): number {
  return items.reduce((total, item) => total + item.timeElapsed, 0)
}

/**
 * Add or remove `goalId` from the project's served goals (`serve_goal_toggle`):
 * present goals are dropped, absent goals are added.
 */
export function serveGoalToggle(
  project: ProjectDoc,
  goalId: string,
  now: string = nowIso()
): ProjectDoc {
  const goalIds = project.goalIds.includes(goalId)
    ? project.goalIds.filter((id) => id !== goalId)
    : [...project.goalIds, goalId]
  return { ...project, goalIds, updatedAt: now }
}
