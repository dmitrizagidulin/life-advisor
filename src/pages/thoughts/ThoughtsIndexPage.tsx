/**
 * Thoughts index (ports `thoughts#index`): the Pensieve capture box and the
 * thoughts list newest-first (createdAt DESC), each editable/deletable.
 */
import { Link as RouterLink } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import {
  Box,
  IconButton,
  Link,
  Stack,
  Typography
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { compareChildren } from '@/domain/sort'
import { useThoughts } from '@/stores/entities/thoughts'
import { NewThoughtBox } from '@/components/NewThoughtBox'

export function ThoughtsIndexPage() {
  const thoughts = useThoughts(useShallow((s) =>
    [...s.byId.values()].sort(compareChildren)
  ))
  const remove = useThoughts((s) => s.remove)

  return (
    <Box data-testid="thoughts-index-page">
      <Typography variant="h4" gutterBottom>
        Thoughts
      </Typography>
      <NewThoughtBox />
      {thoughts.length === 0 ? (
        <Typography color="text.secondary">No thoughts yet.</Typography>
      ) : (
        thoughts.map((t) => (
          <Stack
            key={t.id}
            direction="row"
            spacing={1}
            sx={{
              py: 0.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              alignItems: 'center'
            }}
            data-testid="thought-row"
          >
            <Link
              component={RouterLink}
              to={`/thoughts/${t.id}`}
              sx={{ flexGrow: 1 }}
            >
              {t.name}
            </Link>
            <IconButton
              size="small"
              component={RouterLink}
              to={`/thoughts/${t.id}/edit`}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => void remove(t.id)}
              data-testid="delete-thought"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))
      )}
    </Box>
  )
}
