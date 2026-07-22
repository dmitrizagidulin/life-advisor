/**
 * Login page: the "Login With Wallet" (CHAPI) entry point -- one button
 * driving the library's login flow, a progress line per phase, and an error
 * alert; a connected visitor is bounced straight to the app. If the anonymous
 * `local` replica already holds data (a `useHasLocalData` check at click
 * time), the button opens the library's `AdoptDialog` -- which runs the login
 * itself with the chosen adoption -- instead of logging in directly.
 */
import { useState } from 'react'
import { Navigate } from 'react-router'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import { useHasLocalData, useLogin } from '@interop/was-react'
import { AdoptDialog } from '@interop/was-react/mui'
import { WAS_APP_CONFIG } from '@/app.config'

/**
 * Human-readable copy per `useLogin` phase; an unknown phase falls back to the
 * raw phase key in the render below.
 */
const PHASE_LABELS: Record<string, string> = {
  connecting: 'Contacting your wallet...',
  verifying: 'Verifying the wallet response...'
}

export function LoginPage() {
  const { login, authenticating, status, phase, error } = useLogin()
  const hasLocalData = useHasLocalData()
  const [adoptOpen, setAdoptOpen] = useState(false)
  const busy = authenticating

  if (status === 'connected') {
    return <Navigate to="/" replace />
  }

  /**
   * On click, branch on whether the anonymous replica holds data: if it does,
   * let the user choose what happens to it via the dialog (which runs the
   * login); otherwise log in directly. `login` resolves `{ firstRun }` on a
   * connected outcome (the `Navigate` above then sends them to the app), `null`
   * on a cancelled wallet popup, and rejects on a genuine failure -- whose
   * message the library mirrors into `error`, rendered as the alert below, so
   * the catch just keeps the rejection handled.
   */
  async function handleLogin(): Promise<void> {
    if (await hasLocalData()) {
      setAdoptOpen(true)
      return
    }
    try {
      await login()
    } catch {
      // Surfaced via the `error` alert.
    }
  }

  return (
    <Box data-testid="login-page" sx={{ textAlign: 'center', mt: 6 }}>
      <Typography variant="h3" gutterBottom>
        {WAS_APP_CONFIG.appName}
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
        Action items, projects, goals, questions, thoughts, and focus modes --
        your personal productivity workspace.
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Your data lives in your own wallet-attached storage, encrypted with a
        key only your wallet holds. Connect your wallet to continue.
      </Typography>
      {error && (
        <Alert
          severity="error"
          data-testid="login-error"
          sx={{ mb: 2, justifyContent: 'center' }}
        >
          {error}
        </Alert>
      )}
      {busy ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}
        >
          <CircularProgress />
          <Typography color="text.secondary" data-testid="login-phase">
            {phase
              ? (PHASE_LABELS[phase] ?? phase)
              : 'Contacting your wallet...'}
          </Typography>
        </Box>
      ) : (
        <Button
          variant="contained"
          size="large"
          disabled={busy}
          onClick={() => void handleLogin()}
          data-testid="login-with-wallet"
        >
          Login with wallet
        </Button>
      )}
      <AdoptDialog open={adoptOpen} onClose={() => setAdoptOpen(false)} />
    </Box>
  )
}
