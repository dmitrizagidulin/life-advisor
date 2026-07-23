# life-advisor Architecture

life-advisor is a personal-productivity app -- action items, projects, goals,
questions and answers, thoughts, web links, focus modes, and a history journal.
It is a client-side React single-page app built in the "Bring Your Own
Everything" model: the user brings their own identity (a wallet) and their own
storage (Wallet Attached Storage), and the app stores everything encrypted in
that user-owned space. The domain rules are deliberate and should not be
"improved."

This document is the orientation guide for new contributors. Read it before
making structural changes.

## Overall model

- **Client-side SPA, no app server.** All application logic runs in the browser.
  There is no backend that this app owns. Storage and identity are external,
  user-owned services.
- **Relying party, not a wallet.** The app authenticates via "Login With Wallet"
  (CHAPI) against a wallet and stores data in the user's Wallet Attached Storage
  (WAS) space using wallet-delegated authorization capabilities (zcaps). It never
  owns the space, never holds the wallet's root key, and invokes only the zcaps
  the wallet grants it.
- **Encryption at rest, client-side.** Every application collection is encrypted
  client-side as an Encrypted Data Vault (EDV). The WAS server only ever sees
  opaque JWE envelopes; it can neither read nor search the plaintext.
- **Local-first.** A local RxDB (IndexedDB) database holds the encrypted
  envelopes and replicates them to WAS. On unlock, documents are decrypted and
  hydrated into in-memory stores; the UI reads exclusively from those stores.

## Identity and keys

### App root seed and the LifeAdvisorKey credential

The app's identity and all of its vault keys derive from a single 32-byte
**app root seed**. That seed is not generated per device or held only locally; it
is stored in the user's wallet as a self-issued verifiable credential of type
`LifeAdvisorKey`. The credential's subject carries the seed (base64url-encoded)
plus an `origin` field used as an anti-phishing check at login. It is signed by
the seed-derived signer and is self-issued (issuer equals subject).

Because the seed lives in the wallet, recovering it on a new device (via a
QueryByExample request at login) recovers the app's full identity and every
collection key. Nothing about the seed is device-specific.

### Derivation

From the root seed:

- **Controller identity.** The root seed derives a stable `did:key` controller
  DID (via `CapabilityAgent.fromSeed` on the raw bytes) and its signer. This DID
  is the same on every device and is the identity that WAS zcaps are delegated
  to.
- **Per-collection vault keys.** Each collection's X25519 EDV key-agreement key
  (KAK) is derived separately with HKDF-SHA256 over the root seed, using
  `info = 'kak:v1:<collectionId>'`, then the standard Ed25519-to-X25519
  derivation. Collections are encrypted with per-collection KAKs from day one.

Per-collection keys are the unit of sharing. Because HKDF is one-way, handing
another app one collection's key exposes nothing about the root seed or the
sibling collections, and no re-encryption migration is needed to start sharing.
**Never encrypt two collections with the same KAK.**

A subtlety worth pinning: the pinned convention (owned by `@interop/was-react`'s
identity layer) is `CapabilityAgent.fromSeed({seed})` on the RAW 32 bytes, for
both the root identity and the per-collection KAKs -- never `fromSecret`,
which salt-hashes a STRING and would derive a different key for a byte array vs
its text form. This convention is part of the shared-key contract: a mismatch
silently derives different DIDs and KAKs for different consumers.

## Authentication: Login With Wallet (CHAPI)

The app is a CHAPI relying party. Login is the one-popup "App Connect"
ceremony: a single CHAPI `get` carries a Verifiable Presentation Request
combining DIDAuthentication with an `AppConnectQuery` (naming the
LifeAdvisorKey credential type and one capability query per collection), and
the wallet answers with the credential plus the delegated WAS zcaps in one
signed response. The entry paths:

### Login (first run and returning, one popup)

1. Load the CHAPI polyfill (authn.io mediator).
2. Send the App Connect VPR: DIDAuthentication plus the LifeAdvisorKey
   credential and one capability query per collection (allowing GET, HEAD,
   PUT, POST, DELETE against `{type:'urn:was:collection', name}`).
3. In the same round, the wallet matches an existing app key or -- on first
   run -- mints the 32-byte seed and self-issues the same-shaped credential
   (marking the response `firstRun`), provisions the collections, and returns
   the credential plus zcaps delegated to the seed-derived controller DID in
   one signed presentation. There is no separate store popup and no separate
   grants popup. A wallet that predates App Connect returns no app-key
   credential, which fails closed as `WalletUnsupportedError` -- distinct from
   a user cancel (a null CHAPI response).
4. Verify the response (see below); recover the seed and derive the controller
   DID (the per-collection KAKs are derived later, where consumed -- at
   local-store init); parse the server URL and space id from a grant's
   invocation target and assert all grants share one space. There is no
   configured WAS host -- the wallet decides where the space lives.
5. Build the WAS client, per-collection document ciphers, and RxDB; start
   sync. Any data created in the anonymous local session is adopted into
   the connected replica (last-write-wins merge by logical id).
6. Persist the session record and enter the app.

On a returning login (new device or cleared storage) the same popup returns
the existing credential: verify it is self-issued and that its `origin`
matches the current origin, extract the seed, and re-derive the same
controller DID with fresh grants. Because the DID and KAKs are stable,
previously stored data remains readable.

### Hot restore (seed persisted locally, zero popups)

The session record `{controllerDid, serverUrl, spaceId, grants, expires}` is
read from local IndexedDB, with the seed persisted under a separate key in the
same store (`expires` is the earliest expiry across the granted zcaps). If
present and unexpired, agents, the WAS client, and ciphers are rebuilt from the
stored zcaps with no wallet interaction. A restore miss or failure lands in the
anonymous `local` session state, and the router redirects to the login page --
never a dead login screen.

### Relying-party verification contract

On every login response the app verifies:

1. The presentation itself (VP DIDAuth proof plus embedded VC proofs).
2. Manually: proof purpose is `authentication`, proof domain equals the current
   origin, and the challenge matches the nonce that was sent (the domain check in
   particular must be done manually).
3. Holder binding: the wallet signs the VP as ITS OWN holder DID (the app's
   controller DID never leaves the app), so binding is enforced through the
   credential and the grants instead: the LifeAdvisorKey must be self-issued
   with issuer equal to subject equal to the seed-derived `did:key`, and each
   grant's controller must be that same DID.
4. Per zcap: controller is ours; invocation target is under the expected
   `<serverUrl>/space/<spaceId>/`; a single space across all grants; `expires`
   is in the future; allowed actions cover the need. (Delegation-chain proofs are
   enforced server-side at invocation; the app checks structure.)

Any failure aborts login and nothing is persisted.

### Expiry and re-grant

Grants are expiry-only (there is no revocation endpoint; the wallet default TTL
is on the order of 30 days). An expired restore record falls back to the
returning-login flow (same stable DID and KAKs, so data stays readable). A live
401/403 mid-session surfaces a "storage access expired -- reconnect wallet"
banner that relaunches the returning-login flow.

### Client authentication and phishing

CHAPI's origin model is the intended client-authentication mechanism; no
OAuth2-style pre-registered redirect URI is needed. The browser and mediator
attest the requesting page's origin to the wallet, and the response is delivered
only to that origin. The wallet enforces domain binding (it refuses to sign when
the VPR domain differs from the CHAPI origin) and shows the origin on its consent
screen. The residual risk is a user approving a lookalike site's request for the
LifeAdvisorKey; the mitigations are the `origin` field baked into the credential
(verified by the app at login) and the wallet's origin display. Strict
single-origin binding is in tension with multi-app interop (see below), so
`origin` is expected to evolve into a user-extendable allowlist rather than a
hard single value.

## Storage: WAS collections and EDV encryption

Data lives in eight collections in the user's WAS space. Collection ids follow
the wallet's naming rule (`^[a-z0-9][a-z0-9-]{0,63}$`) and are all EDV-encrypted:

| Collection id | Contents |
|---|---|
| `action-items` | action items |
| `projects` | projects (embed served goals as `goalIds[]`) |
| `goals` | goals (nested via a `goal` parent pointer) |
| `questions` | questions |
| `answers` | answers (parented to a question) |
| `web-links` | web links (default day parent) |
| `thoughts` | thoughts (default day parent) |
| `current-focus` | the current-focus singleton |

Collection names are deliberately unprefixed and generic. The WAS ecosystem goal
is app interoperability -- other TODO-type apps should eventually be able to work
on the same `action-items`, `projects`, and so on. See "Interop constraints"
below.

Some concepts from the old data model are folded in rather than stored as their
own collections: project-to-goal joins become the embedded `goalIds` array (the
goal-to-projects direction is an in-memory filter), and "day logs" are virtual
(no stored documents; a day is just a parent pointer).

### The at-rest row

Each stored row is a generic synced-document shape `{id, updatedAt, version,
metaVersion?, data?, custom?}`, where `data` is the EDV envelope
`{id, sequence, jwe}`.
Envelopes ship verbatim to and from WAS; encryption and decryption are purely
local. The server stores only ciphertext.

## Two id planes

Every entity has two distinct identifiers, and they must never be conflated:

- **Logical entity id** -- a `uuidv7`, stored INSIDE the encrypted payload as
  `id`. Everything domain-facing (routes, `parentKey`, `goalIds`) uses it.
- **Physical WAS resource id** -- the RxDB primary key and EDV resource id, an
  opaque random id minted at create time. Human-readable ids on resource URLs
  would leak plaintext, so the EDV codec rejects them by design.

There is no persisted mapping table between the two. An in-memory
uuid-to-envelope-id index is built during hydration (when everything is decrypted
anyway) and used to route in-place updates.

## Two timestamp planes

Also never conflate these:

- **Envelope `updatedAt`** -- on the synced-document row. This is the sync
  checkpoint used by replication only.
- **Payload `createdAt` / `updatedAt`** -- inside the ciphertext. These drive
  all domain sorting and last-writer-wins conflict resolution.

Keeping the two explicit in the types matters: mixing them silently breaks
sorting and conflict resolution.

## Sync and query architecture

### Write model (mutable heads)

- **Create.** Encrypt the payload, mint a random EDV envelope id, insert the row,
  replicate with `If-None-Match: *`.
- **Update.** Look up the envelope id via the hydration index, re-encrypt under
  the SAME envelope id with `sequence` incremented, replicate with `If-Match`.
  This is deliberate: the app mutates constantly (bumps, toggles, category
  moves), so content-addressed create-plus-tombstone would append a create and a
  permanent tombstone to the changes feed on every click. In-place re-encryption
  avoids that.
- **Delete.** Tombstone the row (a soft delete) so the deletion replicates.
- **Conflict.** A 412 maps to a sync-conflict error; the resolver re-reads the
  current head and applies last-writer-wins by payload `updatedAt` (ISO lexical
  compare), with a per-install random `clientId` as tiebreaker.

### Replication

There is one RxDB collection per entity. Each replicates against WAS with a
per-collection zcap: pull is driven by the WAS `changes` feed; push uses ETag /
`If-Match`. Coming back online triggers a re-sync.

### Hydration and reactivity

On unlock, every collection is decrypted into an in-memory store keyed by logical
uuid, and the uuid-to-envelope-id index is built. The app subscribes to each
RxDB change stream; pulled remote changes are re-decrypted and patched into the
stores, so edits made on another device appear live. All UI reads go through
selectors over these stores.

### In-memory queries

WAS has no server-side search, and the local rows are ciphertext (there are no
plaintext fields for IndexedDB to index), so every query is an in-memory selector
over decrypted data. The query layer is a stable seam: selector signatures are
fixed so that if WAS later ships blinded (encrypted, equality-only) index queries,
the backing implementation can change without the UI or domain tests noticing.
Sorting and non-equality logic would stay client-side regardless; index keys, if
adopted, would derive per-collection with the same HKDF scheme as vault keys so
that sharing a collection also carries query capability.

## Domain rules (deliberate; do not "improve")

Domain logic lives in `src/domain/` and is pure -- no React, no storage imports
-- and unit-tested. The rules below are deliberate and load-bearing.

### Enum orders (order matters for sorting)

```
MYWN categories: critical, tomorrow, opportunity, horizon, someday
areas:           work, soul, admin, assistant
project status:  idea, active, someday, canceled, completed
parent types:    project, day, question, actionItem, goal
```

### Sort orders

- Action items: `bumpCount` DESC, then area order, then `createdAt` DESC.
- Projects and goals: `bumpCount` DESC, then name ASC.
- Questions: `bumpCount` DESC, then `createdAt` ASC.
- Children of a parent: `createdAt` DESC.
- Day items: by a day-sort key (`done && completedAt ? completedAt :
  createdAt`).

### Area filter quirk

Querying area `admin` also matches `assistant`. This is intentional and must be
preserved (as an OR of two equality terms, or a client-side filter).

### Parent pointers and virtual days

Entities point at a parent with `parentType` (one of project, day, question,
actionItem, goal) plus `parentKey`. "Days" are virtual: `parentType:'day'` with
`parentKey:'YYYY-MM-DD'` in local time and no stored day document. Unparented
thoughts and web links default to today's day (including mapping a literal
`'today'` to today's date).

### Project status machine

Setting status `completed` sets `completedAt` and clears `canceledAt`; setting
`canceled` does the reverse; any other status clears both.

### Web-link / action-item conversions

Web links convert to action items and back (each conversion creates the new
entity, moves the associated link, and deletes the original).

### Current-focus singleton

Current focus is a single document with the fixed logical id `_current_focus`.
It points at an entity or a day. When unset, or when it points at today's day,
the effective focus defaults to today.

### History

The history journal covers today plus the previous 60 days (61 day buckets),
computing per day the items
created, completed, completed same-day, and created-but-not-completed, sorted by
the day-sort key -- all derived from the virtual-day convention, with no stored
history documents.

## Module layout

The identity, auth, storage, sync, and session plumbing lives in
`@interop/was-react` (the library extracted from this app); the app supplies a
`WasAppConfig` plus a collection-to-store registry and owns only the domain
layer and UI.

```
src/
  app.config.ts        app origin, onboarding mode, collection registry, and
                       the assembled WasAppConfig handed to @interop/was-react
  main.tsx / App.tsx   WasSessionProvider + HashRouter + lazy routes
  types/domain.ts      entity payload interfaces + enums
  stores/              the app-side storage glue: the collection-to-store
                       registry, per-entity zustand stores over the library's
                       createEntityStore, cross-store entity actions, export
  domain/              pure, unit-tested domain logic (sort, actionItems,
                       projects, goals, questions, webLinks, focus, history,
                       parent, queries, factories)
  lib/                 dates (local YYYY-MM-DD day keys, ISO helpers), data
                       export
  pages/ components/ themes/   UI
```

Key boundary: `src/domain/` must stay pure (no React, no storage). The local
store is a generic per-entity envelope store (encrypt on insert, re-encrypt in
place on update, tombstone on delete, decrypt-all on list). The remote store is
delegated-only: it parses the server URL and space id from the granted zcap
invocation targets rather than deriving them, and does no provisioning.

## Testing

- **Unit tests** with Vitest (under `test/node/` and colocated `*.test.ts`),
  covering the pure domain layer (comparators, category moves, the status
  machine, focus, history, conversions, day-parent defaulting) and the
  encrypt/round-trip and LWW paths.
- **End-to-end tests** with Playwright: the config boots a local WAS server
  and a freewallet dev server and drives the full Login With Wallet flow --
  login, sync, and returning-session behavior -- against the real wallet.

Tooling: pnpm, Node 24+, TypeScript strict, Vite. Consume `@interop/*` packages
from the npm registry.

## Interop constraints (preserve these)

Multi-app access to the encrypted collections is a design goal, not an
afterthought. Several decisions exist to keep it possible:

- **Unprefixed collection names.** The wallet maps a collection name onto the one
  shared space, so a second app requesting the same names gets zcaps to the same
  collections. What a second app lacks today is only the decryption key.
- **Per-collection keys are the sharing unit.** Because vault keys are already
  per-collection (HKDF from the root seed), sharing a collection means minting a
  credential carrying just that one derived collection seed (plus authorized
  origins) into the wallet; the second app requests that credential type and a
  zcap for the same collection. Consent granularity matches zcap granularity,
  HKDF one-wayness protects the root seed and siblings, and each app keeps its own
  controller DID and grants. Per-collection key rotation is a new HKDF version tag
  for that collection plus a re-encrypt of just that collection.
- **Document schemas are a shared contract.** Once another app reads these
  collections, the payload shapes are a de-facto shared schema. Extend them
  ADDITIVELY; never repurpose an existing field.
- **Origin binding must generalize.** The strict single-origin anti-phishing
  guard would block legitimate second apps, so `origin` should become a
  user-extendable allowlist and/or move to wallet consent-time matching.
- **Keep the seed credential generalizable.** Do not bake life-advisor-only
  assumptions into the credential vocabulary; keep it self-describing so
  collection-sharing needs no breaking changes.

### Encryption marker caveat

When the wallet provisions collections on the app's behalf, they may be created
without an `encryption` marker. Envelopes still store correctly (the server only
rejects plaintext written into a marked collection), but such a collection is not
self-describing and lacks server-side fail-closed protection. The app attempts to
PUT the encryption marker itself; a wallet-side enhancement to request the marker
at provisioning time is the fallback. This is non-blocking.

### Trust model

The vault seed sits in the wallet vault, encrypted at rest by the wallet's own
key; the wallet is the trust anchor and origin binding is the phishing guard. The
seed must not be cached anywhere else. Because the seed lives in IndexedDB while
the app is unlocked, cross-site scripting is the primary threat to defend against
(hence a tight content-security policy).
