import { createEntityStore } from '@interop/was-react'
import type { QuestionDoc } from '@/types/domain'

export const useQuestions = createEntityStore<QuestionDoc>('questions')
