/**
 * Action item new/edit form. On save the `enforceCompletedAt` guard stamps a
 * completion time when an item is marked done without one.
 */
import { useState } from 'react'
import {
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField
} from '@mui/material'
import { MYWN_CATEGORIES } from '@/types/domain'
import { createActionItem, createWebLink } from '@/domain/factories'
import { enforceCompletedAt } from '@/domain/actionItems'
import { nowIso } from '@/lib/dates'
import { getClientId } from '@interop/was-react'
import { useActionItems } from '@/stores/entities/actionItems'
import { useWebLinks } from '@/stores/entities/webLinks'
import { AreaSelect } from '@/components/AreaSelect'
import {
  EntityFormShell,
  commitEntity,
  useEntityForm
} from '@/components/EntityFormShell'
import { NotFound } from '@/components/NotFound'
import type { Area, MywnCategory } from '@/types/domain'

export function ActionItemFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { existing, insert, update, navigate, notFound } = useEntityForm(
    useActionItems,
    mode
  )
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

  if (notFound) {
    return <NotFound label="Action item" />
  }

  async function save() {
    if (name.trim() === '') {
      return
    }
    const hours = Number(timeElapsed) || 0
    const saved = await commitEntity({
      mode,
      insert,
      update,
      buildNew: () =>
        enforceCompletedAt(
          createActionItem({
            name: name.trim(),
            description: description.trim() || undefined,
            mywnCategory: category,
            area,
            done,
            timeElapsed: hours,
            clientId: getClientId()
          })
        ),
      buildEdit: () =>
        enforceCompletedAt({
          ...existing!,
          name: name.trim(),
          description: description.trim() || undefined,
          mywnCategory: category,
          area,
          done,
          timeElapsed: hours,
          updatedAt: nowIso()
        }),
      onInserted: async (item) => {
        if (url.trim() !== '') {
          await insertLink(
            createWebLink({
              url: url.trim(),
              parentType: 'actionItem',
              parentKey: item.id,
              clientId: getClientId()
            })
          )
        }
      }
    })
    navigate(`/action-items/${saved.id}`)
  }

  return (
    <EntityFormShell
      testId="action-item-form-page"
      title={mode === 'new' ? 'New Action Item' : 'Edit Action Item'}
      saveTestId="save-item"
      onSave={() => void save()}
      onCancel={() => navigate(-1)}
    >
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
    </EntityFormShell>
  )
}
