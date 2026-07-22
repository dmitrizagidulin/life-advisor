/**
 * Current-focus resolution, ported from the Rails Elefsis service and
 * CurrentFocus model. The stored default focus points at the `day`/`'today'`
 * sentinel; resolving it (or a missing doc) yields today's actual local day.
 */
import { nowIso, todayKey } from '@/lib/dates'
import type { CurrentFocusDoc } from '@/types/domain'
import { createCurrentFocus } from './factories'

type FocusType = CurrentFocusDoc['focusType']

/** A resolved focus target: an entity reference, or a concrete local day. */
export interface ResolvedFocus {
  focusType: FocusType
  focusKey: string
}

/**
 * Resolve the effective focus (`current_focus`): today's day when the doc is
 * absent or is the `day`/`'today'` sentinel, otherwise the doc's own target.
 */
export function currentFocus(
  doc: CurrentFocusDoc | null | undefined,
  today: string = todayKey()
): ResolvedFocus {
  if (!doc || (doc.focusType === 'day' && doc.focusKey === 'today')) {
    return { focusType: 'day', focusKey: today }
  }
  return { focusType: doc.focusType, focusKey: doc.focusKey }
}

/** A focus doc pointing at the given entity/day (`focus_on` / `CurrentFocus.on`). */
export function focusOn(
  focusType: FocusType,
  focusKey: string,
  clientId: string,
  now: string = nowIso()
): CurrentFocusDoc {
  return createCurrentFocus({ focusType, focusKey, clientId }, now)
}

/** The default focus doc: today's day via the `'today'` sentinel (`reset_focus!`). */
export function resetFocus(
  clientId: string,
  now: string = nowIso()
): CurrentFocusDoc {
  return createCurrentFocus(
    { focusType: 'day', focusKey: 'today', clientId },
    now
  )
}

/**
 * Whether a non-default focus is set (`non_default_focus_exists?`): true unless
 * the effective focus is today's day.
 */
export function nonDefaultFocusExists(
  doc: CurrentFocusDoc | null | undefined,
  today: string = todayKey()
): boolean {
  const focus = currentFocus(doc, today)
  return !(focus.focusType === 'day' && focus.focusKey === today)
}
