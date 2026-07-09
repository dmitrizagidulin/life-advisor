/**
 * Thought new/edit form (ports `thoughts#new` / `#edit`). A new thought defaults
 * onto today's day parent via the thought factory.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { createThought } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useThoughts } from '@/stores/entities/thoughts'

export function ThoughtFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useThoughts((s) => (id ? s.byId.get(id) : undefined))
  const insert = useThoughts((s) => s.insert)
  const update = useThoughts((s) => s.update)
  const [name, setName] = useState(existing?.name ?? '')

  if (mode === 'edit' && !existing) {
    return <Typography>Thought not found.</Typography>
  }

  async function save() {
    if (name.trim() === '') {
      return
    }
    if (mode === 'new') {
      await insert(createThought({ name: name.trim(), deviceId: getDeviceId() }))
    } else {
      await update({ ...existing!, name: name.trim(), updatedAt: nowIso() })
    }
    navigate('/thoughts')
  }

  return (
    <Box data-testid="thought-form-page" sx={{ maxWidth: 520 }}>
      <Typography variant="h5" gutterBottom>
        {mode === 'new' ? 'New Thought' : 'Edit Thought'}
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Thought"
          multiline
          minRows={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'thought-name-input' } }}
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => void save()}
            data-testid="save-thought"
          >
            Save
          </Button>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
