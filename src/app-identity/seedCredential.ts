/**
 * The LifeAdvisorKey credential: a self-issued VC holding the app's 32-byte
 * master seed, stored in (and recovered from) the user's wallet. Modeled on
 * freewallet's `src/lib/loginCredential.ts` inline-context pattern.
 *
 * The credential is self-issued: `issuer === credentialSubject.id`, and both
 * equal the did:key controller DERIVED FROM THE EMBEDDED SEED -- so possession
 * of the credential is possession of the identity, and a parsed credential can
 * be re-checked against its own seed. `credentialSubject.origin` binds the
 * credential to this app's web origin (the anti-phishing guard checked at
 * login). Keep the vocabulary self-describing and generalizable; other apps
 * will eventually hold sibling credential types on the same pattern.
 */
import * as vc from '@interop/vc'
import { Ed25519Signature2020 } from '@interop/ed25519-signature'
import type {
  IVerifiableCredential,
  IVerifiablePresentation
} from '@interop/data-integrity-core'
import { deriveIdentity } from '@/app-identity/agents'
import { documentLoader } from '@/app-identity/documentLoader'

export const LIFE_ADVISOR_KEY_TYPE = 'LifeAdvisorKey'

const VC_1_CONTEXT_URL = 'https://www.w3.org/2018/credentials/v1'

// Inline context: the credential stays verifiable with no remote vocabulary
// fetch, and the terms are namespaced under a stable URN vocabulary.
const LIFE_ADVISOR_KEY_CONTEXT = {
  '@protected': true,
  LifeAdvisorKey: 'urn:life-advisor:vocab#LifeAdvisorKey',
  seed: 'urn:life-advisor:vocab#seed',
  origin: 'urn:life-advisor:vocab#origin'
} as const

export { documentLoader }

/** Encodes bytes as base64url (no padding), browser- and Node-safe. */
export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decodes base64url text back into bytes. */
export function base64urlToBytes(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Self-issues the LifeAdvisorKey credential for `seed`, signed
 * Ed25519Signature2020 by the seed-derived signer.
 *
 * @param options {object}
 * @param options.seed {Uint8Array}   the 32-byte master seed
 * @param options.origin {string}     this app's web origin (anti-phishing bind)
 * @returns {Promise<IVerifiableCredential>}
 */
export async function issueSeedCredential({
  seed,
  origin
}: {
  seed: Uint8Array
  origin: string
}): Promise<IVerifiableCredential> {
  if (seed.length !== 32) {
    throw new Error(`Master seed must be 32 bytes (got ${seed.length}).`)
  }
  const { controllerDid, keyAgent } = await deriveIdentity({ seed })
  const credential = {
    '@context': [VC_1_CONTEXT_URL, LIFE_ADVISOR_KEY_CONTEXT],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', LIFE_ADVISOR_KEY_TYPE],
    issuer: controllerDid,
    credentialSubject: {
      id: controllerDid,
      seed: bytesToBase64url(seed),
      origin
    }
  }
  const suite = new Ed25519Signature2020({ signer: keyAgent.getSigner() })
  return (await vc.issue({
    credential,
    suite,
    documentLoader
  })) as IVerifiableCredential
}

/**
 * Wraps a credential in a minimal (unsigned) VP for CHAPI `store()`. The
 * credential's own proof self-authenticates; the offer envelope needs none.
 */
export function wrapCredentialForStore(
  credential: IVerifiableCredential
): IVerifiablePresentation {
  return {
    '@context': [VC_1_CONTEXT_URL],
    type: ['VerifiablePresentation'],
    verifiableCredential: [credential]
  } as unknown as IVerifiablePresentation
}

/** A parsed and structurally validated LifeAdvisorKey credential. */
export interface ParsedSeedCredential {
  seed: Uint8Array
  controllerDid: string
}

/**
 * Parses a LifeAdvisorKey credential and enforces the structural contract:
 * type, self-issue (issuer === subject id), origin binding, a well-formed
 * 32-byte seed, and -- the strongest check -- that the DID derived from the
 * embedded seed IS the credential's subject/issuer DID. (The cryptographic
 * proof on the credential is verified separately at the presentation level.)
 *
 * @param options {object}
 * @param options.credential {IVerifiableCredential}
 * @param options.origin {string}   the expected app origin
 * @returns {Promise<ParsedSeedCredential>}
 */
export async function parseSeedCredential({
  credential,
  origin
}: {
  credential: IVerifiableCredential
  origin: string
}): Promise<ParsedSeedCredential> {
  const types = Array.isArray(credential.type)
    ? credential.type
    : [credential.type]
  if (!types.includes(LIFE_ADVISOR_KEY_TYPE)) {
    throw new Error('Credential is not a LifeAdvisorKey credential.')
  }
  const issuer =
    typeof credential.issuer === 'string'
      ? credential.issuer
      : (credential.issuer as { id?: string } | undefined)?.id
  const subject = credential.credentialSubject as {
    id?: string
    seed?: string
    origin?: string
  }
  if (!issuer || !subject?.id || issuer !== subject.id) {
    throw new Error('LifeAdvisorKey credential is not self-issued.')
  }
  if (subject.origin !== origin) {
    throw new Error(
      `LifeAdvisorKey origin "${subject.origin ?? ''}" does not match this app's origin "${origin}".`
    )
  }
  if (typeof subject.seed !== 'string' || subject.seed.length === 0) {
    throw new Error('LifeAdvisorKey credential carries no seed.')
  }
  const seed = base64urlToBytes(subject.seed)
  if (seed.length !== 32) {
    throw new Error(
      `LifeAdvisorKey seed must decode to 32 bytes (got ${seed.length}).`
    )
  }
  const { controllerDid } = await deriveIdentity({ seed })
  if (controllerDid !== subject.id) {
    throw new Error(
      'LifeAdvisorKey seed does not derive the credential subject DID.'
    )
  }
  return { seed, controllerDid }
}

/**
 * Finds the LifeAdvisorKey credential inside a wallet response VP, or `null`
 * when the wallet returned none (the first-run signal).
 */
export function findSeedCredential(
  presentation: IVerifiablePresentation
): IVerifiableCredential | null {
  const embedded = (
    presentation as { verifiableCredential?: unknown }
  ).verifiableCredential
  const list = Array.isArray(embedded) ? embedded : embedded ? [embedded] : []
  for (const entry of list) {
    const types = (entry as { type?: string | string[] }).type
    const asArray = Array.isArray(types) ? types : [types]
    if (asArray.includes(LIFE_ADVISOR_KEY_TYPE)) {
      return entry as IVerifiableCredential
    }
  }
  return null
}
