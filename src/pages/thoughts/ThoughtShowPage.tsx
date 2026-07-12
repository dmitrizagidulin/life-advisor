/**
 * Thought detail (ports `thoughts#show`): the thought text and its day parent.
 */
import { useParams } from 'react-router'
import { Box, Typography } from '@mui/material'
import { useThoughts } from '@/stores/entities/thoughts'
import { EntityShowHeader } from '@/components/EntityShowHeader'
import { NotFound } from '@/components/NotFound'

export function ThoughtShowPage() {
  const { id } = useParams()
  const thought = useThoughts((s) => (id ? s.byId.get(id) : undefined))

  if (!thought) {
    return <NotFound label="Thought" />
  }

  return (
    <Box data-testid="thought-show-page">
      <EntityShowHeader
        backTo="/thoughts"
        backLabel="Thoughts"
        editTo={`/thoughts/${thought.id}/edit`}
      />
      <Typography variant="h5">{thought.name}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Day: {thought.parentKey}
      </Typography>
    </Box>
  )
}
