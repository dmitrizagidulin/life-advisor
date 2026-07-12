/**
 * A table of projects (ports `projects/_projects_list` + `_project`): completion
 * counts, next action, status-machine buttons, elapsed hours, bump and delete.
 * Reused by the projects index and the completed/canceled status lists.
 */
import { useMemo } from 'react'
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
import { bump, changeStatus, nextAction, timeElapsed } from '@/domain/projects'
import { useProjects } from '@/stores/entities/projects'
import { useActionItems } from '@/stores/entities/actionItems'
import { AREA_COLORS } from '@/themes/theme'
import type { ActionItemDoc, ProjectDoc } from '@/types/domain'

/** Stable empty slice for a project with no action items. */
const NO_ITEMS: ActionItemDoc[] = []

export function ProjectListTable({ projects }: { projects: ProjectDoc[] }) {
  const update = useProjects((s) => s.update)
  const remove = useProjects((s) => s.remove)
  const allItems = useActionItems(useShallow((s) => [...s.byId.values()]))

  // Bucket every project's action items once (O(N)) so each row derives its
  // items and next action from its slice, not from a per-project rescan.
  const itemsByProject = useMemo(() => {
    const buckets = new Map<string, ActionItemDoc[]>()
    for (const item of allItems) {
      if (item.parentType !== 'project' || item.parentKey == null) {
        continue
      }
      const bucket = buckets.get(item.parentKey)
      if (bucket) {
        bucket.push(item)
      } else {
        buckets.set(item.parentKey, [item])
      }
    }
    return buckets
  }, [allItems])

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
          const items = itemsByProject.get(project.id) ?? NO_ITEMS
          const done = items.filter((i) => i.done).length
          const next = nextAction(project, items)
          const elapsed = timeElapsed(items)
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
                {elapsed > 0 ? `${elapsed} h` : ''}
              </TableCell>
              <TableCell>{project.bumpCount > 0 ? project.bumpCount : ''}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => void update(bump(project))}
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
