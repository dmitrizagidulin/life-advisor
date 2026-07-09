/**
 * The replication indicator: an aggregate over the per-collection statuses the
 * sync controller writes into `syncStatusStore`. With no replication running
 * (offline/dev mode) it advertises local-only mode; otherwise it rolls the
 * collection states up to error > syncing > synced.
 */
import { Chip, Tooltip } from '@mui/material'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import CloudDoneIcon from '@mui/icons-material/CloudDone'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import CloudAlertIcon from '@mui/icons-material/ErrorOutlined'
import { useSyncStatusStore } from '@/stores/syncStatusStore'

export function SyncStatusChip() {
  const statuses = useSyncStatusStore((s) => s.statuses)
  const values = Object.values(statuses)

  let label = 'Offline'
  let title = 'Local-only mode -- no storage sync running'
  let icon = <CloudOffIcon />
  if (values.length > 0) {
    if (values.includes('error')) {
      label = 'Sync error'
      title = 'A collection failed to sync; retrying'
      icon = <CloudAlertIcon />
    } else if (values.includes('syncing') || values.includes('idle')) {
      label = 'Syncing'
      title = 'Replicating with your wallet storage'
      icon = <CloudSyncIcon />
    } else {
      label = 'Synced'
      title = 'All collections replicated'
      icon = <CloudDoneIcon />
    }
  }

  return (
    <Tooltip title={title}>
      <Chip
        icon={icon}
        label={label}
        size="small"
        variant="outlined"
        data-testid="sync-status-chip"
        data-sync-state={label.toLowerCase().replace(/\s+/g, '-')}
        sx={{ color: 'inherit', borderColor: 'currentColor' }}
      />
    </Tooltip>
  )
}
