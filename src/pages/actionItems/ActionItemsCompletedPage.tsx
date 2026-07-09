/**
 * Completed action items (ports `action_items#completed`), newest completion
 * first via the reversed action-item comparator.
 */
import { Box, Table, TableBody, Typography } from '@mui/material'
import { useShallow } from 'zustand/react/shallow'
import { allCompleted } from '@/domain/queries'
import { sortActionItemsCompletedDesc } from '@/domain/sort'
import { useActionItems } from '@/stores/entities/actionItems'
import { ActionItemRow } from '@/components/ActionItemRow'

export function ActionItemsCompletedPage() {
  const items = useActionItems(useShallow((s) =>
    sortActionItemsCompletedDesc(allCompleted([...s.byId.values()]))
  ))
  return (
    <Box data-testid="action-items-completed-page">
      <Typography variant="h4" gutterBottom>
        Completed Action Items
      </Typography>
      {items.length === 0 ? (
        <Typography color="text.secondary">Nothing completed yet.</Typography>
      ) : (
        <Table size="small">
          <TableBody>
            {items.map((item) => (
              <ActionItemRow key={item.id} item={item} />
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}
