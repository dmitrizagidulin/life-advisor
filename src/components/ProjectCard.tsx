/**
 * A compact project card for the dashboard's active-projects strip (ports
 * `projects/_active`): the project name and, when present, its next action.
 */
import { Link as RouterLink } from 'react-router'
import { Box, Link, Typography } from '@mui/material'
import { AREA_COLORS } from '@/themes/theme'
import type { ActionItemDoc, ProjectDoc } from '@/types/domain'

export function ProjectCard({
  project,
  nextAction
}: {
  project: ProjectDoc
  nextAction?: ActionItemDoc
}) {
  return (
    <Box
      sx={{
        display: 'inline-block',
        p: 1.5,
        m: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        minWidth: 180,
        verticalAlign: 'top'
      }}
      data-testid="project-card"
    >
      <Link
        component={RouterLink}
        to={`/projects/${project.id}`}
        sx={{ color: AREA_COLORS[project.area], fontWeight: 600 }}
      >
        {project.name}
      </Link>
      {nextAction && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Next: {nextAction.name}
        </Typography>
      )}
    </Box>
  )
}
