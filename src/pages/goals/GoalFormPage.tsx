/**
 * Goal new/edit form (ports `goals#new` / `#edit`): name, description, and the
 * active / accomplished flags.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { createGoal } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useGoals } from '@/stores/entities/goals'

export function GoalFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useGoals((s) => (id ? s.byId.get(id) : undefined))
  const insert = useGoals((s) => s.insert)
  const update = useGoals((s) => s.update)

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [active, setActive] = useState(existing?.active ?? true)
  const [accomplished, setAccomplished] = useState(
    existing?.accomplished ?? false
  )

  if (mode === 'edit' && !existing) {
    return <Typography>Goal not found.</Typography>
  }

  async function save() {
    if (name.trim() === '') {
      return
    }
    if (mode === 'new') {
      const goal = createGoal({
        name: name.trim(),
        description: description.trim() || undefined,
        active,
        accomplished,
        deviceId: getDeviceId()
      })
      await insert(goal)
      navigate(`/goals/${goal.id}`)
      return
    }
    await update({
      ...existing!,
      name: name.trim(),
      description: description.trim() || undefined,
      active,
      accomplished,
      updatedAt: nowIso()
    })
    navigate(`/goals/${existing!.id}`)
  }

  return (
    <Box data-testid="goal-form-page" sx={{ maxWidth: 520 }}>
      <Typography variant="h5" gutterBottom>
        {mode === 'new' ? 'New Goal' : 'Edit Goal'}
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'goal-name-input' } }}
        />
        <TextField
          label="Description"
          multiline
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
          }
          label="Active"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={accomplished}
              onChange={(e) => setAccomplished(e.target.checked)}
            />
          }
          label="Accomplished"
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => void save()}
            data-testid="save-goal"
          >
            Save
          </Button>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
