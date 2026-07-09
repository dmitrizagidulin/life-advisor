/**
 * The "Bump!" control: increments an entity's bumpCount (which floats it up the
 * sort). Shows the current count when non-zero.
 */
import { Button } from '@mui/material'

export function BumpButton({
  count,
  onBump,
  testId
}: {
  count: number
  onBump: () => void
  testId?: string
}) {
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={onBump}
      data-testid={testId}
    >
      Bump!{count > 0 ? ` (${count})` : ''}
    </Button>
  )
}
