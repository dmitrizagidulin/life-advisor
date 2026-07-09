/**
 * Thought detail (ports `thoughts#show`): the thought text and its day parent.
 */
import { Link as RouterLink, useParams } from 'react-router'
import { Box, Button, Stack, Typography } from '@mui/material'
import { useThoughts } from '@/stores/entities/thoughts'

export function ThoughtShowPage() {
  const { id } = useParams()
  const thought = useThoughts((s) => (id ? s.byId.get(id) : undefined))

  if (!thought) {
    return <Typography>Thought not found.</Typography>
  }

  return (
    <Box data-testid="thought-show-page">
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Button component={RouterLink} to="/thoughts" size="small">
          &lt; Thoughts
        </Button>
        <Button
          component={RouterLink}
          to={`/thoughts/${thought.id}/edit`}
          size="small"
        >
          Edit
        </Button>
      </Stack>
      <Typography variant="h5">{thought.name}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Day: {thought.parentKey}
      </Typography>
    </Box>
  )
}
