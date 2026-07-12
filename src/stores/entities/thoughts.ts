import { createEntityStore } from '@interop/was-react'
import type { ThoughtDoc } from '@/types/domain'

export const useThoughts = createEntityStore<ThoughtDoc>('thoughts')
