/**
 * Offline (mocked) Playwright config: the default suite. Serves the app in dev
 * auth mode (local dev-seed store, no wallet, no WAS server) and exercises the
 * UI against the encrypted local replica only. No sibling checkouts or servers
 * needed; this is the tier suited to CI.
 *
 * Run: pnpm exec playwright test
 */
import { defineConfig, devices } from '@playwright/test'

const APP_PORT = 5173

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: `pnpm exec vite --port ${APP_PORT} --strictPort`,
    url: `http://localhost:${APP_PORT}/`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_AUTH_MODE: 'dev'
    }
  }
})
