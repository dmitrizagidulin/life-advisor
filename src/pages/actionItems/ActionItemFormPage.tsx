/**
 * Action item new/edit form (ports `action_items#new` / `#edit`). On save the
 * `enforceCompletedAt` guard stamps a completion time when an item is marked done
 * without one, matching the Rails `before_update`.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { MYWN_CATEGORIES } from '@/types/domain'
import { createActionItem, createWebLink } from '@/domain/factories'
import { enforceCompletedAt } from '@/domain/actionItems'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useActionItems } from '@/stores/entities/actionItems'
import { useWebLinks } from '@/stores/entities/webLinks'
import { AreaSelect } from '@/components/AreaSelect'
import type { Area, MywnCategory } from '@/types/domain'

export function ActionItemFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useActionItems((s) => (id ? s.byId.get(id) : undefined))
  const insert = useActionItems((s) => s.insert)
  const update = useActionItems((s) => s.update)
  const insertLink = useWebLinks((s) => s.insert)

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [category, setCategory] = useState<MywnCategory>(
    existing?.mywnCategory ?? 'someday'
  )
  const [area, setArea] = useState<Area>(existing?.area ?? 'admin')
  const [done, setDone] = useState(existing?.done ?? false)
  const [timeElapsed, setTimeElapsed] = useState(
    String(existing?.timeElapsed ?? 0)
  )
  const [url, setUrl] = useState('')

  if (mode === 'edit' && !existing) {
    return <Typography>Action item not found.</Typography>
  }

  async function save() {
    if (name.trim() === '') {
      return
    }
    const hours = Number(timeElapsed) || 0
    if (mode === 'new') {
      const item = createActionItem({
        name: name.trim(),
        description: description.trim() || undefined,
        mywnCategory: category,
        area,
        done,
        timeElapsed: hours,
        deviceId: getDeviceId()
      })
      const guarded = enforceCompletedAt(item)
      await insert(guarded)
      if (url.trim() !== '') {
        await insertLink(
          createWebLink({
            url: url.trim(),
            parentType: 'action_item',
            parentKey: guarded.id,
            deviceId: getDeviceId()
          })
        )
      }
      navigate(`/action-items/${guarded.id}`)
      return
    }
    const next = enforceCompletedAt({
      ...existing!,
      name: name.trim(),
      description: description.trim() || undefined,
      mywnCategory: category,
      area,
      done,
      timeElapsed: hours,
      updatedAt: nowIso()
    })
    await update(next)
    navigate(`/action-items/${existing!.id}`)
  }

  return (
    <Box data-testid="action-item-form-page" sx={{ maxWidth: 520 }}>
      <Typography variant="h5" gutterBottom>
        {mode === 'new' ? 'New Action Item' : 'Edit Action Item'}
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'item-name-input' } }}
        />
        <TextField
          label="Description"
          multiline
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as MywnCategory)}
        >
          {MYWN_CATEGORIES.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <AreaSelect value={area} onChange={setArea} size="medium" />
        <TextField
          label="Elapsed (hrs)"
          type="number"
          value={timeElapsed}
          onChange={(e) => setTimeElapsed(e.target.value)}
        />
        {mode === 'new' && (
          <TextField
            label="url (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
        <FormControlLabel
          control={
            <Checkbox checked={done} onChange={(e) => setDone(e.target.checked)} />
          }
          label="Done"
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => void save()}
            data-testid="save-item"
          >
            Save
          </Button>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
