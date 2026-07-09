/**
 * Logout page. Wallet mode: tears the session down on mount -- stops sync,
 * closes the encrypted store, wipes the persisted seed + session record, and
 * clears the in-memory stores. Dev mode keeps the offline placeholder (there
 * is no session to end).
 */
import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { AUTH_MODE } from '@/app.config'
import { useAuthStore } from '@/stores/authStore'

function WalletLogoutPage() {
  const [done, setDone] = useState(false)

  useEffect(() => {
    void useAuthStore
      .getState()
      .logout()
      .finally(() => setDone(true))
  }, [])

  return (
    <Box data-testid="logout-page" sx={{ textAlign: 'center', mt: 6 }}>
      <Typography variant="h4" gutterBottom>
        {done ? 'Logged out' : 'Logging out...'}
      </Typography>
      {done ? (
        <>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Your app key and session were removed from this browser. Your data
            stays safe in your wallet storage.
          </Typography>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            data-testid="back-to-login"
          >
            Back to login
          </Button>
        </>
      ) : (
        <CircularProgress />
      )}
    </Box>
  )
}

function DevLogoutPage() {
  return (
    <Box data-testid="logout-page" sx={{ textAlign: 'center', mt: 6 }}>
      <Typography variant="h4" gutterBottom>
        Logged out
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Session teardown is not wired up in this offline build.
      </Typography>
      <Button component={RouterLink} to="/login" variant="contained">
        Back to login
      </Button>
    </Box>
  )
}

export function LogoutPage() {
  return AUTH_MODE === 'wallet' ? <WalletLogoutPage /> : <DevLogoutPage />
}
