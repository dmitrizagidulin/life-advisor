/**
 * Two-profile WAS replication suite (P2). Each test opens independent browser
 * contexts (separate IndexedDB replicas) that share the SAME dev seed and grants,
 * so they replicate through one WAS Space. Covers:
 *   (a) envelopes replicate to the server / (b) a second profile hydrates the
 *       same data (via the reactive remote-change patching);
 *   (c) concurrent edits converge (412 + payload LWW);
 *   (d) an offline session recovers on reconnect via reSync.
 *
 * Server restart mid-session was NOT automated (awkward to drive the read-only
 * server process from inside the browser); the offline/online reSync path in
 * tests (c) and (d) exercises the same recovery machinery.
 *
 * Because the pull side is poll-based (no server-side live stream), an already-
 * open session converges via the app's periodic reSync (VITE_WAS_SYNC_POLL_MS is
 * set low in this config), so the tests wait rather than force a reload.
 *
 * Data names are unique per test because the Space is shared and long-lived.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const CATEGORIES = ['critical', 'tomorrow', 'opportunity', 'horizon', 'someday']

/** Opens a fresh profile (isolated IndexedDB) on the dashboard. */
async function openProfile(
  context: BrowserContext
): Promise<Page> {
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByTestId('dashboard-page')).toBeVisible()
  return page
}

/** Creates a "someday" action item with the given name on `page`. */
async function createItem(page: Page, name: string): Promise<void> {
  await page.getByTestId('new-item-input-someday').fill(name)
  await page.getByTestId('add-item-someday').click()
}

/** The row locator for an item by name in a specific category list. */
function rowIn(page: Page, category: string, name: string) {
  return page
    .getByTestId(`category-list-${category}`)
    .getByTestId('action-item-row')
    .filter({ hasText: name })
}

/** Which category currently holds the named item on `page`, or null. */
async function categoryOf(page: Page, name: string): Promise<string | null> {
  for (const category of CATEGORIES) {
    if ((await rowIn(page, category, name).count()) > 0) {
      return category
    }
  }
  return null
}

test('(a/b) envelopes replicate; a second profile hydrates identical data', async ({
  browser
}) => {
  const name = `repl-${Date.now()}`
  const ctxA = await browser.newContext()
  const a = await openProfile(ctxA)

  await createItem(a, name)
  await expect(rowIn(a, 'someday', name)).toBeVisible()

  // A fresh profile with the same seed + grants must pull and show it live
  // (replication + reactive store patching), with no manual reload.
  const ctxB = await browser.newContext()
  const b = await openProfile(ctxB)
  await expect(rowIn(b, 'someday', name)).toBeVisible({ timeout: 30_000 })

  await ctxA.close()
  await ctxB.close()
})

test('(c) concurrent edits on both profiles converge via 412 + LWW', async ({
  browser
}) => {
  const name = `converge-${Date.now()}`
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await openProfile(ctxA)

  await createItem(a, name)
  await expect(rowIn(a, 'someday', name)).toBeVisible()

  // B pulls the item first.
  const b = await openProfile(ctxB)
  await expect(rowIn(b, 'someday', name)).toBeVisible({ timeout: 30_000 })

  // Both go offline and move the SAME item to DIFFERENT categories.
  await ctxA.setOffline(true)
  await ctxB.setOffline(true)
  await rowIn(a, 'someday', name).getByTestId('category-critical').click()
  await expect(rowIn(a, 'critical', name)).toBeVisible()
  await rowIn(b, 'someday', name).getByTestId('category-tomorrow').click()
  await expect(rowIn(b, 'tomorrow', name)).toBeVisible()

  // Reconnect: the periodic reSync on both sides re-pushes / re-pulls, the
  // colliding writes hit a 412, and the LWW conflict handler settles it.
  await ctxA.setOffline(false)
  await ctxB.setOffline(false)

  // Convergence: both profiles agree on ONE final category for the item.
  await expect
    .poll(
      async () => {
        const ca = await categoryOf(a, name)
        const cb = await categoryOf(b, name)
        return ca !== null && ca === cb ? ca : null
      },
      { timeout: 40_000, intervals: [1000] }
    )
    .not.toBeNull()

  await ctxA.close()
  await ctxB.close()
})

test('(d) an offline profile recovers on reconnect via reSync', async ({
  browser
}) => {
  const name = `resync-${Date.now()}`
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await openProfile(ctxA)
  const b = await openProfile(ctxB)

  // A goes offline, then creates an item -- queued locally, not on the server.
  await ctxA.setOffline(true)
  await createItem(a, name)
  await expect(rowIn(a, 'someday', name)).toBeVisible()

  // B (online) must NOT see it while A is offline.
  await expect(rowIn(b, 'someday', name)).toHaveCount(0)

  // A reconnects; its periodic reSync pushes the queued envelope and B's pulls it.
  await ctxA.setOffline(false)
  await expect(rowIn(b, 'someday', name)).toBeVisible({ timeout: 30_000 })

  await ctxA.close()
  await ctxB.close()
})
