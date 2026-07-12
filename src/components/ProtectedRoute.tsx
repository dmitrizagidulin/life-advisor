/**
 * The auth + hydration gate. Dev mode: kicks off `initApp` (local dev seed, no
 * login) and waits for hydration. Wallet mode: attempts the zero-popup session
 * restore; an unauthenticated visitor is sent to /login, and the routed pages
 * render only once the restored session has hydrated the stores.
 */
import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import { useAppReady, useAuthStore, useSession } from '@interop/was-react'
import { AUTH_MODE } from '@/app.config'
import { initApp } from '@/stores/bootstrap'

function CenteredSpinner({ label }: { label: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: '60vh'
      }}
      data-testid="bootstrap-loading"
    >
      <CircularProgress />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  )
}

export function ProtectedRoute() {
  const ready = useAppReady(s => s.ready)
  const error = useAppReady(s => s.error)
  const { status: authStatus } = useSession()
  const authStore = useAuthStore()

  useEffect(() => {
    if (AUTH_MODE === 'dev') {
      void initApp()
    } else {
      void authStore.getState().restore()
    }
  }, [authStore])

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" data-testid="bootstrap-error">
          Failed to open local storage: {error}
        </Alert>
      </Box>
    )
  }

  if (AUTH_MODE === 'wallet') {
    if (authStatus === 'idle' || authStatus === 'restoring') {
      return <CenteredSpinner label="Restoring your session..." />
    }
    if (authStatus !== 'authenticated') {
      return <Navigate to="/login" replace />
    }
  }

  if (!ready) {
    return <CenteredSpinner label="Opening your storage..." />
  }

  return <Outlet />
}
