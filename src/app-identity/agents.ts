/**
 * WAS identity + per-collection vault-key derivation from a 32-byte master seed.
 * Adapted from freewallet's `agentsFromSeed` (`src/session/initSession.ts`) and
 * freewallet-mobile's `app/lib/sync/agents.ts`.
 *
 * SEED-DERIVATION CONVENTION (pinned, part of the shared-key contract): the
 * pinned `@interop/webkms-client` exposes `CapabilityAgent.fromSeed({ seed })`,
 * which takes the raw 32 bytes AS-IS (no hashing). We use it for BOTH the master
 * identity and the per-collection key-agreement keys, feeding raw bytes -- never
 * `fromSecret`, which salt-hashes a STRING and would derive a different key for
 * a byte array vs its text form. Feeding `fromSeed` a fixed `handle` / `keyName`
 * keeps the derivation stable; the byte material alone selects the key.
 *
 * Per-collection KAKs derive via `HKDF-SHA256(master, info = 'kak:v1:<id>')` to
 * a 32-byte per-collection seed, then the standard Ed25519-to-X25519 path. HKDF
 * one-wayness means a shared per-collection key exposes nothing about the master
 * or sibling collections -- the future multi-app sharing unit.
 *
 * Not test-node-safe on React Native, but fine under Node/Vitest: the crypto
 * stack (`webkms-client`, `x25519-key-agreement-key`) runs on the standard Web
 * Crypto that Node 24 provides.
 */
import { CapabilityAgent } from '@interop/webkms-client'
import { Ed25519Signature2020 } from '@interop/ed25519-signature'
import { ZcapClient } from '@interop/ezcap'
import { X25519KeyAgreementKey2020 } from '@interop/x25519-key-agreement-key'
import type {
  IKeyAgreementKey,
  IKeyResolver
} from '@interop/data-integrity-core'

// Fixed derivation labels. The seed bytes alone select the key; these only name
// the agent (see the convention note above), so they are constant.
const IDENTITY_HANDLE = 'life-advisor'
const IDENTITY_KEY_NAME = 'app-key'
const KAK_HANDLE = 'life-advisor-kak'
const KAK_KEY_NAME = 'kak'

/**
 * The hardcoded 32-byte development master seed. Stands in for the wallet-stored
 * seed credential while running fully local (no wallet). Every install shares
 * this seed, so all local data is mutually decryptable -- acceptable only for
 * local development.
 */
export const DEV_SEED: Uint8Array = new Uint8Array([
  0x6c, 0x69, 0x66, 0x65, 0x2d, 0x61, 0x64, 0x76, 0x69, 0x73, 0x6f, 0x72, 0x2d,
  0x64, 0x65, 0x76, 0x2d, 0x73, 0x65, 0x65, 0x64, 0x2d, 0x30, 0x31, 0x32, 0x33,
  0x34, 0x35, 0x36, 0x37, 0x38, 0x39
])

/**
 * The agents derived from the master seed: the app's stable did:key controller,
 * its signing agent, and a ZcapClient for signing storage requests later.
 */
export interface IdentityAgents {
  controllerDid: string
  keyAgent: CapabilityAgent
  zcapClient: ZcapClient
}

/**
 * Derives one collection's X25519 key agreement key (KAK) plus its resolver, the
 * material the {@link createDocCipher} needs. The concrete KAK type carries
 * `type` / `publicKeyMultibase`; it is widened to `IKeyAgreementKey` only at the
 * boundary.
 */
export interface CollectionKeys {
  keyAgreementKey: IKeyAgreementKey
  keyResolver: IKeyResolver
}

/**
 * HKDF-SHA256 expansion of the master seed into a 32-byte per-context seed.
 *
 * @param master {Uint8Array}
 * @param info {string}   the domain-separation label (e.g. `kak:v1:projects`)
 * @returns {Promise<Uint8Array>}
 */
async function hkdfExpand(
  master: Uint8Array,
  info: string
): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    master as unknown as BufferSource,
    'HKDF',
    false,
    ['deriveBits']
  )
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info)
    },
    key,
    256
  )
  return new Uint8Array(bits)
}

/**
 * Derives the master identity agents from the master seed. The did:key
 * controller is stable across devices for the same seed.
 *
 * @param options {object}
 * @param options.seed {Uint8Array}   the 32-byte master seed
 * @returns {Promise<IdentityAgents>}
 */
export async function deriveIdentity({
  seed
}: {
  seed: Uint8Array
}): Promise<IdentityAgents> {
  const keyAgent = await CapabilityAgent.fromSeed({
    seed,
    handle: IDENTITY_HANDLE,
    keyName: IDENTITY_KEY_NAME
  })
  const signer = keyAgent.getSigner()
  const zcapClient = new ZcapClient({
    SuiteClass: Ed25519Signature2020,
    invocationSigner: signer,
    delegationSigner: signer
  })
  return { controllerDid: keyAgent.id, keyAgent, zcapClient }
}

/**
 * Derives one collection's vault key material from the master seed:
 * `HKDF(master, 'kak:v1:<collectionId>')` to a per-collection seed, then the
 * Ed25519-to-X25519 (Montgomery-form) key-agreement key. Deterministic, so the
 * same seed decrypts the same envelopes on any device. Encryption uses these
 * per-collection KAKs from day one -- never share one KAK across collections.
 *
 * @param options {object}
 * @param options.seed {Uint8Array}       the 32-byte master seed
 * @param options.collectionId {string}   the WAS collection id (the HKDF label)
 * @returns {Promise<CollectionKeys>}
 */
export async function deriveCollectionKeys({
  seed,
  collectionId
}: {
  seed: Uint8Array
  collectionId: string
}): Promise<CollectionKeys> {
  const collectionSeed = await hkdfExpand(seed, `kak:v1:${collectionId}`)
  const keyAgent = await CapabilityAgent.fromSeed({
    seed: collectionSeed,
    handle: KAK_HANDLE,
    keyName: KAK_KEY_NAME
  })
  const keyAgreementKey =
    X25519KeyAgreementKey2020.fromEd25519VerificationKey2020({
      keyPair: keyAgent.getVerificationKeyPair()
    })
  const keyResolver: IKeyResolver = async ({ id }: { id?: string }) => {
    if (id !== keyAgreementKey.id) {
      throw new Error(`Unknown key id "${id}".`)
    }
    return {
      id: keyAgreementKey.id,
      type: keyAgreementKey.type,
      publicKeyMultibase: keyAgreementKey.publicKeyMultibase
    }
  }
  return {
    keyAgreementKey: keyAgreementKey as IKeyAgreementKey,
    keyResolver
  }
}
