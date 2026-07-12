/**
 * The back + Edit button row shared by the entity detail pages. `extras` slots in
 * any page-specific actions (e.g. the project "Make Current Focus" button).
 */
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'
import { Button, Stack } from '@mui/material'

export function EntityShowHeader({
  backTo,
  backLabel,
  editTo,
  extras
}: {
  backTo: string
  backLabel: string
  editTo: string
  extras?: ReactNode
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
      <Button component={RouterLink} to={backTo} size="small">
        {`< ${backLabel}`}
      </Button>
      <Button component={RouterLink} to={editTo} size="small">
        Edit
      </Button>
      {extras}
    </Stack>
  )
}
