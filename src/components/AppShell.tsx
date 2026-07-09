/**
 * The application shell: a top AppBar with navigation to every section, the
 * offline sync chip, and the routed page inside a Container. The current-focus
 * banner rides above the page content on every screen.
 */
import { useState } from 'react'
import { Link as RouterLink, Outlet, useLocation } from 'react-router'
import {
  AppBar,
  Box,
  Button,
  Container,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography
} from '@mui/material'
import { AREAS } from '@/types/domain'
import { downloadExportBundle } from '@/stores/exportAll'
import { CurrentFocusBanner } from './CurrentFocusBanner'
import { ReconnectBanner } from './ReconnectBanner'
import { SyncStatusChip } from './SyncStatusChip'

const NAV: Array<{ label: string; to: string }> = [
  { label: 'Dashboard', to: '/' },
  { label: 'Action Items', to: '/action-items/all' },
  { label: 'Projects', to: '/projects' },
  { label: 'Goals', to: '/goals' },
  { label: 'Questions', to: '/questions' },
  { label: 'Thoughts', to: '/thoughts' },
  { label: 'Web Links', to: '/web-links' },
  { label: 'History', to: '/history' }
]

export function AppShell() {
  const location = useLocation()
  const [focusAnchor, setFocusAnchor] = useState<null | HTMLElement>(null)

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary">
        <Toolbar sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ color: 'inherit', textDecoration: 'none', mr: 2 }}
          >
            life-advisor
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexGrow: 1, flexWrap: 'wrap' }}>
            {NAV.map((item) => (
              <Button
                key={item.to}
                component={RouterLink}
                to={item.to}
                color="inherit"
                size="small"
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                sx={{
                  fontWeight:
                    location.pathname === item.to ? 700 : 400
                }}
              >
                {item.label}
              </Button>
            ))}
            <Button
              color="inherit"
              size="small"
              onClick={(e) => setFocusAnchor(e.currentTarget)}
              data-testid="nav-focus"
            >
              Focus
            </Button>
            <Menu
              anchorEl={focusAnchor}
              open={Boolean(focusAnchor)}
              onClose={() => setFocusAnchor(null)}
            >
              {AREAS.map((area) => (
                <MenuItem
                  key={area}
                  component={RouterLink}
                  to={`/focus/${area}`}
                  onClick={() => setFocusAnchor(null)}
                  data-testid={`focus-area-${area}`}
                >
                  {area.charAt(0).toUpperCase() + area.slice(1)}
                </MenuItem>
              ))}
            </Menu>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <SyncStatusChip />
            <Button
              color="inherit"
              size="small"
              onClick={() => downloadExportBundle()}
              data-testid="export-json"
            >
              Export
            </Button>
            <Button
              component={RouterLink}
              to="/logout"
              color="inherit"
              size="small"
              data-testid="nav-logout"
            >
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <ReconnectBanner />
        <CurrentFocusBanner />
        <Outlet />
      </Container>
    </Box>
  )
}
