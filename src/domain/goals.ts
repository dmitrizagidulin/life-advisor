/**
 * Goal domain selectors, ported from the Rails Goal model and goals controller.
 */
import type { GoalDoc } from '@/types/domain'
import { compareGoals } from './sort'
import { forParent } from './parent'

/** Sub-goals of `goalId` (children with `parentType: 'goal'`), createdAt DESC. */
export function subGoals(goals: GoalDoc[], goalId: string): GoalDoc[] {
  return forParent(goals, 'goal', goalId)
}

/**
 * The goals-index split: `active` = active and not accomplished (sorted by the
 * goal comparator), `accomplished` = accomplished, `inactive` = neither active
 * nor accomplished.
 */
export function splitGoals(goals: GoalDoc[]): {
  active: GoalDoc[]
  accomplished: GoalDoc[]
  inactive: GoalDoc[]
} {
  return {
    active: goals
      .filter((g) => g.active && !g.accomplished)
      .sort(compareGoals),
    accomplished: goals.filter((g) => g.accomplished),
    inactive: goals.filter((g) => !g.active && !g.accomplished)
  }
}
