/**
 * The 60-day history journal (ports `history#index`). Each day reports items
 * created and completed, computed by `domain/history.buildHistory`. Days with no
 * activity are omitted.
 */
import { Box, Chip, List, ListItem, Stack, Typography } from '@mui/material'
import { useShallow } from 'zustand/react/shallow'
import { buildHistory } from '@/domain/history'
import { daySortKey } from '@/domain/sort'
import { useActionItems } from '@/stores/entities/actionItems'

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function dayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: '2-digit'
  })
}

export function HistoryPage() {
  const items = useActionItems(useShallow((s) => [...s.byId.values()]))
  const history = buildHistory(items).filter((day) => day.hasActivity)

  return (
    <Box data-testid="history-page">
      <Typography variant="h4" gutterBottom>
        History
      </Typography>
      {history.map((day) => (
        <Box key={day.day} sx={{ mb: 2 }} data-testid="history-day">
          <Typography variant="h6">{dayLabel(day.day)}</Typography>
          <Stack direction="row" spacing={1} sx={{ my: 0.5 }}>
            {day.numCreatedItems > 0 && (
              <Chip
                size="small"
                color="error"
                label={`${day.numCreatedItems} created${
                  day.numCompletedSameDay > 0
                    ? `, ${day.numCompletedSameDay} same-day`
                    : ''
                }`}
              />
            )}
            <Chip
              size="small"
              color="success"
              label={`${day.numCompletedItems} completed`}
            />
          </Stack>
          <List dense disablePadding>
            {day.items.map((item) => (
              <ListItem key={item.id} disableGutters>
                <Typography variant="body2">
                  {timeLabel(daySortKey(item))} --{' '}
                  <strong>{item.done ? 'Complete:' : 'Added:'}</strong>{' '}
                  {item.name}
                </Typography>
              </ListItem>
            ))}
          </List>
        </Box>
      ))}
    </Box>
  )
}
