/**
 * Entity factories applying the ported Rails property defaults. Each takes the
 * required user fields plus a `deviceId` (the LWW tiebreak), and injectable
 * `now`/`id` for deterministic tests. Web links and thoughts default onto
 * today's virtual day parent.
 */
import { nowIso, todayKey } from '@/lib/dates'
import { uuidv7 } from 'uuidv7'
import type {
  ActionItemDoc,
  AnswerDoc,
  CurrentFocusDoc,
  GoalDoc,
  ProjectDoc,
  QuestionDoc,
  ThoughtDoc,
  WebLinkDoc
} from '@/types/domain'
import { enforceDefaultDayParent } from './parent'
import { changeStatus } from './projects'

export function createActionItem(
  input: Partial<ActionItemDoc> & { name: string; deviceId: string },
  now: string = nowIso(),
  id: string = uuidv7()
): ActionItemDoc {
  return {
    id,
    name: input.name,
    done: input.done ?? false,
    mywnCategory: input.mywnCategory ?? 'someday',
    completedAt: input.completedAt ?? null,
    description: input.description,
    area: input.area ?? 'admin',
    timeElapsed: input.timeElapsed ?? 0,
    bumpCount: input.bumpCount ?? 0,
    parentType: input.parentType,
    parentKey: input.parentKey,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deviceId: input.deviceId
  }
}

export function createProject(
  input: Partial<ProjectDoc> & { name: string; deviceId: string },
  now: string = nowIso(),
  id: string = uuidv7()
): ProjectDoc {
  const status = input.status ?? 'idea'
  const base: ProjectDoc = {
    id,
    name: input.name,
    description: input.description,
    url: input.url,
    status,
    completedAt: input.completedAt ?? null,
    canceledAt: input.canceledAt ?? null,
    area: input.area ?? 'admin',
    bumpCount: input.bumpCount ?? 0,
    goalIds: input.goalIds ?? [],
    parentType: input.parentType,
    parentKey: input.parentKey,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deviceId: input.deviceId
  }
  // Route the initial status through the status machine so a project created
  // as completed/canceled gets the right timestamps stamped (and cleared),
  // rather than persisting with a null completedAt/canceledAt.
  return changeStatus(base, status, base.updatedAt)
}

export function createGoal(
  input: Partial<GoalDoc> & { name: string; deviceId: string },
  now: string = nowIso(),
  id: string = uuidv7()
): GoalDoc {
  return {
    id,
    name: input.name,
    description: input.description,
    active: input.active ?? true,
    accomplished: input.accomplished ?? false,
    bumpCount: input.bumpCount ?? 0,
    parentType: input.parentType,
    parentKey: input.parentKey,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deviceId: input.deviceId
  }
}

export function createQuestion(
  input: Partial<QuestionDoc> & { name: string; deviceId: string },
  now: string = nowIso(),
  id: string = uuidv7()
): QuestionDoc {
  return {
    id,
    name: input.name,
    answered: input.answered ?? false,
    answeredAt: input.answeredAt ?? null,
    description: input.description,
    bumpCount: input.bumpCount ?? 0,
    parentType: input.parentType,
    parentKey: input.parentKey,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deviceId: input.deviceId
  }
}

export function createAnswer(
  input: Partial<AnswerDoc> & { parentKey: string; deviceId: string },
  now: string = nowIso(),
  id: string = uuidv7()
): AnswerDoc {
  return {
    id,
    name: input.name,
    description: input.description,
    parentType: 'question',
    parentKey: input.parentKey,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deviceId: input.deviceId
  }
}

export function createWebLink(
  input: Partial<WebLinkDoc> & { url: string; deviceId: string },
  now: string = nowIso(),
  id: string = uuidv7(),
  today: string = todayKey()
): WebLinkDoc {
  const base: WebLinkDoc = {
    id,
    name: input.name,
    url: input.url,
    description: input.description,
    parentType: input.parentType ?? 'day',
    parentKey: input.parentKey ?? 'today',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deviceId: input.deviceId
  }
  return enforceDefaultDayParent(base, today)
}

export function createThought(
  input: Partial<ThoughtDoc> & { name: string; deviceId: string },
  now: string = nowIso(),
  id: string = uuidv7(),
  today: string = todayKey()
): ThoughtDoc {
  const base: ThoughtDoc = {
    id,
    name: input.name,
    parentType: input.parentType ?? 'day',
    parentKey: input.parentKey ?? 'today',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deviceId: input.deviceId
  }
  return enforceDefaultDayParent(base, today)
}

export function createCurrentFocus(
  input: {
    focusType: CurrentFocusDoc['focusType']
    focusKey: string
    deviceId: string
    createdAt?: string
    updatedAt?: string
  },
  now: string = nowIso()
): CurrentFocusDoc {
  return {
    id: '_current_focus',
    focusType: input.focusType,
    focusKey: input.focusKey,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deviceId: input.deviceId
  }
}
