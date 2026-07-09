import { createEntityStore } from './createEntityStore'
import type { QuestionDoc } from '@/types/domain'

export const useQuestions = createEntityStore<QuestionDoc>('questions')
