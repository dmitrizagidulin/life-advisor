/**
 * A list of questions with bump / edit / delete (ports `questions/_list`), reused
 * by the questions index and the project-show screen. Rendered in the caller's
 * chosen sort order. Question bump mirrors the Rails `Question#bump!` (a plain
 * count increment; there is no dedicated domain helper for it).
 */
import { Link as RouterLink } from 'react-router'
import { Box, Button, IconButton, Link, Stack, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { nowIso } from '@/lib/dates'
import { useQuestions } from '@/stores/entities/questions'
import type { QuestionDoc } from '@/types/domain'

export function QuestionList({ questions }: { questions: QuestionDoc[] }) {
  const update = useQuestions((s) => s.update)
  const remove = useQuestions((s) => s.remove)

  if (questions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No questions.
      </Typography>
    )
  }

  return (
    <Box data-testid="question-list">
      {questions.map((q) => (
        <Stack
          key={q.id}
          direction="row"
          spacing={1}
          sx={{
            py: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            alignItems: 'center'
          }}
          data-testid="question-row"
        >
          <Link
            component={RouterLink}
            to={`/questions/${q.id}`}
            sx={{ flexGrow: 1 }}
          >
            {q.name}
          </Link>
          {q.bumpCount > 0 && (
            <Typography variant="caption">bumps: {q.bumpCount}</Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              void update({
                ...q,
                bumpCount: q.bumpCount + 1,
                updatedAt: nowIso()
              })
            }
            data-testid="bump-question"
          >
            Bump!
          </Button>
          <IconButton
            size="small"
            component={RouterLink}
            to={`/questions/${q.id}/edit`}
            data-testid="edit-question"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => void remove(q.id)}
            data-testid="delete-question"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
    </Box>
  )
}
