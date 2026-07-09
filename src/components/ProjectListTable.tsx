/**
 * A table of projects (ports `projects/_projects_list` + `_project`): completion
 * counts, next action, status-machine buttons, elapsed hours, bump and delete.
 * Reused by the projects index and the completed/canceled status lists.
 */
import { Link as RouterLink } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import {
  Button,
  IconButton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { changeStatus, nextAction, timeElapsed } from '@/domain/projects'
import { nowIso } from '@/lib/dates'
import { useProjects } from '@/stores/entities/projects'
import { useActionItems } from '@/stores/entities/actionItems'
import { AREA_COLORS } from '@/themes/theme'
import type { ProjectDoc } from '@/types/domain'

export function ProjectListTable({ projects }: { projects: ProjectDoc[] }) {
  const update = useProjects((s) => s.update)
  const remove = useProjects((s) => s.remove)
  const allItems = useActionItems(useShallow((s) => [...s.byId.values()]))

  if (projects.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        None.
      </Typography>
    )
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Done</TableCell>
          <TableCell>Project</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Elapsed</TableCell>
          <TableCell>Bumps</TableCell>
          <TableCell align="right" />
        </TableRow>
      </TableHead>
      <TableBody>
        {projects.map((project) => {
          const items = allItems.filter(
            (i) => i.parentType === 'project' && i.parentKey === project.id
          )
          const done = items.filter((i) => i.done).length
          const next = nextAction(project, allItems)
          return (
            <TableRow key={project.id} data-testid="project-row" data-project-name={project.name}>
              <TableCell>
                {items.length > 0 ? `${done} / ${items.length}` : '-'}
              </TableCell>
              <TableCell>
                <Link
                  component={RouterLink}
                  to={`/projects/${project.id}`}
                  sx={{ color: AREA_COLORS[project.area], fontWeight: 600 }}
                >
                  {project.name}
                </Link>
                {next && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Next: {next.name}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Button
                  size="small"
                  data-testid={`project-status-to-active-${project.id}`}
                  onClick={() =>
                    void update(changeStatus(project, 'active'))
                  }
                  disabled={project.status === 'active'}
                >
                  Focus
                </Button>
              </TableCell>
              <TableCell>
                {timeElapsed(items) > 0 ? `${timeElapsed(items)} h` : ''}
              </TableCell>
              <TableCell>{project.bumpCount > 0 ? project.bumpCount : ''}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      void update({
                        ...project,
                        bumpCount: project.bumpCount + 1,
                        updatedAt: nowIso()
                      })
                    }
                    data-testid="bump-project"
                  >
                    Bump!
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => void remove(project.id)}
                    data-testid="delete-project"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
