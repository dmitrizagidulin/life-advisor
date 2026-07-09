/**
 * verifyResponse tests. A mock "wallet" (its own did:key identity, distinct
 * from the app's) signs presentations exactly the way freewallet does --
 * Ed25519Signature2020 DIDAuth proof over a VP with the LifeAdvisorKey VC
 * embedded and/or a `zcap` grant array (bare term added to the context) --
 * and the RP-side checks are exercised against good and crafted-bad inputs.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import * as vc from '@interop/vc'
import { Ed25519Signature2020 } from '@interop/ed25519-signature'
import { CapabilityAgent } from '@interop/webkms-client'
import type {
  IVerifiableCredential,
  IVerifiablePresentation,
  IZcap
} from '@interop/data-integrity-core'
import {
  documentLoader,
  issueSeedCredential
} from '@/app-identity/seedCredential'
import { deriveIdentity } from '@/app-identity/agents'
import {
  checkGrants,
  grantsOf,
  verifyLoginPresentation
} from '@/auth/verifyResponse'
import { LA_COLLECTIONS } from '@/app.config'

const ORIGIN = 'http://localhost:5173'
const SERVER_URL = 'http://localhost:3999'
const SPACE_URL = `${SERVER_URL}/space/e2e-space`

const ZCAP_TERM_CONTEXT = {
  '@protected': true,
  zcap: { '@id': 'urn:freewallet:vocab#zcap', '@container': '@set' }
} as const

interface WalletIdentity {
  holder: string
  suite: Ed25519Signature2020
}

let wallet: WalletIdentity
let appDid: string
let appSeed: Uint8Array

beforeAll(async () => {
  const agent = await CapabilityAgent.fromSeed({
    seed: crypto.getRandomValues(new Uint8Array(32)),
    handle: 'mock-wallet',
    keyName: 'wallet-key'
  })
  wallet = {
    holder: agent.id,
    suite: new Ed25519Signature2020({ signer: agent.getSigner() })
  }
  appSeed = crypto.getRandomValues(new Uint8Array(32))
  appDid = (await deriveIdentity({ seed: appSeed })).controllerDid
})

/** An UNSIGNED structural grant (checkGrants is structural, not cryptographic). */
function grantFor({
  collectionId,
  controller = appDid,
  expires = new Date(Date.now() + 86_400_000).toISOString(),
  actions = ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
  spaceUrl = SPACE_URL
}: {
  collectionId?: string
  controller?: string
  expires?: string
  actions?: string[]
  spaceUrl?: string
}): IZcap {
  return {
    '@context': 'https://w3id.org/zcap/v1',
    id: `urn:zcap:${crypto.randomUUID()}`,
    controller,
    parentCapability: `urn:zcap:root:${encodeURIComponent(spaceUrl)}`,
    invocationTarget: collectionId ? `${spaceUrl}/${collectionId}` : spaceUrl,
    allowedAction: actions,
    expires
  } as unknown as IZcap
}

/** The full wallet-shaped grant set: 8 RW collection grants + space read. */
function fullGrantSet(): IZcap[] {
  const grants = LA_COLLECTIONS.map(({ id }) => grantFor({ collectionId: id }))
  grants.push(grantFor({ actions: ['GET', 'HEAD'] }))
  return grants
}

/** Signs a wallet-style VP with optional embedded VC and zcap array. */
async function walletVp({
  challenge,
  domain = ORIGIN,
  credential,
  zcaps
}: {
  challenge: string
  domain?: string
  credential?: IVerifiableCredential
  zcaps?: IZcap[]
}): Promise<IVerifiablePresentation> {
  const presentation = vc.createPresentation({
    holder: wallet.holder,
    ...(credential && { verifiableCredential: [credential] }),
    verify: false,
    version: 1.0
  }) as { '@context': unknown; zcap?: IZcap[] }
  if (zcaps && zcaps.length > 0) {
    const base = presentation['@context']
    presentation['@context'] = [
      ...(Array.isArray(base) ? base : [base]),
      ZCAP_TERM_CONTEXT
    ]
    presentation.zcap = zcaps
  }
  return (await vc.signPresentation({
    presentation: presentation as unknown as vc.Presentation,
    challenge,
    domain,
    documentLoader,
    suite: wallet.suite
  })) as IVerifiablePresentation
}

describe('verifyLoginPresentation', () => {
  it('accepts a wallet-signed VP with an embedded LifeAdvisorKey and grants', async () => {
    const challenge = crypto.randomUUID()
    const credential = await issueSeedCredential({
      seed: appSeed,
      origin: ORIGIN
    })
    const presentation = await walletVp({
      challenge,
      credential,
      zcaps: fullGrantSet()
    })
    await expect(
      verifyLoginPresentation({ presentation, challenge, domain: ORIGIN })
    ).resolves.toBeUndefined()
    expect(grantsOf(presentation)).toHaveLength(LA_COLLECTIONS.length + 1)
  })

  it('rejects a challenge mismatch', async () => {
    const presentation = await walletVp({ challenge: 'sent-nonce' })
    await expect(
      verifyLoginPresentation({
        presentation,
        challenge: 'other-nonce',
        domain: ORIGIN
      })
    ).rejects.toThrow()
  })

  it('rejects a domain mismatch', async () => {
    const challenge = crypto.randomUUID()
    const presentation = await walletVp({
      challenge,
      domain: 'https://evil.example'
    })
    await expect(
      verifyLoginPresentation({ presentation, challenge, domain: ORIGIN })
    ).rejects.toThrow(/domain/)
  })

  it('rejects a tampered presentation', async () => {
    const challenge = crypto.randomUUID()
    const presentation = await walletVp({
      challenge,
      zcaps: fullGrantSet()
    })
    const tampered = {
      ...presentation,
      zcap: [
        ...(presentation as unknown as { zcap: IZcap[] }).zcap.slice(1),
        grantFor({ collectionId: 'injected', controller: 'did:example:mallory' })
      ]
    } as IVerifiablePresentation
    await expect(
      verifyLoginPresentation({
        presentation: tampered,
        challenge,
        domain: ORIGIN
      })
    ).rejects.toThrow()
  })

  it('rejects an unsigned presentation', async () => {
    const presentation = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation']
    } as unknown as IVerifiablePresentation
    await expect(
      verifyLoginPresentation({
        presentation,
        challenge: 'x',
        domain: ORIGIN
      })
    ).rejects.toThrow()
  })

  it('rejects a tampered embedded credential', async () => {
    const challenge = crypto.randomUUID()
    const credential = await issueSeedCredential({
      seed: appSeed,
      origin: ORIGIN
    })
    const subject = credential.credentialSubject as Record<string, unknown>
    const tamperedVc = {
      ...credential,
      credentialSubject: { ...subject, origin: 'https://evil.example' }
    } as IVerifiableCredential
    const presentation = await walletVp({ challenge })
    ;(presentation as { verifiableCredential?: unknown }).verifiableCredential =
      [tamperedVc]
    await expect(
      verifyLoginPresentation({ presentation, challenge, domain: ORIGIN })
    ).rejects.toThrow()
  })
})

describe('checkGrants', () => {
  it('accepts the full wallet grant set and reports topology + expiry', () => {
    const soon = new Date(Date.now() + 3_600_000).toISOString()
    const later = new Date(Date.now() + 86_400_000).toISOString()
    const grants = LA_COLLECTIONS.map(({ id }, index) =>
      grantFor({ collectionId: id, expires: index === 0 ? soon : later })
    )
    grants.push(grantFor({ actions: ['GET', 'HEAD'], expires: later }))
    const checked = checkGrants({
      grants,
      controllerDid: appDid,
      expectedServerUrl: SERVER_URL
    })
    expect(checked.parsed.serverUrl).toBe(SERVER_URL)
    expect(checked.parsed.spaceId).toBe('e2e-space')
    expect(Object.keys(checked.parsed.byCollectionId)).toHaveLength(
      LA_COLLECTIONS.length
    )
    expect(checked.expires).toBe(soon)
  })

  it('rejects an empty grant set', () => {
    expect(() => checkGrants({ grants: [], controllerDid: appDid })).toThrow(
      /no storage grants/
    )
  })

  it('rejects a grant controlled by another DID', () => {
    const grants = fullGrantSet()
    ;(grants[0] as { controller: string }).controller = 'did:example:mallory'
    expect(() => checkGrants({ grants, controllerDid: appDid })).toThrow(
      /controlled by/
    )
  })

  it('rejects an expired grant', () => {
    const grants = fullGrantSet()
    ;(grants[2] as { expires: string }).expires = new Date(
      Date.now() - 1000
    ).toISOString()
    expect(() => checkGrants({ grants, controllerDid: appDid })).toThrow(
      /expired/
    )
  })

  it('rejects a grant set on the wrong server', () => {
    expect(() =>
      checkGrants({
        grants: fullGrantSet(),
        controllerDid: appDid,
        expectedServerUrl: 'http://localhost:4000'
      })
    ).toThrow(/expected/)
  })

  it('rejects a grant set spanning two spaces', () => {
    const grants = fullGrantSet()
    grants.push(
      grantFor({
        collectionId: 'projects',
        spaceUrl: `${SERVER_URL}/space/other-space`
      })
    )
    expect(() => checkGrants({ grants, controllerDid: appDid })).toThrow(
      /two spaces/
    )
  })

  it('rejects a set missing a collection', () => {
    const grants = LA_COLLECTIONS.slice(1).map(({ id }) =>
      grantFor({ collectionId: id })
    )
    expect(() => checkGrants({ grants, controllerDid: appDid })).toThrow(
      new RegExp(`No grant covers the "${LA_COLLECTIONS[0]!.id}"`)
    )
  })

  it('rejects a collection grant with insufficient actions', () => {
    const grants = fullGrantSet()
    ;(grants[0] as { allowedAction: string[] }).allowedAction = ['GET', 'HEAD']
    expect(() => checkGrants({ grants, controllerDid: appDid })).toThrow(
      /lacks required actions/
    )
  })
})
