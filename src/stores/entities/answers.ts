import { createEntityStore } from '@interop/was-react'
import type { AnswerDoc } from '@/types/domain'

export const useAnswers = createEntityStore<AnswerDoc>('answers')
