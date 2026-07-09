import { startServerAndProvision } from './serverLifecycle.js'

/** Playwright globalSetup: boot the WAS server and provision dev grants. */
export default async function globalSetup(): Promise<void> {
  await startServerAndProvision()
}
