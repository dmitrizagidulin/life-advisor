/**
 * The completed / canceled project lists. The status comes from the route.
 */
import { Box, Typography } from '@mui/material'
import { useShallow } from 'zustand/react/shallow'
import { allForStatus } from '@/domain/queries'
import { compareProjects } from '@/domain/sort'
import { useProjects } from '@/stores/entities/projects'
import { ProjectListTable } from '@/components/ProjectListTable'
import type { ProjectStatus } from '@/types/domain'

export function ProjectsStatusPage({ status }: { status: ProjectStatus }) {
  const projects = useProjects(useShallow((s) =>
    allForStatus([...s.byId.values()], status).sort(compareProjects)
  ))
  return (
    <Box data-testid={`projects-${status}-page`}>
      <Typography variant="h4" gutterBottom>
        {status.charAt(0).toUpperCase() + status.slice(1)} Projects
      </Typography>
      <ProjectListTable projects={projects} />
    </Box>
  )
}
