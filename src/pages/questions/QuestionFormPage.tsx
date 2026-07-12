/**
 * Question new/edit form (ports `questions#new` / `#edit`): name and description.
 */
import { useState } from 'react'
import { TextField } from '@mui/material'
import { createQuestion } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useQuestions } from '@/stores/entities/questions'
import {
  EntityFormShell,
  commitEntity,
  useEntityForm
} from '@/components/EntityFormShell'
import { NotFound } from '@/components/NotFound'

export function QuestionFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { existing, insert, update, navigate, notFound } = useEntityForm(
    useQuestions,
    mode
  )

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')

  if (notFound) {
    return <NotFound label="Question" />
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
        createQuestion({
          name: name.trim(),
          description: description.trim() || undefined,
          deviceId: getDeviceId()
        }),
      buildEdit: () => ({
        ...existing!,
        name: name.trim(),
        description: description.trim() || undefined,
        updatedAt: nowIso()
      })
    })
    navigate(`/questions/${saved.id}`)
  }

  return (
    <EntityFormShell
      testId="question-form-page"
      title={mode === 'new' ? 'New Question' : 'Edit Question'}
      saveTestId="save-question"
      onSave={() => void save()}
      onCancel={() => navigate(-1)}
    >
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'question-name-input' } }}
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
