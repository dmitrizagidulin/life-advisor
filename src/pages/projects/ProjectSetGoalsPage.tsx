/**
 * Set-goals screen (ports `projects#set_goals` + `serve_goal_toggle`): checkboxes
 * over the active goals, toggling each in/out of the project's `goalIds` via the
 * domain `serveGoalToggle`.
 */
import { Link as RouterLink, useParams } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography
} from '@mui/material'
import { serveGoalToggle } from '@/domain/projects'
import { activeGoals } from '@/domain/queries'
import { compareGoals } from '@/domain/sort'
import { useProjects } from '@/stores/entities/projects'
import { useGoals } from '@/stores/entities/goals'
import { NotFound } from '@/components/NotFound'

export function ProjectSetGoalsPage() {
  const { id } = useParams()
  const project = useProjects((s) => (id ? s.byId.get(id) : undefined))
  const update = useProjects((s) => s.update)
  const goals = useGoals(useShallow((s) => activeGoals([...s.byId.values()]).sort(compareGoals)))

  if (!project) {
    return <NotFound label="Project" />
  }

  return (
    <Box data-testid="project-set-goals-page">
      <Typography variant="h5" gutterBottom>
        {project.name} -- Goals
      </Typography>
      <Stack>
        {goals.length === 0 ? (
          <Typography color="text.secondary">No active goals.</Typography>
        ) : (
          goals.map((goal) => (
            <FormControlLabel
              key={goal.id}
              control={
                <Checkbox
                  checked={project.goalIds.includes(goal.id)}
                  onChange={() => void update(serveGoalToggle(project, goal.id))}
                  data-testid={`serve-goal-${goal.id}`}
                />
              }
              label={goal.name}
            />
          ))
        )}
      </Stack>
      <Button
        component={RouterLink}
        to={`/projects/${project.id}`}
        variant="outlined"
        sx={{ mt: 2 }}
        data-testid="set-goals-done"
      >
        Done
      </Button>
    </Box>
  )
}
