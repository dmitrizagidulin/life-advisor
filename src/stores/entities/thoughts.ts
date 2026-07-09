import { createEntityStore } from './createEntityStore'
import type { ThoughtDoc } from '@/types/domain'

export const useThoughts = createEntityStore<ThoughtDoc>('thoughts')
