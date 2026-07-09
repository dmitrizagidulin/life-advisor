import { stopServer } from './serverLifecycle.js'

/** Playwright globalTeardown: stop the WAS server started in globalSetup. */
export default async function globalTeardown(): Promise<void> {
  await stopServer()
}
