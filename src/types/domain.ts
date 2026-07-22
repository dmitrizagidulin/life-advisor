/**
 * Domain entity payloads and enums. These are the shapes stored INSIDE the
 * encrypted EDV envelope (the plaintext the WAS server never sees). Treat them
 * as a shared interoperability contract: extend additively, never repurpose a
 * field.
 *
 * Enum orders are load-bearing (they drive Rails-ported sort comparators); do
 * not reorder. All timestamps are ISO-8601 strings. `id` is a `uuidv7()` logical
 * entity id -- distinct from the opaque random EDV resource id that keys the
 * at-rest row. `clientId` (random per install) is the last-write-wins tiebreak.
 */
export const MYWN_CATEGORIES = [
  'critical',
  'tomorrow',
  'opportunity',
  'horizon',
  'someday'
] as const
export const AREAS = ['work', 'soul', 'admin', 'assistant'] as const
export const PROJECT_STATUS = [
  'idea',
  'active',
  'someday',
  'canceled',
  'completed'
] as const
export const PARENT_TYPES = [
  'project',
  'day',
  'question',
  'action_item',
  'goal'
] as const

export type MywnCategory = (typeof MYWN_CATEGORIES)[number]
export type Area = (typeof AREAS)[number]
export type ProjectStatus = (typeof PROJECT_STATUS)[number]
export type ParentType = (typeof PARENT_TYPES)[number]

export interface ActionItemDoc {
  id: string
  name: string
  done: boolean // default false
  mywnCategory: MywnCategory // default 'someday'
  completedAt: string | null // set/cleared by toggleDone
  description?: string
  area: Area // default 'admin'
  timeElapsed: number // hours, default 0
  bumpCount: number // default 0
  parentType?: ParentType
  parentKey?: string
  createdAt: string
  updatedAt: string
  clientId: string // LWW tiebreak, random per install
}

export interface ProjectDoc {
  id: string
  name: string
  description?: string
  url?: string
  status: ProjectStatus // default 'idea'
  completedAt: string | null
  canceledAt: string | null
  area: Area
  bumpCount: number
  goalIds: string[] // replaces the project_goals join
  parentType?: ParentType
  parentKey?: string
  createdAt: string
  updatedAt: string
  clientId: string
}

export interface GoalDoc {
  id: string
  name: string
  description?: string
  active: boolean
  accomplished: boolean
  bumpCount: number
  parentType?: 'goal'
  parentKey?: string
  createdAt: string
  updatedAt: string
  clientId: string
}

export interface QuestionDoc {
  id: string
  name: string
  answered: boolean
  answeredAt: string | null
  description?: string
  bumpCount: number
  parentType?: ParentType
  parentKey?: string
  createdAt: string
  updatedAt: string
  clientId: string
}

export interface AnswerDoc {
  id: string
  name?: string
  description?: string
  parentType: 'question'
  parentKey: string
  createdAt: string
  updatedAt: string
  clientId: string
}

export interface WebLinkDoc {
  id: string
  name?: string
  url: string
  description?: string
  parentType: ParentType
  parentKey: string // default: day / today
  createdAt: string
  updatedAt: string
  clientId: string
}

export interface ThoughtDoc {
  id: string
  name: string
  parentType: ParentType
  parentKey: string // default: day / today
  createdAt: string
  updatedAt: string
  clientId: string
}

export interface CurrentFocusDoc {
  id: '_current_focus' // fixed logical id
  focusType: 'project' | 'action_item' | 'goal' | 'question' | 'day'
  focusKey: string // entity uuid, or 'YYYY-MM-DD'
  createdAt: string
  updatedAt: string
  clientId: string
}
