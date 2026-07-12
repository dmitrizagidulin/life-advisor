import { createEntityStore } from '@interop/was-react'
import type { ProjectDoc } from '@/types/domain'

export const useProjects = createEntityStore<ProjectDoc>('projects')
