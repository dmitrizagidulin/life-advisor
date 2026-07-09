/**
 * RP-side VPR construction for Login With Wallet. Two requests:
 *
 * 1. The seed probe: DIDAuthentication + QueryByExample for the LifeAdvisorKey
 *    credential. An empty result is the first-run signal; a hit recovers the
 *    master seed on a new device.
 * 2. The grants request: DIDAuthentication + AuthorizationCapabilityQuery with
 *    one capabilityQuery per collection (descriptor-object targets, which the
 *    wallet resolves against the user's one Space and auto-provisions) plus a
 *    read-only whole-space grant. The wallet force-caps whole-space grants to
 *    GET/HEAD, so read-only is all that is ever requested there.
 *
 * `domain` must host-match the CHAPI requesting origin or the wallet refuses
 * to sign; `challenge` must be fresh per request (echoed into the DIDAuth
 * proof and checked in verifyResponse).
 */
import { LA_COLLECTIONS } from '@/app.config'
import { LIFE_ADVISOR_KEY_TYPE } from '@/app-identity/seedCredential'
import type {
  ICapabilityQueryDetail,
  IVPRDetails
} from '@/lib/walletRequest/types'

/** Read/write actions requested on each app collection. */
export const RW_ACTIONS = ['GET', 'HEAD', 'PUT', 'POST', 'DELETE']

/** The referenceId of the read-only whole-space grant. */
export const SPACE_READ_REFERENCE_ID = 'space-read'

/** A fresh nonce for a VPR challenge. */
export function newChallenge(): string {
  return crypto.randomUUID()
}

/** VPR #1: DIDAuthentication + QueryByExample for the LifeAdvisorKey. */
export function buildSeedProbeVpr({
  challenge,
  domain
}: {
  challenge: string
  domain: string
}): IVPRDetails {
  return {
    query: [
      {
        type: 'DIDAuthentication',
        acceptedMethods: [{ method: 'key' }]
      },
      {
        type: 'QueryByExample',
        credentialQuery: {
          reason: 'Recover the Life Advisor app key stored in your wallet.',
          example: { type: LIFE_ADVISOR_KEY_TYPE }
        }
      }
    ],
    challenge,
    domain
  }
}

/**
 * VPR #2: DIDAuthentication + AuthorizationCapabilityQuery -- one read/write
 * capabilityQuery per app collection (delegated to `controllerDid`), plus a
 * read-only whole-space grant.
 */
export function buildGrantsVpr({
  challenge,
  domain,
  controllerDid
}: {
  challenge: string
  domain: string
  controllerDid: string
}): IVPRDetails {
  const capabilityQuery: ICapabilityQueryDetail[] = LA_COLLECTIONS.map(
    ({ id }) => ({
      referenceId: id,
      reason: `Store your Life Advisor data in the "${id}" collection.`,
      controller: controllerDid,
      allowedAction: RW_ACTIONS,
      invocationTarget: { type: 'urn:was:collection', name: id }
    })
  )
  capabilityQuery.push({
    referenceId: SPACE_READ_REFERENCE_ID,
    reason: 'Read your storage space description.',
    controller: controllerDid,
    allowedAction: ['GET', 'HEAD'],
    invocationTarget: { type: 'urn:was:space' }
  })
  return {
    query: [
      {
        type: 'DIDAuthentication',
        acceptedMethods: [{ method: 'key' }]
      },
      {
        type: 'AuthorizationCapabilityQuery',
        capabilityQuery
      }
    ],
    challenge,
    domain
  }
}
