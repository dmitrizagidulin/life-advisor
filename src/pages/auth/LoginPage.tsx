/**
 * Login page. Wallet mode: the real "Login With Wallet" (CHAPI) entry point --
 * first login stores the app key in the wallet and requests storage grants;
 * a returning login recovers the key and re-grants. Dev mode keeps the
 * offline placeholder (the app is always "logged in" against the dev seed).
 */
import { useEffect } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import { useAuthStore, useLogin, type LoginPhase } from '@interop/was-react'
import { AUTH_MODE } from '@/app.config'

const PHASE_LABEL: Record<LoginPhase, string> = {
  probing: 'Checking your wallet for the app key...',
  'storing-key': 'Saving your app key to your wallet...',
  'requesting-grants': 'Requesting storage access...',
  verifying: 'Verifying the wallet response...'
}

function DevLoginPage() {
  return (
    <Box data-testid="login-page" sx={{ textAlign: 'center', mt: 6 }}>
      <Typography variant="h4" gutterBottom>
        Login With Wallet
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Wallet login is not enabled in this build. Your data lives in the local
        encrypted store.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Continue to app
      </Button>
    </Box>
  )
}

function WalletLoginPage() {
  const navigate = useNavigate()
  const authStore = useAuthStore()
  const { login, status, phase, error } = useLogin()

  // Try the zero-popup restore first, and leave once authenticated.
  useEffect(() => {
    void authStore.getState().restore()
  }, [authStore])
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/', { replace: true })
    }
  }, [status, navigate])

  const busy =
    status === 'idle' || status === 'restoring' || status === 'authenticating'

  return (
    <Box data-testid="login-page" sx={{ textAlign: 'center', mt: 6 }}>
      <Typography variant="h4" gutterBottom>
        Login With Wallet
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
      {status === 'authenticating' ? (
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
            {phase ? PHASE_LABEL[phase] : 'Contacting your wallet...'}
          </Typography>
        </Box>
      ) : (
        <Button
          variant="contained"
          size="large"
          disabled={busy}
          onClick={() => void login()}
          data-testid="login-with-wallet"
        >
          Login with wallet
        </Button>
      )}
    </Box>
  )
}

export function LoginPage() {
  return AUTH_MODE === 'wallet' ? <WalletLoginPage /> : <DevLoginPage />
}
