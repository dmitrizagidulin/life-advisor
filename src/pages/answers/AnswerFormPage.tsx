/**
 * Answer new/edit form (ports `answers#new` / `#edit`). Answers are usually added
 * inline on the question-show screen; this standalone form takes the parent
 * question id from a `?question=<id>` query param on new.
 */
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { createAnswer } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useAnswers } from '@/stores/entities/answers'

export function AnswerFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const existing = useAnswers((s) => (id ? s.byId.get(id) : undefined))
  const insert = useAnswers((s) => s.insert)
  const update = useAnswers((s) => s.update)

  const questionId = existing?.parentKey ?? search.get('question') ?? ''
  const [name, setName] = useState(existing?.name ?? '')

  if (mode === 'edit' && !existing) {
    return <Typography>Answer not found.</Typography>
  }

  async function save() {
    if (name.trim() === '') {
      return
    }
    if (mode === 'new') {
      await insert(
        createAnswer({
          name: name.trim(),
          parentKey: questionId,
          deviceId: getDeviceId()
        })
      )
    } else {
      await update({ ...existing!, name: name.trim(), updatedAt: nowIso() })
    }
    navigate(questionId ? `/questions/${questionId}` : '/questions')
  }

  return (
    <Box data-testid="answer-form-page" sx={{ maxWidth: 520 }}>
      <Typography variant="h5" gutterBottom>
        {mode === 'new' ? 'New Answer' : 'Edit Answer'}
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Answer"
          multiline
          minRows={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'answer-name-input' } }}
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => void save()}
            data-testid="save-answer"
          >
            Save
          </Button>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
