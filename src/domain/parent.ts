/**
 * The Parentable pattern: pointers `{parentType, parentKey}` and the virtual
 * "day" parent. Ported from the Rails Parentable concern.
 */
import { todayKey } from '@/lib/dates'
import type { ParentType } from '@/types/domain'
import { compareChildren } from './sort'

type Parented = { parentType?: ParentType; parentKey?: string }

/** Children of `(type, key)`, ordered createdAt DESC (the `for_parent` order). */
export function forParent<T extends Parented & { createdAt: string }>(
  docs: T[],
  type: ParentType,
  key: string
): T[] {
  return docs
    .filter((d) => d.parentType === type && d.parentKey === key)
    .sort(compareChildren)
}

/** Whether the doc points at a real parent (both fields present). */
export function hasParent(doc: Parented): boolean {
  return !!doc.parentType && !!doc.parentKey
}

/**
 * Default an un-parented doc (or one explicitly pointing at the literal `today`
 * day) onto today's local day. Ports `enforce_default_day_parent`: applies when
 * `parentType` is missing, or it is the `day`/`'today'` sentinel.
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
