/**
 * A diagnostics section shown while replication is in the error state: the sync
 * chip alone says only "Sync error", so this spells out the likely reasons the
 * remote WAS server stopped answering. Driven by the same `useSyncStatus` rollup
 * as the chip; renders nothing in every other state.
 */
import { Alert, AlertTitle, Box } from '@mui/material'
import { useSyncStatus } from '@interop/was-react'

export function SyncErrorDiagnostics() {
  const { state } = useSyncStatus()

  if (state !== 'error') {
    return null
  }

  return (
    <Alert
      severity="error"
      data-testid="sync-error-diagnostics"
      sx={{ maxWidth: 'lg', mx: 'auto', mb: 2 }}
    >
      <AlertTitle>No connection to remote WAS server detected.</AlertTitle>
      Reasons for this may include:
      <Box component="ul" sx={{ my: 0.5, pl: 3 }}>
        <li>The server is offline or unreachable</li>
        <li>This app&apos;s access grant has expired</li>
        <li>This app&apos;s access grant was revoked on the wallet side</li>
      </Box>
    </Alert>
  )
}
