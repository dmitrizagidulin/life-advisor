/**
 * Web link new/edit form (ports `web_links#new` / `#edit`): url, name, and
 * description. New standalone links default onto today's day parent.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { createWebLink } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useWebLinks } from '@/stores/entities/webLinks'

export function WebLinkFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useWebLinks((s) => (id ? s.byId.get(id) : undefined))
  const insert = useWebLinks((s) => s.insert)
  const update = useWebLinks((s) => s.update)

  const [url, setUrl] = useState(existing?.url ?? '')
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')

  if (mode === 'edit' && !existing) {
    return <Typography>Web link not found.</Typography>
  }

  async function save() {
    if (url.trim() === '' && name.trim() === '') {
      return
    }
    if (mode === 'new') {
      await insert(
        createWebLink({
          url: url.trim(),
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          deviceId: getDeviceId()
        })
      )
    } else {
      await update({
        ...existing!,
        url: url.trim(),
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        updatedAt: nowIso()
      })
    }
    navigate('/web-links')
  }

  return (
    <Box data-testid="web-link-form-page" sx={{ maxWidth: 520 }}>
      <Typography variant="h5" gutterBottom>
        {mode === 'new' ? 'New Web Link' : 'Edit Web Link'}
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'weblink-form-url' } }}
        />
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Description"
          multiline
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => void save()}
            data-testid="save-weblink"
          >
            Save
          </Button>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
