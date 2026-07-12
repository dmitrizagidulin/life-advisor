/**
 * The shared "not found" guard used by the entity form and detail pages when the
 * requested id resolves to no document. `label` is the entity noun, e.g. "Project".
 */
import { Typography } from '@mui/material'

export function NotFound({ label }: { label: string }) {
  return <Typography>{label} not found.</Typography>
}
