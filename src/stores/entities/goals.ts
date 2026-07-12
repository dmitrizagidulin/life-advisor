import { createEntityStore } from '@interop/was-react'
import type { GoalDoc } from '@/types/domain'

export const useGoals = createEntityStore<GoalDoc>('goals')
