import { createEntityStore } from './createEntityStore'
import type { ActionItemDoc } from '@/types/domain'

export const useActionItems = createEntityStore<ActionItemDoc>('actionItems')
