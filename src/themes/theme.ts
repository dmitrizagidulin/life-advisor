/**
 * The app's MUI theme, adapted from freewallet's `themeConfig`. A single light
 * theme is enough for P1; the palette and rounded-button idioms are lifted from
 * freewallet's `default` theme so the shell reads consistently with the wallet.
 */
import { createTheme } from '@mui/material/styles'
import type { Area, MywnCategory } from '@/types/domain'

/** Accent colors for the four life areas (ports the Rails `area-*` classes). */
export const AREA_COLORS: Record<Area, string> = {
  work: '#1565c0',
  soul: '#6a1b9a',
  admin: '#2e7d32',
  assistant: '#00838f'
}

/** Chip color per MYWN category, most-urgent to least. */
export const CATEGORY_COLORS: Record<MywnCategory, string> = {
  critical: '#c62828',
  tomorrow: '#ef6c00',
  opportunity: '#1565c0',
  horizon: '#00838f',
  someday: '#616161'
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#f7f7f7', paper: '#ffffff' },
    primary: { main: '#1976d2' }
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { whiteSpace: 'nowrap', textTransform: 'none' } }
    }
  }
})
