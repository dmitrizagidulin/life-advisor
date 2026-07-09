/**
 * Wallet-login (Login With Wallet) Playwright config. Boots three servers:
 * a local was-teaching-server (read-only sibling checkout), the freewallet dev
 * server (read-only sibling checkout; CHAPI driven via its non-production
 * `__E2E_CHAPI_GET_EVENT__` injection seam, no mediator), and this app in
 * wallet auth mode. Ports are distinct from every other suite so configs can
 * never clash.
 *
 * Run: pnpm exec playwright test -c playwright.wallet.config.ts
 */
import { defineConfig, devices } from '@playwright/test'

const APP_PORT = 5177
const WALLET_PORT = 5277
const WAS_PORT = 3103
export const APP_URL = `http://localhost:${APP_PORT}`
export const WALLET_URL = `http://localhost:${WALLET_PORT}`
export const WAS_URL = `http://localhost:${WAS_PORT}`

const WALLET_DIR =
  process.env.FREEWALLET_DIR ?? '/Users/dmitriz/code/Interop/freewallet'
const WAS_SERVER_DIR =
  process.env.WAS_SERVER_DIR ?? '/Users/dmitriz/code/Interop/was-teaching-server'

export default defineConfig({
  testDir: './test/browser-wallet',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'html',
  timeout: 360_000,
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      // Local WAS teaching server; SERVER_URL must exactly match the URL both
      // the wallet and this app sign zcap requests against.
      command: 'pnpm run dev',
      cwd: WAS_SERVER_DIR,
      url: WAS_URL,
      reuseExistingServer: !process.env.CI,
      env: { PORT: String(WAS_PORT), SERVER_URL: WAS_URL },
      timeout: 60_000
    },
    {
      // freewallet dev server pointed at the local WAS server (its KMS rides
      // on the WAS server's in-process /kms facet).
      command: `pnpm exec vite --cors --host --port ${WALLET_PORT} --strictPort`,
      cwd: WALLET_DIR,
      url: WALLET_URL,
      reuseExistingServer: false,
      env: { VITE_WAS_SERVER_URL: WAS_URL },
      timeout: 60_000
    },
    {
      // This app in wallet auth mode.
      command: `pnpm exec vite --port ${APP_PORT} --strictPort`,
      url: `${APP_URL}/`,
      reuseExistingServer: false,
      env: {
        VITE_AUTH_MODE: 'wallet',
        VITE_APP_ORIGIN: APP_URL,
        VITE_WAS_SERVER_URL: WAS_URL,
        VITE_WAS_SYNC_RETRY_MS: '1500',
        VITE_WAS_SYNC_POLL_MS: '1500'
      },
      timeout: 60_000
    }
  ]
})
