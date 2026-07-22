/**
 * Parenting helpers: pointers `{parentType, parentKey}` and the virtual "day"
 * parent.
 */
import { todayKey } from '@/lib/dates'
import type { ParentType } from '@/types/domain'
import { compareChildren } from './sort'

type Parented = { parentType?: ParentType; parentKey?: string }

/**
 * Match-only predicate: whether a doc points at the parent `(type, key)`. The
 * sort-free half of `forParent`, for sites that filter children but supply
 * their own ordering.
 */
export function isChildOf(
  type: ParentType,
  key: string
): (doc: Parented) => boolean {
  return (doc) => doc.parentType === type && doc.parentKey === key
}

/** Children of `(type, key)`, ordered createdAt DESC. */
export function forParent<T extends Parented & { createdAt: string }>(
  docs: T[],
  type: ParentType,
  key: string
): T[] {
  return docs.filter(isChildOf(type, key)).sort(compareChildren)
}

/**
 * Bucket children by `parentKey` for a single `parentType`, each bucket ordered
 * createdAt DESC (the same per-parent order as `forParent`). Lets a list
 * subscribe to a store once and hand every parent its slice, instead of each
 * row re-running `forParent` over the whole store.
 */
export function bucketByParent<T extends Parented & { createdAt: string }>(
  docs: T[],
  type: ParentType
): Map<string, T[]> {
  const buckets = new Map<string, T[]>()
  for (const doc of docs) {
    if (doc.parentType !== type || doc.parentKey == null) {
      continue
    }
    const bucket = buckets.get(doc.parentKey)
    if (bucket) {
      bucket.push(doc)
    } else {
      buckets.set(doc.parentKey, [doc])
    }
  }
  for (const bucket of buckets.values()) {
    bucket.sort(compareChildren)
  }
  return buckets
}

/** Whether the doc points at a real parent (both fields present). */
export function hasParent(doc: Parented): boolean {
  return !!doc.parentType && !!doc.parentKey
}

/**
 * Default an un-parented doc (or one explicitly pointing at the literal `today`
 * day) onto today's local day: applies when `parentType` is missing, or it is
 * the `day`/`'today'` sentinel.
 */
export function enforceDefaultDayParent<T extends Parented>(
  doc: T,
  today: string = todayKey()
): T {
  if (!doc.parentType || (doc.parentType === 'day' && doc.parentKey === 'today')) {
    return { ...doc, parentType: 'day', parentKey: today }
  }
  return doc
}
