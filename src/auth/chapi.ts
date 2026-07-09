/**
 * The CHAPI transport: credential-handler-polyfill loading (authn.io mediator)
 * plus thin `get()` / `store()` wrappers around `navigator.credentials`.
 *
 * E2E seam (non-production builds only): the real CHAPI channel needs the
 * mediator's cross-origin handshake, which a test harness cannot perform.
 * When a Playwright spec sets `window.__LA_E2E_CHAPI__ = true` (via
 * addInitScript), requests are queued on `window.__LA_CHAPI_REQUESTS__`
 * instead; the spec observes them, drives the wallet page directly (using
 * freewallet's own `__E2E_CHAPI_GET_EVENT__` injection), and posts the wallet
 * response into `window.__LA_CHAPI_RESPONSES__[id]`. Responses use the CHAPI
 * WebCredential wire shape `{ dataType, data } | null`.
 */
import { loadOnce, WebCredential } from 'credential-handler-polyfill'
import type { IVerifiablePresentation } from '@interop/data-integrity-core'
import { MEDIATOR_BASE } from '@/app.config'
import type { IVPRDetails } from '@/lib/walletRequest/types'

/** The wire shape a CHAPI response resolves to. */
interface ChapiWireResponse {
  dataType?: string
  data?: unknown
}

interface E2eBridgeWindow extends Window {
  __LA_E2E_CHAPI__?: boolean
  __LA_CHAPI_REQUESTS__?: Array<{
    id: number
    type: 'get' | 'store'
    body: unknown
  }>
  __LA_CHAPI_RESPONSES__?: Record<number, ChapiWireResponse | null>
}

function e2eBridgeActive(): boolean {
  return (
    import.meta.env.MODE !== 'production' &&
    (window as E2eBridgeWindow).__LA_E2E_CHAPI__ === true
  )
}

let e2eRequestId = 0

/** Queues a request for the e2e harness and polls for its response. */
async function e2eRoundTrip(
  type: 'get' | 'store',
  body: unknown
): Promise<ChapiWireResponse | null> {
  const win = window as E2eBridgeWindow
  win.__LA_CHAPI_REQUESTS__ ??= []
  win.__LA_CHAPI_RESPONSES__ ??= {}
  const id = ++e2eRequestId
  win.__LA_CHAPI_REQUESTS__.push({ id, type, body })
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (id in win.__LA_CHAPI_RESPONSES__) {
      const value = win.__LA_CHAPI_RESPONSES__[id]
      delete win.__LA_CHAPI_RESPONSES__[id]
      return value ?? null
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error('E2E CHAPI bridge timed out waiting for a response.')
}

let polyfillLoaded = false

/** Loads the CHAPI polyfill once (no-op under the e2e bridge). */
export async function loadChapi(): Promise<void> {
  if (polyfillLoaded || e2eBridgeActive()) {
    return
  }
  await loadOnce(MEDIATOR_BASE + encodeURIComponent(window.location.origin))
  polyfillLoaded = true
}

/**
 * Sends a VPR to the user's wallet via CHAPI `credentials.get()`. Returns the
 * wallet's response VP, or `null` when the user cancelled/dismissed.
 */
export async function chapiGet(
  vpr: IVPRDetails
): Promise<IVerifiablePresentation | null> {
  let wire: ChapiWireResponse | null
  if (e2eBridgeActive()) {
    wire = await e2eRoundTrip('get', vpr)
  } else {
    await loadChapi()
    const result = (await navigator.credentials.get({
      // The polyfill extends CredentialRequestOptions with the `web` member.
      web: { VerifiablePresentation: vpr }
    } as CredentialRequestOptions)) as unknown as ChapiWireResponse | null
    wire = result
  }
  if (!wire || wire.data === undefined || wire.data === null) {
    return null
  }
  return wire.data as IVerifiablePresentation
}

/**
 * Offers a VP (wrapping a credential) to the wallet via CHAPI
 * `credentials.store()`. Returns true when the wallet confirmed the store,
 * false when the user cancelled/dismissed.
 */
export async function chapiStore(
  presentation: IVerifiablePresentation
): Promise<boolean> {
  if (e2eBridgeActive()) {
    const wire = await e2eRoundTrip('store', presentation)
    return wire !== null && wire.data !== undefined && wire.data !== null
  }
  await loadChapi()
  const credential = new WebCredential(
    'VerifiablePresentation',
    presentation as unknown as object
  )
  const result = (await navigator.credentials.store(
    credential as unknown as Credential
  )) as unknown as ChapiWireResponse | null
  return result !== null && result !== undefined
}
