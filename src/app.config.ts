/**
 * Application configuration: environment-variable exports and app-wide
 * constants. Adapted from freewallet's app.config: WAS host, this app's origin,
 * the registry of the eight storage collections, and the assembled
 * {@link WasAppConfig} handed to `@interop/was-react`.
 */
import type { WasAppConfig } from '@interop/was-react'

// Vite injects `import.meta.env` in the browser build; a plain Node context
// (a bare `tsx` import) has no such object, so fall back to an empty record
// rather than throwing on property access.
const env: Record<string, string | undefined> =
  (import.meta.env as Record<string, string | undefined> | undefined) ?? {}

// This app's own origin, used later for CHAPI wallet registration and the
// anti-phishing origin binding on the app-key credential. Derived from the
// page's actual origin so every deployment target works unconfigured; the env
// override and localhost fallback cover non-browser (Node test) contexts.
export const APP_ORIGIN =
  env.VITE_APP_ORIGIN ||
  (typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:5173')

// Replication tuning (optional). Undefined leaves the adapter defaults.
export const WAS_SYNC_BATCH_SIZE: number | undefined =
  env.VITE_WAS_SYNC_BATCH_SIZE
    ? Number(env.VITE_WAS_SYNC_BATCH_SIZE)
    : undefined
export const WAS_SYNC_RETRY_MS: number | undefined = env.VITE_WAS_SYNC_RETRY_MS
  ? Number(env.VITE_WAS_SYNC_RETRY_MS)
  : undefined

// The pull side is poll-based (no server-side live stream yet), so an open
// session only sees another device's changes when it re-pulls. Besides the
// `online`-reconnect reSync, a low-frequency periodic reSync keeps open sessions
// converging live. Defaults to 15s; override (e.g. faster in e2e) via env.
export const WAS_SYNC_POLL_MS: number = env.VITE_WAS_SYNC_POLL_MS
  ? Number(env.VITE_WAS_SYNC_POLL_MS)
  : 15000

/**
 * The eight storage collections, each a logical `key` (camelCase, used as the
 * localStore / RxDB collection handle) mapped to its WAS collection `id` (the
 * deliberately unprefixed, generic name shared across interoperable apps). All
 * are EDV-encrypted client-side. `current-focus` is a singleton.
 */
export const LA_COLLECTIONS = [
  { key: 'actionItems', id: 'action-items' },
  { key: 'projects', id: 'projects' },
  { key: 'goals', id: 'goals' },
  { key: 'questions', id: 'questions' },
  { key: 'answers', id: 'answers' },
  { key: 'webLinks', id: 'web-links' },
  { key: 'thoughts', id: 'thoughts' },
  { key: 'currentFocus', id: 'current-focus' }
] as const

/** A localStore/RxDB collection handle (camelCase logical key). */
export type CollectionKey = (typeof LA_COLLECTIONS)[number]['key']

/** A WAS collection id (the deliberately unprefixed, cross-app name). */
export type WasCollectionId = (typeof LA_COLLECTIONS)[number]['id']

/**
 * The one `WasAppConfig` handed to `@interop/was-react` (the session provider
 * and the auth store both read from here).
 *
 * PINNED values -- part of this app's stored-data contract, never change them:
 * `credential` names the seed VC type the wallet holds, and `dbName` names the
 * local RxDB database. Changing either orphans existing identities and data.
 */
export const WAS_APP_CONFIG: WasAppConfig = {
  appName: 'Life Advisor',
  appOrigin: APP_ORIGIN,
  // The app is gated behind Login With Wallet. Only affects the router's
  // rendering, never the store's transitions.
  onboarding: 'login-gated',
  collections: [...LA_COLLECTIONS],
  credential: {
    credentialType: 'LifeAdvisorKey',
    vocabBase: 'urn:life-advisor:vocab#'
  },
  dbName: 'life-advisor',
  sync: {
    ...(WAS_SYNC_BATCH_SIZE !== undefined && {
      batchSize: WAS_SYNC_BATCH_SIZE
    }),
    ...(WAS_SYNC_RETRY_MS !== undefined && { retryMs: WAS_SYNC_RETRY_MS }),
    pollMs: WAS_SYNC_POLL_MS
  }
}
