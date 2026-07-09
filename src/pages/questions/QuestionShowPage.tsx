/**
 * Question detail (ports `questions#show`): the question, its answers with an
 * inline add-answer box, and its attached links.
 */
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link as RouterLink, useParams } from 'react-router'
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { createAnswer } from '@/domain/factories'
import { forParent } from '@/domain/parent'
import { getDeviceId } from '@/stores/storageManager'
import { useQuestions } from '@/stores/entities/questions'
import { useAnswers } from '@/stores/entities/answers'
import { LinksTable } from '@/components/LinksTable'

export function QuestionShowPage() {
  const { id } = useParams()
  const question = useQuestions((s) => (id ? s.byId.get(id) : undefined))
  const answers = useAnswers(useShallow((s) =>
    id ? forParent([...s.byId.values()], 'question', id) : []
  ))
  const insertAnswer = useAnswers((s) => s.insert)
  const removeAnswer = useAnswers((s) => s.remove)
  const [answerText, setAnswerText] = useState('')

  if (!question) {
    return <Typography>Question not found.</Typography>
  }

  async function addAnswer() {
    if (answerText.trim() === '') {
      return
    }
    await insertAnswer(
      createAnswer({
        name: answerText.trim(),
        parentKey: question!.id,
        deviceId: getDeviceId()
      })
    )
    setAnswerText('')
  }

  return (
    <Box data-testid="question-show-page">
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Button component={RouterLink} to="/questions" size="small">
          &lt; Questions
        </Button>
        <Button
          component={RouterLink}
          to={`/questions/${question.id}/edit`}
          size="small"
        >
          Edit
        </Button>
      </Stack>
      <Typography variant="h4">{question.name}</Typography>
      {question.description && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {question.description}
        </Typography>
      )}

      <Typography variant="h6" sx={{ mt: 2 }}>
        Answers
      </Typography>
      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
        <TextField
          size="small"
          label="New answer"
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'new-answer-input' } }}
        />
        <Button
          variant="outlined"
          onClick={() => void addAnswer()}
          data-testid="add-answer"
        >
          Add Answer
        </Button>
      </Stack>
      {answers.map((a) => (
        <Stack
          key={a.id}
          direction="row"
          sx={{ alignItems: 'center' }}
          data-testid="answer-row"
        >
          <Typography sx={{ flexGrow: 1 }}>{a.name}</Typography>
          <IconButton
            size="small"
            color="error"
            onClick={() => void removeAnswer(a.id)}
            data-testid="delete-answer"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}

      <Box sx={{ mt: 2 }}>
        <LinksTable parentType="question" parentKey={question.id} />
      </Box>
    </Box>
  )
}
