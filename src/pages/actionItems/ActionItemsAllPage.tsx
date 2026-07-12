/**
 * All action items (ports `action_items#all`): every item, done or not, sorted by
 * the action-item comparator, each an editable row.
 */
import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { Box, Button, Stack, Table, TableBody, Typography } from '@mui/material'
import { compareActionItems } from '@/domain/sort'
import { bucketByParent } from '@/domain/parent'
import { useActionItems } from '@/stores/entities/actionItems'
import { useWebLinks } from '@/stores/entities/webLinks'
import { ActionItemRow, EMPTY_WEB_LINKS } from '@/components/ActionItemRow'

export function ActionItemsAllPage() {
  const items = useActionItems(useShallow((s) =>
    [...s.byId.values()].sort(compareActionItems)
  ))
  const allLinks = useWebLinks(useShallow((s) => [...s.byId.values()]))
  const linksByItem = useMemo(
    () => bucketByParent(allLinks, 'action_item'),
    [allLinks]
  )
  return (
    <Box data-testid="action-items-all-page">
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" gutterBottom>
          All Action Items
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/action-items/completed" size="small">
            Completed
          </Button>
          <Button
            component={RouterLink}
            to="/action-items/new"
            size="small"
            variant="outlined"
          >
            New
          </Button>
        </Stack>
      </Stack>
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
    </Box>
  )
}
