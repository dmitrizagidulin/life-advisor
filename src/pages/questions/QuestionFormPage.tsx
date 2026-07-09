/**
 * Question new/edit form (ports `questions#new` / `#edit`): name and description.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { createQuestion } from '@/domain/factories'
import { nowIso } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useQuestions } from '@/stores/entities/questions'

export function QuestionFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useQuestions((s) => (id ? s.byId.get(id) : undefined))
  const insert = useQuestions((s) => s.insert)
  const update = useQuestions((s) => s.update)

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')

  if (mode === 'edit' && !existing) {
    return <Typography>Question not found.</Typography>
  }

  async function save() {
    if (name.trim() === '') {
      return
    }
    if (mode === 'new') {
      const question = createQuestion({
        name: name.trim(),
        description: description.trim() || undefined,
        deviceId: getDeviceId()
      })
      await insert(question)
      navigate(`/questions/${question.id}`)
      return
    }
    await update({
      ...existing!,
      name: name.trim(),
      description: description.trim() || undefined,
      updatedAt: nowIso()
    })
    navigate(`/questions/${existing!.id}`)
  }

  return (
    <Box data-testid="question-form-page" sx={{ maxWidth: 520 }}>
      <Typography variant="h5" gutterBottom>
        {mode === 'new' ? 'New Question' : 'Edit Question'}
      </Typography>
      <Stack spacing={2}>
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
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => void save()}
            data-testid="save-question"
          >
            Save
          </Button>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
