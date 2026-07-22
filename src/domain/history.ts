/**
 * The day-history journal: buckets action items by local day, then reports per
 * day over a trailing window. The local day (not UTC) is used consistently for
 * both bucketing and same-day completion.
 */
import { dayKeysBack, localDayKey, todayKey } from '@/lib/dates'
import type { ActionItemDoc } from '@/types/domain'
import { compareDayItems } from './sort'

/** Whether an item was completed on the same local day it was created. */
export function completedSameDay(item: ActionItemDoc): boolean {
  if (!item.completedAt) {
    return false
  }
  return localDayKey(item.createdAt) === localDayKey(item.completedAt)
}

/** Bucket items by local created-day and (when completed) local completed-day. */
export function groupByDay(items: ActionItemDoc[]): {
  createdByDay: Map<string, ActionItemDoc[]>
  completedByDay: Map<string, ActionItemDoc[]>
} {
  const createdByDay = new Map<string, ActionItemDoc[]>()
  const completedByDay = new Map<string, ActionItemDoc[]>()
  const push = (map: Map<string, ActionItemDoc[]>, key: string, item: ActionItemDoc) => {
    const bucket = map.get(key)
    if (bucket) {
      bucket.push(item)
    } else {
      map.set(key, [item])
    }
  }
  for (const item of items) {
    if (item.completedAt) {
      push(completedByDay, localDayKey(item.completedAt), item)
    }
    push(createdByDay, localDayKey(item.createdAt), item)
  }
  return { createdByDay, completedByDay }
}

export interface DayHistory {
  day: string
  createdItems: ActionItemDoc[]
  completedItems: ActionItemDoc[]
  createdNotCompleted: ActionItemDoc[]
  numCreatedItems: number
  numCompletedItems: number
  numCompletedSameDay: number
  hasActivity: boolean
  /** Completed items plus created-not-completed, ordered by `daySortKey` ASC. */
  items: ActionItemDoc[]
}

/** Build one day's history bucket from the pre-grouped maps. */
export function dayHistory(
  day: string,
  createdByDay: Map<string, ActionItemDoc[]>,
  completedByDay: Map<string, ActionItemDoc[]>
): DayHistory {
  const createdItems = createdByDay.get(day) ?? []
  const completedItems = completedByDay.get(day) ?? []
  const createdNotCompleted = createdItems.filter((i) => !completedSameDay(i))
  const numCreatedItems = createdItems.length
  return {
    day,
    createdItems,
    completedItems,
    createdNotCompleted,
    numCreatedItems,
    numCompletedItems: completedItems.length,
    numCompletedSameDay: numCreatedItems - createdNotCompleted.length,
    hasActivity: createdItems.length > 0 || completedItems.length > 0,
    items: [...completedItems, ...createdNotCompleted].sort(compareDayItems)
  }
}

/**
 * The history journal: one DayHistory per local day from `today` back through
 * `daysBack` days inclusive (`daysBack + 1` entries), most recent first.
 */
export function buildHistory(
  items: ActionItemDoc[],
  today: string = todayKey(),
  daysBack: number = 60
): DayHistory[] {
  const { createdByDay, completedByDay } = groupByDay(items)
  return dayKeysBack(today, daysBack).map((day) =>
    dayHistory(day, createdByDay, completedByDay)
  )
}
