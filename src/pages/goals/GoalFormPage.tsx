/**
 * Goal new/edit form (ports `goals#new` / `#edit`): name, description, and the
 * active / accomplished flags.
 */
import { useState } from 'react'
import { Checkbox, FormControlLabel, TextField } from '@mui/material'
import { createGoal } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useGoals } from '@/stores/entities/goals'
import {
  EntityFormShell,
  commitEntity,
  useEntityForm
} from '@/components/EntityFormShell'
import { NotFound } from '@/components/NotFound'

export function GoalFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { existing, insert, update, navigate, notFound } = useEntityForm(
    useGoals,
    mode
  )

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [active, setActive] = useState(existing?.active ?? true)
  const [accomplished, setAccomplished] = useState(
    existing?.accomplished ?? false
  )

  if (notFound) {
    return <NotFound label="Goal" />
  }

  async function save() {
    if (name.trim() === '') {
      return
    }
    const saved = await commitEntity({
      mode,
      insert,
      update,
      buildNew: () =>
        createGoal({
          name: name.trim(),
          description: description.trim() || undefined,
          active,
          accomplished,
          deviceId: getDeviceId()
        }),
      buildEdit: () => ({
        ...existing!,
        name: name.trim(),
        description: description.trim() || undefined,
        active,
        accomplished,
        updatedAt: nowIso()
      })
    })
    navigate(`/goals/${saved.id}`)
  }

  return (
    <EntityFormShell
      testId="goal-form-page"
      title={mode === 'new' ? 'New Goal' : 'Edit Goal'}
      saveTestId="save-goal"
      onSave={() => void save()}
      onCancel={() => navigate(-1)}
    >
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
    </EntityFormShell>
  )
}
