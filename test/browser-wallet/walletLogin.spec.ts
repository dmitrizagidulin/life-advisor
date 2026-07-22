/**
 * Login-With-Wallet e2e against a real local freewallet + was-teaching-server.
 *
 * CHAPI has no mediator here; two injection seams stand in for it:
 * - App side: `window.__WAS_REACT_E2E_CHAPI__` switches the library's CHAPI
 *   layer to a request queue (`__WAS_REACT_E2E_CHAPI_REQUESTS__` /
 *   `__WAS_REACT_E2E_CHAPI_RESPONSES__`) this spec services.
 * - Wallet side: freewallet's own non-production `__E2E_CHAPI_GET_EVENT__` seam
 *   drives its /#/wallet/get popup with the app's captured VPR; the response VP
 *   is read back off `__E2E_CHAPI_RESPONSE__`.
 * Login is the one-popup App Connect flow: the app sends a single get()
 * carrying the AppConnectQuery, and the wallet's consent screen approves the
 * whole thing (match-or-mint the app key, delegate the grants) in one round.
 *
 * One serialized test walks the whole life cycle on a single wallet account
 * (signup is slow -- deliberately expensive PBKDF2): first login (mints the app
 * key + grants + provisioning), a data write that replicates to WAS, a
 * logout/login (returning path recovering from WAS), a cleared-app-storage
 * recovery (seed via the wallet, data from WAS), and the expired-session
 * fallthrough.
 */
import {
  test,
  expect,
  type BrowserContext,
  type Page,
  type TestInfo
} from '@playwright/test'
import { APP_URL, WALLET_URL, WAS_URL } from '../../playwright.wallet.config'

const COLLECTION_IDS = [
  'action-items',
  'projects',
  'goals',
  'questions',
  'answers',
  'web-links',
  'thoughts',
  'current-focus'
]

/* ----------------------------- wallet helpers ----------------------------- */

function testUser(testInfo: TestInfo) {
  const token = `${Date.now()}-w${testInfo.workerIndex}`
  return {
    passphrase: `Str0ngpass-${token}-Aa1!`,
    email: `e2e-${token}@example.com`
  }
}

/** Creates a wallet account; leaves `page` logged in on the wallet dashboard. */
async function signupWallet(page: Page, testInfo: TestInfo) {
  const { passphrase, email } = testUser(testInfo)
  await page.goto(`${WALLET_URL}/#/signup`)
  await page.locator('input[type="password"]').fill(passphrase)
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled({
    timeout: 20_000
  })
  await page.getByRole('button', { name: 'Next' }).click()
  await page.locator('input[type="email"]').fill(email)
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/#\/signup\?.*step=storage/)
  await page.getByRole('button', { name: 'Create Wallet' }).click()
  // Signup binds the keyring (deliberately slow PBKDF2) + provisions storage.
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 45_000 })
  return { passphrase, email }
}

/**
 * Services one app-captured `get()` VPR through the wallet's /#/wallet/get page
 * (freewallet's injection seam), returning the CHAPI wire response.
 */
async function driveWalletGet(
  context: BrowserContext,
  { vpr, passphrase }: { vpr: unknown; passphrase: string }
): Promise<unknown> {
  const page = await context.newPage()
  await page.addInitScript(
    cfg => {
      const win = window as unknown as {
        __E2E_CHAPI_GET_EVENT__?: unknown
        __E2E_CHAPI_RESPONSE__?: { value: unknown }
      }
      win.__E2E_CHAPI_RESPONSE__ = undefined
      win.__E2E_CHAPI_GET_EVENT__ = {
        credentialRequestOrigin: cfg.origin,
        credentialRequestOptions: {
          web: { VerifiablePresentation: cfg.vpr }
        },
        respondWith(promise: Promise<unknown>) {
          void Promise.resolve(promise).then(value => {
            win.__E2E_CHAPI_RESPONSE__ = { value: value ?? null }
          })
        }
      }
    },
    { origin: APP_URL, vpr }
  )
  await page.goto(`${WALLET_URL}/#/wallet/get`)
  // The popup always asks for the passphrase (it is designed for a cold
  // cross-origin popup, not the dashboard session).
  await page.locator('input[type="password"]').fill(passphrase)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page
    .locator('input[type="password"]')
    .waitFor({ state: 'detached', timeout: 30_000 })
  // The App Connect consent screen approves everything with one button.
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __E2E_CHAPI_RESPONSE__?: { value: unknown }
              }
            ).__E2E_CHAPI_RESPONSE__ !== undefined
        ),
      { timeout: 30_000, intervals: [500] }
    )
    .toBe(true)
  const response = await page.evaluate(
    () =>
      (window as unknown as { __E2E_CHAPI_RESPONSE__?: { value: unknown } })
        .__E2E_CHAPI_RESPONSE__
  )
  await page.close()
  return (response as { value: unknown }).value
}

/* ------------------------------ app helpers ------------------------------ */

interface ChapiBridgeRequest {
  id: number
  type: 'get' | 'store'
  body: unknown
}

/** Arms the app-side CHAPI bridge (must run before the page loads). */
async function armChapiBridge(page: Page) {
  await page.addInitScript(() => {
    ;(
      window as unknown as { __WAS_REACT_E2E_CHAPI__?: boolean }
    ).__WAS_REACT_E2E_CHAPI__ = true
  })
}

/** Pops the next queued CHAPI request from the app page. */
async function popChapiRequest(page: Page): Promise<ChapiBridgeRequest> {
  let request: ChapiBridgeRequest | null = null
  await expect
    .poll(
      async () => {
        request = await page.evaluate(
          () =>
            (
              window as unknown as {
                __WAS_REACT_E2E_CHAPI_REQUESTS__?: ChapiBridgeRequest[]
              }
            ).__WAS_REACT_E2E_CHAPI_REQUESTS__?.shift() ?? null
        )
        return request
      },
      { timeout: 30_000, intervals: [300] }
    )
    .not.toBeNull()
  return request as unknown as ChapiBridgeRequest
}

/** Posts a wire response for a bridged CHAPI request. */
async function respondChapi(page: Page, id: number, value: unknown) {
  await page.evaluate(
    ([responseId, responseValue]) => {
      const win = window as unknown as {
        __WAS_REACT_E2E_CHAPI_RESPONSES__?: Record<number, unknown>
      }
      win.__WAS_REACT_E2E_CHAPI_RESPONSES__ ??= {}
      win.__WAS_REACT_E2E_CHAPI_RESPONSES__[responseId as number] =
        responseValue
    },
    [id, value] as const
  )
}

/** Reads the persisted app session record out of the app's IndexedDB. */
async function readSessionRecord(page: Page): Promise<{
  controllerDid: string
  serverUrl: string
  spaceId: string
  grants: Array<{
    controller: string
    invocationTarget: string
    allowedAction: string[]
    parentCapability: string
    expires: string
  }>
  expires: string
} | null> {
  return await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('life-advisor-session', 1)
        open.onupgradeneeded = () => {
          open.result.createObjectStore('session')
        }
        open.onsuccess = () => {
          const db = open.result
          try {
            const get = db
              .transaction('session', 'readonly')
              .objectStore('session')
              .get('record')
            get.onsuccess = () => {
              db.close()
              resolve((get.result ?? null) as never)
            }
            get.onerror = () => {
              db.close()
              reject(get.error)
            }
          } catch (err) {
            db.close()
            reject(err as Error)
          }
        }
        open.onerror = () => reject(open.error)
      })
  )
}

/** Overwrites the persisted session record (e.g. to force expiry). */
async function patchSessionRecord(
  page: Page,
  patch: Record<string, unknown>
): Promise<void> {
  await page.evaluate(
    recordPatch =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('life-advisor-session', 1)
        open.onsuccess = () => {
          const db = open.result
          const store = db
            .transaction('session', 'readwrite')
            .objectStore('session')
          const get = store.get('record')
          get.onsuccess = () => {
            const record = get.result as Record<string, unknown>
            const put = store.put({ ...record, ...recordPatch }, 'record')
            put.onsuccess = () => {
              db.close()
              resolve()
            }
            put.onerror = () => reject(put.error)
          }
          get.onerror = () => reject(get.error)
        }
        open.onerror = () => reject(open.error)
      }),
    patch
  )
}

/** Deletes every IndexedDB database of the app origin (no open connections). */
async function wipeAppDatabases(page: Page): Promise<string[]> {
  return await page.evaluate(async () => {
    const dbs = await indexedDB.databases()
    const names: string[] = []
    await Promise.all(
      dbs.map(
        db =>
          new Promise<void>(resolve => {
            if (!db.name) {
              return resolve()
            }
            names.push(db.name)
            const request = indexedDB.deleteDatabase(db.name)
            request.onsuccess = () => resolve()
            request.onerror = () => resolve()
            request.onblocked = () => resolve()
          })
      )
    )
    return names
  })
}

/** Runs the app side of one full wallet login from the login page. */
async function loginFromAppPage(
  appPage: Page,
  walletContext: BrowserContext,
  { passphrase }: { passphrase: string }
) {
  await expect(appPage.getByTestId('login-with-wallet')).toBeEnabled({
    timeout: 15_000
  })
  await appPage.getByTestId('login-with-wallet').click()

  // The single App Connect popup: mint-or-match the app key + grants.
  const connect = await popChapiRequest(appPage)
  expect(connect.type).toBe('get')
  const connectResponse = await driveWalletGet(walletContext, {
    vpr: connect.body,
    passphrase
  })
  await respondChapi(appPage, connect.id, connectResponse)

  // Login completes and the router lands on the dashboard.
  await expect(appPage.getByTestId('dashboard-page')).toBeVisible({
    timeout: 60_000
  })
}

/** Creates a "someday" action item on the app dashboard. */
async function createItem(appPage: Page, name: string) {
  await appPage.getByTestId('new-item-input-someday').fill(name)
  await appPage.getByTestId('add-item-someday').click()
  await expect(
    appPage
      .getByTestId('category-list-someday')
      .getByTestId('action-item-row')
      .filter({ hasText: name })
  ).toBeVisible()
}

function itemRow(appPage: Page, name: string) {
  return appPage
    .getByTestId('category-list-someday')
    .getByTestId('action-item-row')
    .filter({ hasText: name })
}

/* --------------------------------- test ---------------------------------- */

test('login with wallet: first login, replication, logout/login, cleared-storage recovery, expiry fallthrough', async ({
  context
}, testInfo) => {
  /* Phase 0: create the wallet account (stays logged in on the dashboard). */
  const walletPage = await context.newPage()
  const { passphrase } = await signupWallet(walletPage, testInfo)

  /* Phase 1: first login -- one App Connect popup mints the app key and
     approves the grants. */
  const appPage = await context.newPage()
  await armChapiBridge(appPage)
  await appPage.goto(`${APP_URL}/#/login`)
  await expect(appPage.getByTestId('login-page')).toBeVisible()
  await loginFromAppPage(appPage, context, { passphrase })

  // The persisted session mirrors the grant contract: one grant per
  // collection (no whole-space read grant -- dropped for privacy), all
  // controlled by the app DID, all rooted in ONE space on the local WAS
  // server, all expiring in the future.
  const record = await readSessionRecord(appPage)
  expect(record).not.toBeNull()
  expect(record!.serverUrl).toBe(WAS_URL)
  expect(record!.grants).toHaveLength(COLLECTION_IDS.length)
  expect(record!.controllerDid).toMatch(/^did:key:z6Mk/)
  const spacePrefix = `${WAS_URL}/space/${record!.spaceId}`
  for (const grant of record!.grants) {
    expect(grant.controller).toBe(record!.controllerDid)
    expect(grant.invocationTarget.startsWith(spacePrefix)).toBe(true)
    expect(grant.parentCapability).toBe(
      `urn:zcap:root:${encodeURIComponent(spacePrefix)}`
    )
    expect(new Date(grant.expires).getTime()).toBeGreaterThan(Date.now())
  }
  for (const collectionId of COLLECTION_IDS) {
    expect(
      record!.grants.some(
        grant => grant.invocationTarget === `${spacePrefix}/${collectionId}`
      )
    ).toBe(true)
  }
  expect(new Date(record!.expires).getTime()).toBeGreaterThan(Date.now())

  /* Phase 2: write data and wait for it to replicate to WAS. */
  const itemName = `wallet-e2e-${Date.now()}`
  await createItem(appPage, itemName)
  await expect(appPage.getByTestId('sync-status-chip')).toHaveAttribute(
    'data-sync-state',
    'synced',
    { timeout: 45_000 }
  )

  /* Phase 3: reload = hot restore (zero wallet interactions), data intact. */
  await appPage.reload()
  await expect(appPage.getByTestId('dashboard-page')).toBeVisible({
    timeout: 30_000
  })
  await expect(itemRow(appPage, itemName)).toBeVisible()

  /* Phase 4: log out erasing the local replica (LogoutDialog's wipe option),
     so the returning login must recover the item from WAS rather than from
     local storage. Logout leaves the connected state; the login-gated router
     redirects to /login. The returning login matches the stored app key
     instead of minting a new one. */
  await appPage.getByTestId('nav-logout').click()
  await appPage.getByTestId('logout-wipe').click()
  await expect(appPage.getByTestId('login-page')).toBeVisible({
    timeout: 15_000
  })
  expect(await readSessionRecord(appPage)).toBeNull()
  await loginFromAppPage(appPage, context, { passphrase })
  await expect(itemRow(appPage, itemName)).toBeVisible({ timeout: 30_000 })

  /* Phase 5: cleared-storage recovery. Wipe EVERY app-origin database (seed,
     session, encrypted envelopes); the wallet still holds the key credential
     and WAS holds the envelopes, so a returning login recovers both. */
  await appPage.evaluate(
    () =>
      new Promise<void>(resolve => {
        const request = indexedDB.deleteDatabase('life-advisor-session')
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })
  )
  await appPage.reload()
  // With no session the app parks on /login and holds no RxDB connections;
  // now the data databases can be deleted unblocked.
  await expect(appPage.getByTestId('login-page')).toBeVisible({
    timeout: 30_000
  })
  const deleted = await wipeAppDatabases(appPage)
  expect(deleted.length).toBeGreaterThan(0)
  await appPage.reload()
  await expect(appPage.getByTestId('login-page')).toBeVisible({
    timeout: 30_000
  })
  await loginFromAppPage(appPage, context, { passphrase })
  // The item is back -- decrypted from envelopes pulled from WAS with the
  // wallet-recovered seed.
  await expect(itemRow(appPage, itemName)).toBeVisible({ timeout: 45_000 })

  /* Phase 6: an expired session record falls through to the login page
     instead of hot-restoring. */
  await patchSessionRecord(appPage, {
    expires: new Date(Date.now() - 60_000).toISOString()
  })
  await appPage.goto(`${APP_URL}/#/`)
  await appPage.reload()
  await expect(appPage.getByTestId('login-page')).toBeVisible({
    timeout: 30_000
  })
  // The expired record was cleared, not retried.
  expect(await readSessionRecord(appPage)).toBeNull()
})
