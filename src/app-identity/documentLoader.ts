/**
 * The app's one JSON-LD document loader: static security contexts plus did:key
 * / did:web resolution (`@interop/security-document-loader`).
 *
 * Local-dev shim: the did:web method mandates https, but the local
 * was-teaching-server (which hosts the wallet's did:web documents) runs plain
 * http. When the configured WAS server URL is http, DIDs on exactly that host
 * are resolved over it; everything else falls through to the standard loader.
 * In production (https server) the shim never engages.
 */
import { securityLoader } from '@interop/security-document-loader'
import { WAS_SERVER_URL } from '@/app.config'

const baseLoader = securityLoader({ fetchRemoteContexts: true }).build()

/** Per-suite context for a dereferenced verification-method node. */
const CONTEXT_BY_KEY_TYPE: Record<string, string> = {
  Ed25519VerificationKey2020: 'https://w3id.org/security/suites/ed25519-2020/v1',
  X25519KeyAgreementKey2020: 'https://w3id.org/security/suites/x25519-2020/v1',
  Multikey: 'https://w3id.org/security/multikey/v1'
}

/**
 * Maps a did:web DID onto the local http WAS server's URL, or `null` when the
 * DID does not live on that host (or the shim is not applicable).
 */
function insecureDidWebUrl(didAuthority: string): string | null {
  if (!WAS_SERVER_URL || !WAS_SERVER_URL.startsWith('http://')) {
    return null
  }
  const server = new URL(WAS_SERVER_URL)
  const segments = didAuthority.split(':')
  // ['did', 'web', '<encoded host>', ...path]
  const host = segments[2] ? decodeURIComponent(segments[2]) : ''
  if (host !== server.host) {
    return null
  }
  const path = segments.slice(3).map(decodeURIComponent).join('/')
  return `http://${host}/${path ? `${path}/did.json` : '.well-known/did.json'}`
}

interface DidDocumentNode {
  id?: string
  type?: string
  [key: string]: unknown
}

/** Dereferences a `#fragment` subnode the way did-web-resolver's getNode does. */
function nodeOf(didDocument: DidDocumentNode, id: string): DidDocumentNode {
  const methods = (didDocument.verificationMethod ?? []) as DidDocumentNode[]
  let match = methods.find((vm) => vm?.id === id)
  if (!match) {
    for (const [key, value] of Object.entries(didDocument)) {
      if (key === '@context' || key === 'verificationMethod') {
        continue
      }
      if (Array.isArray(value)) {
        match = (value as DidDocumentNode[]).find((entry) => entry?.id === id)
      } else if ((value as DidDocumentNode)?.id === id) {
        match = value as DidDocumentNode
      }
      if (match) {
        break
      }
    }
  }
  if (!match) {
    throw new Error(`DID document entity with id "${id}" not found.`)
  }
  const context =
    (match.type && CONTEXT_BY_KEY_TYPE[match.type]) ?? didDocument['@context']
  return { '@context': context, ...match }
}

/**
 * The document loader handed to `@interop/vc` issuance and verifier-core
 * verification. Same envelope shape as the base loader.
 */
export async function documentLoader(url: string): Promise<{
  contextUrl: string | null
  document: unknown
  documentUrl: string
}> {
  if (url.startsWith('did:web:')) {
    const [didAuthority = ''] = url.split(/[#?]/)
    const fetchUrl = insecureDidWebUrl(didAuthority)
    if (fetchUrl) {
      const response = await fetch(fetchUrl)
      if (!response.ok) {
        throw new Error(
          `Could not fetch the DID document at "${fetchUrl}" (status ${response.status}).`
        )
      }
      const didDocument = (await response.json()) as DidDocumentNode
      if (didDocument.id !== didAuthority) {
        throw new Error(`DID document for "${didAuthority}" not found.`)
      }
      const document = url.includes('#') ? nodeOf(didDocument, url) : didDocument
      return { contextUrl: null, document, documentUrl: url }
    }
  }
  return (await baseLoader(url)) as {
    contextUrl: string | null
    document: unknown
    documentUrl: string
  }
}
