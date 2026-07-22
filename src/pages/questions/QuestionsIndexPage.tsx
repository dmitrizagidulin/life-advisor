/**
 * Questions index (ports `questions#index`): a new-question box plus the
 * project-parented vs. everything-else split (`domain/questions.splitByProject`),
 * each sorted by the question comparator.
 */
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { createQuestion } from '@/domain/factories'
import { splitByProject } from '@/domain/questions'
import { compareQuestions } from '@/domain/sort'
import { getClientId } from '@interop/was-react'
import { useQuestions } from '@/stores/entities/questions'
import { QuestionList } from '@/components/QuestionList'

export function QuestionsIndexPage() {
  const questions = useQuestions(useShallow((s) => [...s.byId.values()]))
  const insert = useQuestions((s) => s.insert)
  const [name, setName] = useState('')
  const split = splitByProject(questions)

  async function add() {
    if (name.trim() === '') {
      return
    }
    await insert(createQuestion({ name: name.trim(), clientId: getClientId() }))
    setName('')
  }

  return (
    <Box data-testid="questions-index-page">
      <Typography variant="h4" gutterBottom>
        Questions
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="New question"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void add()
            }
          }}
          slotProps={{ htmlInput: { 'data-testid': 'new-question-index-input' } }}
        />
        <Button
          variant="contained"
          onClick={() => void add()}
          data-testid="add-question-index"
        >
          Add Question
        </Button>
      </Stack>

      <Typography variant="h6">Standalone Questions</Typography>
      <QuestionList
        questions={[...split.nonProject].sort(compareQuestions)}
      />

      <Typography variant="h6" sx={{ mt: 3 }}>
        Project Questions
      </Typography>
      <QuestionList questions={[...split.project].sort(compareQuestions)} />
    </Box>
  )
}
