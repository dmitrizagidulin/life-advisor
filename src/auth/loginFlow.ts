/**
 * The Login-With-Wallet orchestration:
 *
 * - First run (the wallet holds no LifeAdvisorKey): generate a fresh 32-byte
 *   master seed, self-issue the credential, and BLOCK until the wallet
 *   confirms storing it (a dismissed store would silently break cross-device
 *   recovery), then request the storage grants.
 * - Returning (the wallet returns the credential): recover the seed, verify
 *   the credential's self-issue/origin/DID binding, then request grants for
 *   the same stable controller DID.
 *
 * Hot restore (seed + grants already persisted locally) never reaches this
 * module -- `authStore.restore()` short-circuits it.
 */
import { APP_ORIGIN, WAS_SERVER_URL } from '@/app.config'
import type { IZcap } from '@interop/data-integrity-core'
import {
  findSeedCredential,
  issueSeedCredential,
  parseSeedCredential,
  wrapCredentialForStore
} from '@/app-identity/seedCredential'
import { initAppSession } from '@/app-identity/initAppSession'
import type { IdentityAgents } from '@/app-identity/agents'
import { chapiGet, chapiStore } from '@/auth/chapi'
import {
  buildGrantsVpr,
  buildSeedProbeVpr,
  newChallenge
} from '@/auth/loginRequest'
import {
  checkGrants,
  grantsOf,
  verifyLoginPresentation,
  type CheckedGrants
} from '@/auth/verifyResponse'
import type { ParsedGrants } from '@/stores/grants'

/** A user-facing progress phase, for the login page's status line. */
export type LoginPhase =
  | 'probing'
  | 'storing-key'
  | 'requesting-grants'
  | 'verifying'

export interface LoginOutcome {
  seed: Uint8Array
  identity: IdentityAgents
  grants: IZcap[]
  parsed: ParsedGrants
  /** ISO timestamp: the earliest expiry across the grants. */
  expires: string
  /** Whether this login created a brand-new app key (first run). */
  firstRun: boolean
}

/** Thrown when the user cancels/dismisses a wallet popup. */
export class LoginCancelledError extends Error {
  constructor(step: string) {
    super(`The wallet request was cancelled (${step}).`)
    this.name = 'LoginCancelledError'
  }
}

/**
 * Requests storage grants for `identity` and validates them. Shared by the
 * login flow and the expired-access reconnect path.
 */
export async function requestGrants({
  identity,
  onPhase
}: {
  identity: IdentityAgents
  onPhase?: (phase: LoginPhase) => void
}): Promise<CheckedGrants> {
  onPhase?.('requesting-grants')
  const challenge = newChallenge()
  const vpr = buildGrantsVpr({
    challenge,
    domain: window.location.origin,
    controllerDid: identity.controllerDid
  })
  const presentation = await chapiGet(vpr)
  if (!presentation) {
    throw new LoginCancelledError('storage grants')
  }
  onPhase?.('verifying')
  await verifyLoginPresentation({
    presentation,
    challenge,
    domain: window.location.origin
  })
  return checkGrants({
    grants: grantsOf(presentation),
    controllerDid: identity.controllerDid,
    ...(WAS_SERVER_URL !== undefined && { expectedServerUrl: WAS_SERVER_URL })
  })
}

/**
 * Runs the full Login-With-Wallet flow (first-run or returning, decided by
 * the seed probe). Throws `LoginCancelledError` on dismissal and `Error` on
 * verification failures; nothing is persisted here (the caller persists).
 */
export async function loginWithWallet({
  onPhase
}: {
  onPhase?: (phase: LoginPhase) => void
} = {}): Promise<LoginOutcome> {
  // Popup #1: probe the wallet for an existing LifeAdvisorKey.
  onPhase?.('probing')
  const probeChallenge = newChallenge()
  const probeVpr = buildSeedProbeVpr({
    challenge: probeChallenge,
    domain: window.location.origin
  })
  const probeVp = await chapiGet(probeVpr)
  if (!probeVp) {
    throw new LoginCancelledError('wallet login')
  }
  await verifyLoginPresentation({
    presentation: probeVp,
    challenge: probeChallenge,
    domain: window.location.origin
  })

  let seed: Uint8Array
  let firstRun: boolean
  const credential = findSeedCredential(probeVp)
  if (credential) {
    // Returning login: recover the seed, enforce self-issue + origin + the
    // seed-to-DID binding.
    const parsed = await parseSeedCredential({
      credential,
      origin: APP_ORIGIN
    })
    seed = parsed.seed
    firstRun = false
  } else {
    // First run: mint a fresh master seed and store its credential in the
    // wallet. Block until the store succeeds -- without it, cross-device
    // recovery is silently broken.
    seed = crypto.getRandomValues(new Uint8Array(32))
    firstRun = true
    onPhase?.('storing-key')
    const issued = await issueSeedCredential({ seed, origin: APP_ORIGIN })
    const stored = await chapiStore(wrapCredentialForStore(issued))
    if (!stored) {
      throw new LoginCancelledError('saving your app key to the wallet')
    }
  }

  const identity = await initAppSession({ seed })
  // Popup #2: request the storage grants for the stable controller DID.
  const checked = await requestGrants({ identity, ...(onPhase && { onPhase }) })
  return {
    seed,
    identity,
    grants: checked.grants,
    parsed: checked.parsed,
    expires: checked.expires,
    firstRun
  }
}
