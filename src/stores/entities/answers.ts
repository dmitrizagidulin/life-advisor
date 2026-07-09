import { createEntityStore } from './createEntityStore'
import type { AnswerDoc } from '@/types/domain'

export const useAnswers = createEntityStore<AnswerDoc>('answers')
