/**
 * Action-item domain operations, ported from the Rails ActionItem model. Pure:
 * each returns a NEW document (or a batch of them); the caller persists.
 */
import { nowIso } from '@/lib/dates'
import { MYWN_CATEGORIES } from '@/types/domain'
import type { ActionItemDoc, MywnCategory } from '@/types/domain'

/**
 * Flip `done` and set/clear `completedAt` accordingly (`toggle_done!`): becoming
 * done stamps the completion time, un-doing clears it.
 */
export function toggleDone(
  item: ActionItemDoc,
  now: string = nowIso()
): ActionItemDoc {
  const done = !item.done
  return {
    ...item,
    done,
    completedAt: done ? now : null,
    updatedAt: now
  }
}

/**
 * The `before_update` guard: a done item with no `completedAt` gets one stamped.
 * Deliberately does NOT clear `completedAt` on a not-done item -- that is the
 * ported Rails behavior (only `toggleDone` clears it).
 */
export function enforceCompletedAt(
  item: ActionItemDoc,
  now: string = nowIso()
): ActionItemDoc {
  if (item.done && item.completedAt == null) {
    return { ...item, completedAt: now }
  }
  return item
}

/** Increment the bump count (`bump!`). */
export function bump(
  item: ActionItemDoc,
  now: string = nowIso()
): ActionItemDoc {
  return { ...item, bumpCount: item.bumpCount + 1, updatedAt: now }
}

/** Whether a string names a valid MYWN category. */
export function isValidCategory(category: string): category is MywnCategory {
  return (MYWN_CATEGORIES as readonly string[]).includes(category)
}

/**
 * Bulk re-categorize every not-done item in `from` to `to` (`mywn_category_move`).
 * Throws on an invalid category, mirroring the Rails ArgumentError. Returns the
 * changed docs and the count moved.
 */
export function categoryMove(
  items: ActionItemDoc[],
  from: string,
  to: string,
  now: string = nowIso()
): { moved: ActionItemDoc[]; count: number } {
  if (!isValidCategory(from) || !isValidCategory(to)) {
    throw new Error('Invalid MYWN Category')
  }
  const moved = items
    .filter((item) => !item.done && item.mywnCategory === from)
    .map((item) => ({ ...item, mywnCategory: to, updatedAt: now }))
  return { moved, count: moved.length }
}
