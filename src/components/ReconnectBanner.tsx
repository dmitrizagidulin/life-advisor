/**
 * The storage-access-expired banner (wallet mode). Shown when a live 401/403
 * from the WAS server surfaces on the sync error stream (the granted zcaps
 * expired or were revoked); the action relaunches the grants flow with the
 * existing seed (one wallet popup, same identity, same data).
 */
import { Alert, Button } from '@mui/material'
import { AUTH_MODE } from '@/app.config'
import { useAuthStore } from '@/stores/authStore'

export function ReconnectBanner() {
  const accessExpired = useAuthStore((s) => s.accessExpired)
  const reconnecting = useAuthStore((s) => s.reconnecting)

  if (AUTH_MODE !== 'wallet' || !accessExpired) {
    return null
  }

  return (
    <Alert
      severity="warning"
      data-testid="reconnect-banner"
      sx={{ mb: 2 }}
      action={
        <Button
          color="inherit"
          size="small"
          disabled={reconnecting}
          onClick={() => void useAuthStore.getState().reconnect()}
          data-testid="reconnect-wallet"
        >
          {reconnecting ? 'Reconnecting...' : 'Reconnect wallet'}
        </Button>
      }
    >
      Storage access expired -- reconnect your wallet to keep syncing.
    </Alert>
  )
}
