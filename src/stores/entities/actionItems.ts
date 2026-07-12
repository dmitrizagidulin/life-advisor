import { createEntityStore } from '@interop/was-react'
import type { ActionItemDoc } from '@/types/domain'

export const useActionItems = createEntityStore<ActionItemDoc>('actionItems')
