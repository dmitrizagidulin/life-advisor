/**
 * Project new/edit form (ports `projects#new` / `#edit`). Status changes here go
 * through the domain `changeStatus` so completed/canceled timestamps stay
 * consistent with the status buttons.
 */
import { useState } from 'react'
import { MenuItem, TextField } from '@mui/material'
import { PROJECT_STATUS } from '@/types/domain'
import { createProject } from '@/domain/factories'
import { changeStatus } from '@/domain/projects'
import { nowIso } from '@/lib/dates'
import { getClientId } from '@interop/was-react'
import { useProjects } from '@/stores/entities/projects'
import { AreaSelect } from '@/components/AreaSelect'
import {
  EntityFormShell,
  commitEntity,
  useEntityForm
} from '@/components/EntityFormShell'
import { NotFound } from '@/components/NotFound'
import type { Area, ProjectStatus } from '@/types/domain'

export function ProjectFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { existing, insert, update, navigate, notFound } = useEntityForm(
    useProjects,
    mode
  )

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [url, setUrl] = useState(existing?.url ?? '')
  const [status, setStatus] = useState<ProjectStatus>(existing?.status ?? 'idea')
  const [area, setArea] = useState<Area>(existing?.area ?? 'admin')

  if (notFound) {
    return <NotFound label="Project" />
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
        createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          url: url.trim() || undefined,
          status,
          area,
          clientId: getClientId()
        }),
      buildEdit: () => {
        const base = {
          ...existing!,
          name: name.trim(),
          description: description.trim() || undefined,
          url: url.trim() || undefined,
          area,
          updatedAt: nowIso()
        }
        return status !== existing!.status ? changeStatus(base, status) : base
      }
    })
    navigate(`/projects/${saved.id}`)
  }

  return (
    <EntityFormShell
      testId="project-form-page"
      title={mode === 'new' ? 'New Project' : 'Edit Project'}
      saveTestId="save-project"
      onSave={() => void save()}
      onCancel={() => navigate(-1)}
    >
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
      <TextField label="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
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
    </EntityFormShell>
  )
}
