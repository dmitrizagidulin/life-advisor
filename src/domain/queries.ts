/**
 * In-memory selectors replacing the Rails riak_search queries. All pure filters
 * over already-hydrated docs; callers apply the sort comparators. Ported exactly,
 * including the `admin`-also-matches-`assistant` area quirk.
 */
import type {
  ActionItemDoc,
  Area,
  GoalDoc,
  MywnCategory,
  ProjectDoc,
  ProjectStatus
} from '@/types/domain'

/** Whether an item's area matches the filter (`admin` also matches `assistant`). */
function areaMatches(itemArea: Area, filter: Area): boolean {
  if (filter === 'admin') {
    return itemArea === 'admin' || itemArea === 'assistant'
  }
  return itemArea === filter
}

/**
 * Not-done items (`all_todo`), optionally narrowed by MYWN category and area.
 * With `includeProjectItems` false, items carrying any parent key are dropped
 * (the Rails filter keys on `parent_key`, so this excludes every parented item,
 * not only project children).
 */
export function allTodo(
  items: ActionItemDoc[],
  category?: MywnCategory,
  area?: Area,
  includeProjectItems: boolean = true
): ActionItemDoc[] {
  return items.filter((item) => {
    if (item.done) {
      return false
    }
    if (category && item.mywnCategory !== category) {
      return false
    }
    if (area && !areaMatches(item.area, area)) {
      return false
    }
    if (!includeProjectItems && item.parentKey) {
      return false
    }
    return true
  })
}

/** All completed action items (`all_completed`). */
export function allCompleted(items: ActionItemDoc[]): ActionItemDoc[] {
  return items.filter((item) => item.done)
}

/** Projects with the given status (`all_for_status`). */
export function allForStatus(
  projects: ProjectDoc[],
  status: ProjectStatus
): ProjectDoc[] {
  return projects.filter((p) => p.status === status)
}

/**
 * Projects in an area at a status (`focus_on_area`). Exact area match -- the
 * `admin`/`assistant` quirk does not apply here.
 */
export function focusOnArea(
  projects: ProjectDoc[],
  area: Area,
  status: ProjectStatus = 'active'
): ProjectDoc[] {
  return projects.filter((p) => p.status === status && p.area === area)
}

/**
 * Active goals (`active_goals`): `active` is true; accomplished goals are
 * excluded unless `includeAccomplished`.
 */
export function activeGoals(
  goals: GoalDoc[],
  includeAccomplished: boolean = false
): GoalDoc[] {
  return goals.filter(
    (g) => g.active && (includeAccomplished || !g.accomplished)
  )
}

/** Projects serving a goal (`goal.goalIds.includes`). */
export function goalProjects(
  projects: ProjectDoc[],
  goalId: string
): ProjectDoc[] {
  return projects.filter((p) => p.goalIds.includes(goalId))
}
