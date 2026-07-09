import { createEntityStore } from './createEntityStore'
import type { ProjectDoc } from '@/types/domain'

export const useProjects = createEntityStore<ProjectDoc>('projects')
