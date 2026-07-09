/**
 * Project new/edit form (ports `projects#new` / `#edit`). Status changes here go
 * through the domain `changeStatus` so completed/canceled timestamps stay
 * consistent with the status buttons.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { PROJECT_STATUS } from '@/types/domain'
import { createProject } from '@/domain/factories'
import { changeStatus } from '@/domain/projects'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useProjects } from '@/stores/entities/projects'
import { AreaSelect } from '@/components/AreaSelect'
import type { Area, ProjectStatus } from '@/types/domain'

export function ProjectFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useProjects((s) => (id ? s.byId.get(id) : undefined))
  const insert = useProjects((s) => s.insert)
  const update = useProjects((s) => s.update)

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [url, setUrl] = useState(existing?.url ?? '')
  const [status, setStatus] = useState<ProjectStatus>(existing?.status ?? 'idea')
  const [area, setArea] = useState<Area>(existing?.area ?? 'admin')

  if (mode === 'edit' && !existing) {
    return <Typography>Project not found.</Typography>
  }

  async function save() {
    if (name.trim() === '') {
      return
    }
    if (mode === 'new') {
      const project = createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        url: url.trim() || undefined,
        status,
        area,
        deviceId: getDeviceId()
      })
      await insert(project)
      navigate(`/projects/${project.id}`)
      return
    }
    const base = {
      ...existing!,
      name: name.trim(),
      description: description.trim() || undefined,
      url: url.trim() || undefined,
      area,
      updatedAt: nowIso()
    }
    const next =
      status !== existing!.status ? changeStatus(base, status) : base
    await update(next)
    navigate(`/projects/${existing!.id}`)
  }

  return (
    <Box data-testid="project-form-page" sx={{ maxWidth: 520 }}>
      <Typography variant="h5" gutterBottom>
        {mode === 'new' ? 'New Project' : 'Edit Project'}
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'project-name-input' } }}
        />
        <TextField
          label="Description"
          multiline
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          label="URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <TextField
          select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
        >
          {PROJECT_STATUS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <AreaSelect value={area} onChange={setArea} size="medium" />
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => void save()}
            data-testid="save-project"
          >
            Save
          </Button>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
