/**
 * Area picker over the four life areas (order load-bearing, from `AREAS`).
 */
import { MenuItem, TextField } from '@mui/material'
import { AREAS } from '@/types/domain'
import type { Area } from '@/types/domain'

export function AreaSelect({
  value,
  onChange,
  label = 'Area',
  size = 'small'
}: {
  value: Area
  onChange: (area: Area) => void
  label?: string
  size?: 'small' | 'medium'
}) {
  return (
    <TextField
      select
      size={size}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as Area)}
      data-testid="area-select"
      sx={{ minWidth: 140 }}
    >
      {AREAS.map((area) => (
        <MenuItem key={area} value={area}>
          {area.charAt(0).toUpperCase() + area.slice(1)}
        </MenuItem>
      ))}
    </TextField>
  )
}
