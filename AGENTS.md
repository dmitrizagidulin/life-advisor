# life-advisor

A personal-productivity app (action items, projects, goals, questions, thoughts,
web links, focus modes, history) built as a client-side React SPA in the "Bring
Your Own Everything" model. Rewrite of the old Rails/Riak `life_advisor` app.

The full architecture lives in `ARCHITECTURE.md` -- read it before making
structural changes.

## Architecture (summary)

- **Relying party, not a wallet.** The app authenticates via "Login With Wallet"
  (CHAPI) against freewallet and stores data in the USER's Wallet Attached
  Storage (WAS) space using wallet-delegated zcaps. It never holds the wallet
  root key and never provisions the space.
- **App identity + vault keys** come from a 32-byte master seed stored in the
  wallet as a self-issued `LifeAdvisorKey` credential (minted wallet-side on
  first run and returned via the one-popup App Connect login). The master
  derives the stable `did:key` controller (
  CapabilityAgent.fromSeed on the raw bytes -- never fromSecret, which
  salt-hashes a string); each collection's X25519 EDV key-agreement key derives
  via HKDF (`info = 'kak:v1:<collectionId>'`, fed to fromSeed as raw bytes).
  Per-collection keys are the sharing unit for future multi-app interop -- never
  encrypt two collections with the same KAK.
- **All collections are EDV-encrypted client-side.** The server only ever sees
  JWE envelopes. Eight WAS collections: `action-items`, `projects`, `goals`,
  `questions`, `answers`, `web-links`, `thoughts`, `current-focus`. Names are
  deliberately unprefixed/generic: the WAS ecosystem goal is app
  interoperability (other TODO-type apps working on the same collections).
  Multi-app access to these encrypted collections is on the roadmap -- treat the
  document schemas as a shared contract (extend additively, never repurpose
  fields) and keep the seed credential generalizable (see the plan's Risks item
  8).
- **Local-first**: RxDB (IndexedDB) holds envelopes at rest and replicates to
  WAS via the changes feed. On unlock, decrypted docs hydrate into zustand
  stores; ALL queries are in-memory selectors (WAS has no server-side search).
- **Plumbing lives in `@interop/was-react`** (the library extracted from this
  app): identity/seed derivation, CHAPI login, the encrypted LocalStore, sync,
  the session store, hooks, and the MUI components (`ProtectedRoute`, sync
  status, the logout / clear-data / adoption dialogs). The app owns
  `WAS_APP_CONFIG` (`src/app.config.ts`), the collection-to-store registry
  (`src/stores/collectionRegistry.ts`), the per-entity stores, and the UI. The `credential` type and `dbName` fields
  of `WAS_APP_CONFIG` are data contracts -- once the app is deployed, changing
  them orphans existing users' identities and stored data.
- **Two id planes**: logical entity id = uuidv7 INSIDE the encrypted payload;
  WAS resource id = opaque random EDV id (human-readable ids on resource URLs
  would leak plaintext).
- **Two timestamp planes**: the envelope row's `updatedAt` is the sync
  checkpoint; the payload's `createdAt`/`updatedAt` (inside ciphertext) drive
  all domain sorting and LWW. Never mix them.
- **Updates are in-place**: re-encrypt under the same envelope id with
  `sequence`+1 and `If-Match`; deletes are tombstones; conflicts resolve LWW by
  payload `updatedAt` (clientId tiebreak).

## Reference codebases (read-only; consume `@interop/*` from the npm registry)

- [`@interop/was-react`](https://github.com/interop-alliance/was-react) -- the
  plumbing library this app depends on (see above).
- [freewallet](https://github.com/interop-alliance/freewallet) -- the wallet;
  wallet side of Login With Wallet.
- [`@interop/wallet-core`](https://github.com/interop-alliance/wallet-core) --
  proven mutable-doc sync pattern (extracted from freewallet-mobile).
- [was-teaching-server](https://github.com/interop-alliance/was-teaching-server)
  -- local WAS server for dev/e2e (`SERVER_URL`/`PORT` env, `pnpm dev`;
  SERVER_URL must exactly match the client's serverUrl).
- [wallet-attached-storage-spec](https://github.com/w3c-ccg/wallet-attached-storage-spec)
  -- the WAS spec.
- [wallet-to-webapp-demo](https://github.com/interop-alliance/wallet-to-webapp-demo)
  -- RP-side VPR construction reference.

## Domain rules (ported from Rails; do not "improve")

- Enum orders are load-bearing for sorting: MYWN categories
  `critical, tomorrow, opportunity, horizon, someday`; areas
  `work, soul, admin, assistant`; project statuses
  `idea, active, someday, canceled, completed`.
- Action-item sort: bumpCount DESC, then area order, then createdAt DESC.
  Projects/goals: bumpCount DESC, then name ASC. Questions: bumpCount DESC, then
  createdAt ASC.
- Area filter quirk: querying area `admin` also matches `assistant`.
- Parent pointers: `parentType` in {project, day, question, action_item, goal} +
  `parentKey`. "Days" are virtual: `parentType:'day'`, `parentKey:'YYYY-MM-DD'`
  (local time); unparented thoughts/web-links default to today.
- Project status machine: `completed` sets completedAt and clears canceledAt;
  `canceled` the reverse; any other status clears both.
- Current focus is a singleton doc with fixed logical id `_current_focus`;
  default focus is today's day.

## Conventions

- pnpm; Node 24+. TypeScript strict; Vite; Vitest (`test/node/`) + Playwright (
  `test/browser-wallet/`, driving the real Login With Wallet flow).
- Domain logic in `src/domain/` must stay pure (no React, no storage imports)
  and unit-tested.
- Do not commit or bump the package version; CHANGELOG.md entries use `TBD` as
  the date.
- Avoid the arrow character and mdashes in code; use `to` and `--`.
