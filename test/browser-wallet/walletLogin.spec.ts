/**
 * Login-With-Wallet e2e against a real local freewallet + was-teaching-server.
 *
 * CHAPI has no mediator here; two injection seams stand in for it:
 * - App side: `window.__LA_E2E_CHAPI__` switches `src/auth/chapi.ts` to a
 *   request queue (`__LA_CHAPI_REQUESTS__` / `__LA_CHAPI_RESPONSES__`) this
 *   spec services.
 * - Wallet side: freewallet's own non-production `__E2E_CHAPI_GET_EVENT__`
 *   seam drives its /#/wallet/get popup with the app's captured VPR; the
 *   response VP is read back off `__E2E_CHAPI_RESPONSE__`.
 * The CHAPI store() step has NO wallet-side seam (WalletStorePage reads the
 * real channel only), so the spec lands the credential through the wallet's
 * Add Credential paste flow -- the same wallet-vault write path -- and then
 * acks the app's store request.
 *
 * One serialized test walks the whole life cycle on a single wallet account
 * (signup is slow -- deliberately expensive PBKDF2): first login (store key +
 * grants + provisioning), replication, logout/login (returning path),
 * cleared-app-storage recovery (seed via QueryByExample, data from WAS), and
 * the expired-session fallthrough.
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
 * Services one app-captured `get()` VPR through the wallet's /#/wallet/get
 * page (freewallet's injection seam), returning the CHAPI wire response.
 */
async function driveWalletGet(
  context: BrowserContext,
  {
    vpr,
    passphrase,
    selectCredential = false
  }: { vpr: unknown; passphrase: string; selectCredential?: boolean }
): Promise<unknown> {
  const page = await context.newPage()
  await page.addInitScript(
    (cfg) => {
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
          void Promise.resolve(promise).then((value) => {
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
  if (selectCredential) {
    // The LifeAdvisorKey is not a wallet Login Credential, so it is not
    // pre-selected on the share screen.
    const checkbox = page.getByRole('checkbox').first()
    await checkbox.waitFor({ timeout: 15_000 })
    await checkbox.check()
  }
  await page.getByRole('button', { name: 'Continue' }).click()
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

/**
 * Lands a credential in the wallet vault via the dashboard Add Credential
 * paste flow (`walletPage` must be logged in on the dashboard).
 */
async function walletAddCredential(walletPage: Page, credentialJson: string) {
  await walletPage.getByRole('link', { name: 'Add Credential' }).click()
  await expect(walletPage).toHaveURL(/#\/add-credential/)
  await walletPage
    .getByRole('textbox', { name: /Paste a URL/ })
    .fill(credentialJson)
  await walletPage.getByRole('button', { name: 'Add' }).click()
  await expect(walletPage).toHaveURL(/#\/accept-credentials/)
  await walletPage.getByRole('button', { name: 'Accept all' }).click()
  await expect(walletPage).toHaveURL(/#\/dashboard/)
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
    ;(window as unknown as { __LA_E2E_CHAPI__?: boolean }).__LA_E2E_CHAPI__ =
      true
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
                __LA_CHAPI_REQUESTS__?: ChapiBridgeRequest[]
              }
            ).__LA_CHAPI_REQUESTS__?.shift() ?? null
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
        __LA_CHAPI_RESPONSES__?: Record<number, unknown>
      }
      win.__LA_CHAPI_RESPONSES__ ??= {}
      win.__LA_CHAPI_RESPONSES__[responseId as number] = responseValue
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
    (recordPatch) =>
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
        (db) =>
          new Promise<void>((resolve) => {
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
  {
    passphrase,
    walletPage,
    expectFirstRun
  }: { passphrase: string; walletPage: Page; expectFirstRun: boolean }
) {
  await expect(appPage.getByTestId('login-with-wallet')).toBeEnabled({
    timeout: 15_000
  })
  await appPage.getByTestId('login-with-wallet').click()

  // Popup #1: the seed probe.
  const probe = await popChapiRequest(appPage)
  expect(probe.type).toBe('get')
  const probeResponse = await driveWalletGet(walletContext, {
    vpr: probe.body,
    passphrase,
    selectCredential: !expectFirstRun
  })
  await respondChapi(appPage, probe.id, probeResponse)

  if (expectFirstRun) {
    // First run: the app stores its key credential in the wallet.
    const store = await popChapiRequest(appPage)
    expect(store.type).toBe('store')
    const offered = store.body as {
      verifiableCredential: Array<Record<string, unknown>>
    }
    const credential = offered.verifiableCredential[0]!
    expect(credential.type).toContain('LifeAdvisorKey')
    await walletAddCredential(walletPage, JSON.stringify(credential))
    await respondChapi(appPage, store.id, {
      dataType: 'VerifiablePresentation',
      data: store.body
    })
  }

  // Popup #2: the storage grants.
  const grants = await popChapiRequest(appPage)
  expect(grants.type).toBe('get')
  const grantsVpr = grants.body as {
    query: Array<{ type: string; capabilityQuery?: unknown[] }>
  }
  const zcapQuery = grantsVpr.query.find(
    (q) => q.type === 'AuthorizationCapabilityQuery'
  )
  expect(zcapQuery?.capabilityQuery).toHaveLength(COLLECTION_IDS.length + 1)
  const grantsResponse = await driveWalletGet(walletContext, {
    vpr: grants.body,
    passphrase
  })
  await respondChapi(appPage, grants.id, grantsResponse)

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

  /* Phase 1: first login -- store the app key, approve grants, enter. */
  const appPage = await context.newPage()
  await armChapiBridge(appPage)
  await appPage.goto(`${APP_URL}/#/login`)
  await expect(appPage.getByTestId('login-page')).toBeVisible()
  await loginFromAppPage(appPage, context, {
    passphrase,
    walletPage,
    expectFirstRun: true
  })

  // The persisted session mirrors the plan's grant contract: 9 grants (8
  // collections + space read), all controlled by the app DID, all rooted in
  // ONE space on the local WAS server, all expiring in the future.
  const record = await readSessionRecord(appPage)
  expect(record).not.toBeNull()
  expect(record!.serverUrl).toBe(WAS_URL)
  expect(record!.grants).toHaveLength(COLLECTION_IDS.length + 1)
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
        (grant) => grant.invocationTarget === `${spacePrefix}/${collectionId}`
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

  /* Phase 4: logout wipes the session; login again = returning path (the
     wallet returns the stored LifeAdvisorKey; no store() this time). */
  await appPage.getByTestId('nav-logout').click()
  await expect(appPage.getByTestId('back-to-login')).toBeVisible({
    timeout: 15_000
  })
  expect(await readSessionRecord(appPage)).toBeNull()
  await appPage.getByTestId('back-to-login').click()
  await expect(appPage.getByTestId('login-page')).toBeVisible()
  await loginFromAppPage(appPage, context, {
    passphrase,
    walletPage,
    expectFirstRun: false
  })
  await expect(itemRow(appPage, itemName)).toBeVisible({ timeout: 30_000 })

  /* Phase 5: cleared-storage recovery. Wipe EVERY app-origin database (seed,
     session, encrypted envelopes); the wallet still holds the key credential
     and WAS holds the envelopes, so a returning login recovers both. */
  await appPage.evaluate(() =>
    new Promise<void>((resolve) => {
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
  await loginFromAppPage(appPage, context, {
    passphrase,
    walletPage,
    expectFirstRun: false
  })
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
