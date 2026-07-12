/**
 * Goal detail (ports `goals#show`): parent goal, active/accomplished flags, an
 * add-sub-goal box, the sub-goals list (domain `subGoals`), and the projects
 * serving this goal (domain `goalProjects`).
 */
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link as RouterLink, useParams } from 'react-router'
import { Box, Button, Link, Stack, TextField, Typography } from '@mui/material'
import { createGoal } from '@/domain/factories'
import { subGoals } from '@/domain/goals'
import { goalProjects } from '@/domain/queries'
import { compareProjects } from '@/domain/sort'
import { getDeviceId } from '@/stores/storageManager'
import { useGoals } from '@/stores/entities/goals'
import { useProjects } from '@/stores/entities/projects'
import { ProjectListTable } from '@/components/ProjectListTable'
import { EntityShowHeader } from '@/components/EntityShowHeader'
import { NotFound } from '@/components/NotFound'

export function GoalShowPage() {
  const { id } = useParams()
  const goal = useGoals((s) => (id ? s.byId.get(id) : undefined))
  const allGoals = useGoals(useShallow((s) => [...s.byId.values()]))
  const insert = useGoals((s) => s.insert)
  const projects = useProjects(useShallow((s) => [...s.byId.values()]))
  const [subName, setSubName] = useState('')

  if (!goal) {
    return <NotFound label="Goal" />
  }

  const parent =
    goal.parentType === 'goal' && goal.parentKey
      ? allGoals.find((g) => g.id === goal.parentKey)
      : undefined
  const children = subGoals(allGoals, goal.id)
  const serving = goalProjects(projects, goal.id).sort(compareProjects)

  async function addSubGoal() {
    if (subName.trim() === '') {
      return
    }
    await insert(
      createGoal({
        name: subName.trim(),
        parentType: 'goal',
        parentKey: goal!.id,
        deviceId: getDeviceId()
      })
    )
    setSubName('')
  }

  return (
    <Box data-testid="goal-show-page">
      <EntityShowHeader
        backTo="/goals"
        backLabel="List"
        editTo={`/goals/${goal.id}/edit`}
      />
      <Typography variant="h4">{goal.name}</Typography>
      <Stack spacing={0.5} sx={{ my: 2 }}>
        <Typography>
          Parent Goal:{' '}
          {parent ? (
            <Link component={RouterLink} to={`/goals/${parent.id}`}>
              {parent.name}
            </Link>
          ) : (
            'none'
          )}
        </Typography>
        {goal.description && (
          <Typography>Description: {goal.description}</Typography>
        )}
        <Typography>Active: {goal.active ? 'Yes' : 'No'}</Typography>
        <Typography>Accomplished: {goal.accomplished ? 'Yes' : 'No'}</Typography>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          size="small"
          label="New sub-goal"
          value={subName}
          onChange={(e) => setSubName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'new-subgoal-input' } }}
        />
        <Button
          variant="outlined"
          onClick={() => void addSubGoal()}
          data-testid="add-subgoal"
        >
          Add Sub-Goal
        </Button>
      </Stack>

      <Typography variant="h6">Sub Goals</Typography>
      {children.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None.
        </Typography>
      ) : (
        children.map((g) => (
          <Typography key={g.id}>
            <Link component={RouterLink} to={`/goals/${g.id}`}>
              {g.name}
            </Link>
          </Typography>
        ))
      )}

      <Typography variant="h6" sx={{ mt: 2 }}>
        Projects For Goal
      </Typography>
      <ProjectListTable projects={serving} />
    </Box>
  )
}
