import { createEntityStore } from '@interop/was-react'
import type { WebLinkDoc } from '@/types/domain'

export const useWebLinks = createEntityStore<WebLinkDoc>('webLinks')
