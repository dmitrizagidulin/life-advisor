/**
 * Thought new/edit form (ports `thoughts#new` / `#edit`). A new thought defaults
 * onto today's day parent via the thought factory.
 */
import { useState } from 'react'
import { TextField } from '@mui/material'
import { createThought } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useThoughts } from '@/stores/entities/thoughts'
import {
  EntityFormShell,
  commitEntity,
  useEntityForm
} from '@/components/EntityFormShell'
import { NotFound } from '@/components/NotFound'

export function ThoughtFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { existing, insert, update, navigate, notFound } = useEntityForm(
    useThoughts,
    mode
  )
  const [name, setName] = useState(existing?.name ?? '')

  if (notFound) {
    return <NotFound label="Thought" />
  }

  async function save() {
    if (name.trim() === '') {
      return
    }
    await commitEntity({
      mode,
      insert,
      update,
      buildNew: () => createThought({ name: name.trim(), deviceId: getDeviceId() }),
      buildEdit: () => ({ ...existing!, name: name.trim(), updatedAt: nowIso() })
    })
    navigate('/thoughts')
  }

  return (
    <EntityFormShell
      testId="thought-form-page"
      title={mode === 'new' ? 'New Thought' : 'Edit Thought'}
      saveTestId="save-thought"
      onSave={() => void save()}
      onCancel={() => navigate(-1)}
    >
      <TextField
        label="Thought"
        multiline
        minRows={2}
        value={name}
        onChange={(e) => setName(e.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'thought-name-input' } }}
      />
    </EntityFormShell>
  )
}
