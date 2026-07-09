/**
 * Goals index (ports `goals#index`): a new-goal box and the Active / Inactive /
 * Accomplished groups from the domain `splitGoals`.
 */
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link as RouterLink } from 'react-router'
import {
  Box,
  Button,
  Link,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { createGoal } from '@/domain/factories'
import { splitGoals } from '@/domain/goals'
import { getDeviceId } from '@/stores/storageManager'
import { useGoals } from '@/stores/entities/goals'
import type { GoalDoc } from '@/types/domain'

function GoalGroup({ title, goals }: { title: string; goals: GoalDoc[] }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6">{title}</Typography>
      {goals.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None.
        </Typography>
      ) : (
        goals.map((g) => (
          <Typography key={g.id} data-testid="goal-row">
            <Link component={RouterLink} to={`/goals/${g.id}`}>
              {g.name}
            </Link>
          </Typography>
        ))
      )}
    </Box>
  )
}

export function GoalsIndexPage() {
  const goals = useGoals(useShallow((s) => [...s.byId.values()]))
  const insert = useGoals((s) => s.insert)
  const [name, setName] = useState('')
  const groups = splitGoals(goals)

  async function add() {
    if (name.trim() === '') {
      return
    }
    await insert(createGoal({ name: name.trim(), deviceId: getDeviceId() }))
    setName('')
  }

  return (
    <Box data-testid="goals-index-page">
      <Typography variant="h4" gutterBottom>
        Life Goals
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="New goal"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void add()
            }
          }}
          slotProps={{ htmlInput: { 'data-testid': 'new-goal-input' } }}
        />
        <Button
          variant="contained"
          onClick={() => void add()}
          data-testid="add-goal"
        >
          Add Goal
        </Button>
      </Stack>
      <GoalGroup title="Active Goals" goals={groups.active} />
      <GoalGroup title="Inactive Goals" goals={groups.inactive} />
      <GoalGroup title="Accomplished Goals" goals={groups.accomplished} />
    </Box>
  )
}
