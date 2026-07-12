/**
 * Action item detail (ports `action_items#show`): the item's fields, a link back
 * to its parent, and the attached links table.
 */
import { Link as RouterLink, useParams } from 'react-router'
import { Box, Link, Stack, Typography } from '@mui/material'
import { formatTimestamp } from '@/lib/dates'
import { useActionItems } from '@/stores/entities/actionItems'
import { LinksTable } from '@/components/LinksTable'
import { EntityShowHeader } from '@/components/EntityShowHeader'
import { NotFound } from '@/components/NotFound'
import { AREA_COLORS } from '@/themes/theme'

export function ActionItemShowPage() {
  const { id } = useParams()
  const item = useActionItems((s) => (id ? s.byId.get(id) : undefined))

  if (!item) {
    return <NotFound label="Action item" />
  }

  return (
    <Box data-testid="action-item-show-page">
      <EntityShowHeader
        backTo="/action-items/all"
        backLabel="All"
        editTo={`/action-items/${item.id}/edit`}
      />
      <Typography variant="h4" sx={{ color: AREA_COLORS[item.area] }}>
        {item.name}
      </Typography>
      <Stack spacing={0.5} sx={{ my: 2 }}>
        <Typography>Category: {item.mywnCategory}</Typography>
        <Typography>Area: {item.area}</Typography>
        <Typography>Done: {item.done ? 'Yes' : 'No'}</Typography>
        {item.completedAt && (
          <Typography>
            Completed: {formatTimestamp(item.completedAt)}
          </Typography>
        )}
        <Typography>Bumped: {item.bumpCount} times</Typography>
        {item.timeElapsed > 0 && (
          <Typography>Elapsed: {item.timeElapsed} hrs</Typography>
        )}
        {item.description && (
          <Typography>Description: {item.description}</Typography>
        )}
        {item.parentType === 'project' && item.parentKey && (
          <Typography>
            Project:{' '}
            <Link component={RouterLink} to={`/projects/${item.parentKey}`}>
              open
            </Link>
          </Typography>
        )}
      </Stack>
      <LinksTable parentType="action_item" parentKey={item.id} />
    </Box>
  )
}
