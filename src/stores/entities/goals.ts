import { createEntityStore } from './createEntityStore'
import type { GoalDoc } from '@/types/domain'

export const useGoals = createEntityStore<GoalDoc>('goals')
