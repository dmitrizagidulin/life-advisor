import { createEntityStore } from './createEntityStore'
import type { WebLinkDoc } from '@/types/domain'

export const useWebLinks = createEntityStore<WebLinkDoc>('webLinks')
