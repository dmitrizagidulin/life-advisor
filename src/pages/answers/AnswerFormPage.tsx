/**
 * Answer new/edit form. Answers are usually added
 * inline on the question-show screen; this standalone form takes the parent
 * question id from a `?question=<id>` query param on new.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { TextField } from '@mui/material'
import { createAnswer } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getClientId } from '@interop/was-react'
import { useAnswers } from '@/stores/entities/answers'
import {
  EntityFormShell,
  commitEntity,
  useEntityForm
} from '@/components/EntityFormShell'
import { NotFound } from '@/components/NotFound'

export function AnswerFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { existing, insert, update, navigate, notFound } = useEntityForm(
    useAnswers,
    mode
  )
  const [search] = useSearchParams()

  const questionId = existing?.parentKey ?? search.get('question') ?? ''
  const [name, setName] = useState(existing?.name ?? '')

  if (notFound) {
    return <NotFound label="Answer" />
  }

  // A new answer with no parent question would be an orphan that no
  // `forParent` filter ever matches, so block saving without one.
  const canSave = name.trim() !== '' && (mode === 'edit' || questionId !== '')

  async function save() {
    if (!canSave) {
      return
    }
    await commitEntity({
      mode,
      insert,
      update,
      buildNew: () =>
        createAnswer({
          name: name.trim(),
          parentKey: questionId,
          clientId: getClientId()
        }),
      buildEdit: () => ({ ...existing!, name: name.trim(), updatedAt: nowIso() })
    })
    navigate(questionId ? `/questions/${questionId}` : '/questions')
  }

  return (
    <EntityFormShell
      testId="answer-form-page"
      title={mode === 'new' ? 'New Answer' : 'Edit Answer'}
      canSave={canSave}
      saveTestId="save-answer"
      onSave={() => void save()}
      onCancel={() => navigate(-1)}
    >
      <TextField
        label="Answer"
        multiline
        minRows={2}
        value={name}
        onChange={(e) => setName(e.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'answer-name-input' } }}
      />
    </EntityFormShell>
  )
}
