/**
 * WAS-backed Playwright config (P2). Unlike the offline `playwright.config.ts`,
 * this boots a local was-teaching-server + provisions dev grants (globalSetup),
 * then serves the app in dev-sync mode (VITE_WAS_DEV_SYNC=true) on a dedicated
 * port so it never clashes with the offline suite's dev server. Tests are
 * serialized (a single shared Space) with unique per-test data names.
 *
 * Run: pnpm exec playwright test -c playwright.was.config.ts
 */
import { defineConfig, devices } from '@playwright/test'

const APP_PORT = 5174

export default defineConfig({
  testDir: './test/browser-was',
  testMatch: /.*\.spec\.ts/,
  // One shared WAS Space across profiles; serialize to keep assertions clean.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  timeout: 60_000,
  globalSetup: './test/browser-was/globalSetup.ts',
  globalTeardown: './test/browser-was/globalTeardown.ts',
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
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_WAS_DEV_SYNC: 'true',
      // Snappier backoff + change-feed polling so multi-device convergence and
      // offline/online recovery land within the test timeouts.
      VITE_WAS_SYNC_RETRY_MS: '1500',
      VITE_WAS_SYNC_POLL_MS: '1500'
    }
  }
})
