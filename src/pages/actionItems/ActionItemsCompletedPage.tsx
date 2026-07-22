/**
 * Completed action items, newest completion
 * first via the reversed action-item comparator.
 */
import { useMemo } from 'react'
import { Box, Table, TableBody, Typography } from '@mui/material'
import { useShallow } from 'zustand/react/shallow'
import { allCompleted } from '@/domain/queries'
import { sortActionItemsCompletedDesc } from '@/domain/sort'
import { bucketByParent } from '@/domain/parent'
import { useActionItems } from '@/stores/entities/actionItems'
import { useWebLinks } from '@/stores/entities/webLinks'
import { ActionItemRow, EMPTY_WEB_LINKS } from '@/components/ActionItemRow'

export function ActionItemsCompletedPage() {
  const items = useActionItems(useShallow((s) =>
    sortActionItemsCompletedDesc(allCompleted([...s.byId.values()]))
  ))
  const allLinks = useWebLinks(useShallow((s) => [...s.byId.values()]))
  const linksByItem = useMemo(
    () => bucketByParent(allLinks, 'actionItem'),
    [allLinks]
  )
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
              <ActionItemRow
                key={item.id}
                item={item}
                links={linksByItem.get(item.id) ?? EMPTY_WEB_LINKS}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}
