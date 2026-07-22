/**
 * Web link new/edit form: url, name, and
 * description. New standalone links default onto today's day parent.
 */
import { useState } from 'react'
import { TextField } from '@mui/material'
import { createWebLink } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getClientId } from '@interop/was-react'
import { useWebLinks } from '@/stores/entities/webLinks'
import {
  EntityFormShell,
  commitEntity,
  useEntityForm
} from '@/components/EntityFormShell'
import { NotFound } from '@/components/NotFound'

export function WebLinkFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { existing, insert, update, navigate, notFound } = useEntityForm(
    useWebLinks,
    mode
  )

  const [url, setUrl] = useState(existing?.url ?? '')
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')

  if (notFound) {
    return <NotFound label="Web link" />
  }

  async function save() {
    if (url.trim() === '' && name.trim() === '') {
      return
    }
    await commitEntity({
      mode,
      insert,
      update,
      buildNew: () =>
        createWebLink({
          url: url.trim(),
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          clientId: getClientId()
        }),
      buildEdit: () => ({
        ...existing!,
        url: url.trim(),
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        updatedAt: nowIso()
      })
    })
    navigate('/web-links')
  }

  return (
    <EntityFormShell
      testId="web-link-form-page"
      title={mode === 'new' ? 'New Web Link' : 'Edit Web Link'}
      saveTestId="save-weblink"
      onSave={() => void save()}
      onCancel={() => navigate(-1)}
    >
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
    </EntityFormShell>
  )
}
