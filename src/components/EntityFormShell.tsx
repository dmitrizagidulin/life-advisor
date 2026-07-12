/**
 * Shared scaffolding for the entity new/edit forms. `useEntityForm` wires up the
 * router params, the entity store CRUD verbs, and the edit-mode not-found signal;
 * `commitEntity` runs the new-vs-edit save branch; `EntityFormShell` renders the
 * common Box/Stack layout with the Save + Cancel buttons. Each page still owns its
 * own field set, trim/validation guard, save-time transforms, and navigation.
 */
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Box, Button, Stack, Typography } from '@mui/material'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { EntityStore } from '@interop/was-react'

/** Router + store wiring shared by every entity form page. */
export function useEntityForm<T extends { id: string }>(
  useStore: UseBoundStore<StoreApi<EntityStore<T>>>,
  mode: 'new' | 'edit'
) {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useStore(s => (id ? s.byId.get(id) : undefined))
  const insert = useStore(s => s.insert)
  const update = useStore(s => s.update)
  return {
    existing,
    insert,
    update,
    navigate,
    notFound: mode === 'edit' && !existing
  }
}

/**
 * Runs the new-vs-edit save branch and returns the saved doc. `buildNew` /
 * `buildEdit` produce the final document (including any domain transform), and
 * `onInserted` runs post-insert side effects (e.g. attaching a link) on new.
 */
export async function commitEntity<T extends { id: string }>(opts: {
  mode: 'new' | 'edit'
  insert: (doc: T) => Promise<void>
  update: (doc: T) => Promise<void>
  buildNew: () => T
  buildEdit: () => T
  onInserted?: (doc: T) => Promise<void>
}): Promise<T> {
  if (opts.mode === 'new') {
    const doc = opts.buildNew()
    await opts.insert(doc)
    if (opts.onInserted) {
      await opts.onInserted(doc)
    }
    return doc
  }
  const doc = opts.buildEdit()
  await opts.update(doc)
  return doc
}

export function EntityFormShell({
  testId,
  title,
  canSave = true,
  saveTestId,
  onSave,
  onCancel,
  children
}: {
  testId: string
  title: string
  canSave?: boolean
  saveTestId: string
  onSave: () => void
  onCancel: () => void
  children: ReactNode
}) {
  return (
    <Box data-testid={testId} sx={{ maxWidth: 520 }}>
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      <Stack spacing={2}>
        {children}
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={!canSave}
            data-testid={saveTestId}
          >
            Save
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
