# life-advisor Changelog

## Unreleased - TBD

### Changed

- Upgrade `@interop/was-react` to `^0.8.2` (from `^0.3.5`), tracking the
  wallet-side identity-model refactors. The two releases that matter here:
  `0.5.0` encrypts every private collection to the app's identity
  key-agreement key (any rows written under the previous per-collection keys
  will not decrypt), and `0.8.0` moves the BYOE wire vocabulary from
  `urn:was:` / `urn:freewallet:vocab#` to the shared `https://w3id.org/byoe#`
  namespace -- matching is literal string equality on both sides, so this bump
  is required to log in against a current Freewallet. In between, `0.6.0`
  added verified did:webvh resolution to the app document loader (a wallet may
  now present a did:webvh VP holder) and `0.7.0` renamed the library's
  collection-encryption "marker" surface to "encryption descriptor". No app
  code changes: this app uses only the high-level store/hooks surface, and its
  own `vocabBase` (`urn:life-advisor:vocab#`) is untouched by the vocab move.
- Upgrade the `was-teaching-server` dev dependency to `^0.16.1`, the server
  release matching the current wallet account model (did:webvh controller
  promotion, current-key-set authorization).
- Docs: correct the key-derivation prose in `ARCHITECTURE.md`, `AGENTS.md`, and
  `README.md`. It described two key identities derived from the app root seed --
  a per-collection X25519 key-agreement key (HKDF,
  `info = 'kak:v1:<collectionId>'`) for the collections this app provisions, plus
  the app's identity key-agreement key (the X25519 twin of its `did:key`
  controller) for a collection the wallet shares with it. There is now one rule:
  an entry in a key-epoch roster is always the X25519 twin of a controller
  `did:key`, so the identity key-agreement key encrypts every collection, derived
  once at init. Unification could only go this direction -- a share can be
  granted to an arbitrary `did:key` grantee where no app seed exists, so the
  recipient must be derivable from the controller DID alone. The docs state the
  cost plainly: the per-collection HKDF domain separation is gone and one key
  reads every collection this app touches.
- Docs: correct the multi-app interop and security prose in `ARCHITECTURE.md`,
  `AGENTS.md`, and `README.md`. It described a speculative plan in which sharing
  a collection meant minting a credential that carried that collection's derived
  seed. That is not the shipped mechanism and no key is ever transmitted: the
  wallet grants a read-only capability on the collection (a
  `urn:was:shared-collection` invocation-target descriptor) fused with an entry
  in the collection's key-epoch roster, where the recipient key is the X25519
  twin of the grantee's `did:key` controller and is derived independently on both
  sides. The docs now also state the ceiling the wallet's consent screen states:
  removing access stops future reads but cannot take back what was already read,
  and resources written before a collection's first share stay sealed to the
  owner alone and will not decrypt for the grantee. Related: the note that
  `origin` must widen into an allowlist for interop is dropped -- a second app
  connects under its own origin-bound app key and is admitted by a share grant to
  its own controller DID.

## 0.1.1 - 2026-07-23

### Added

- Add footer with app version.

## 0.1.0 - 2026-07-23

Initial implementation: a client-side React single-page app for personal
productivity (action items, projects, goals, questions and answers, thoughts,
web links, focus modes, and a history journal), rebuilt on the user's own
Wallet Attached Storage in the "bring your own everything" model. The app is a
relying party -- it never holds the wallet root key and never provisions the
storage space.

### Added

- Encrypted local-first storage. All data is EDV-encrypted client-side and held
  as opaque JWE envelopes in a local RxDB (IndexedDB) database; the server only
  ever sees ciphertext. Records use a stable resource id with in-place
  re-encryption (advancing an envelope sequence) for updates and tombstones for
  deletes. Concurrent edits from multiple devices converge by last-write-wins on
  the payload timestamp, with a per-install client id as the tiebreak.
- Per-collection encryption keys derived from a single 32-byte root seed: a
  stable did:key controller identity plus one X25519 key-agreement key per
  collection via HKDF, so a single collection's key can later be shared with
  another interoperable app without exposing the root seed or sibling collections.
- Login With Wallet (CHAPI). A single "App Connect" popup authenticates the
  user and returns the app-key credential (minted wallet-side on first run,
  holding the root seed for cross-device recovery) together with
  wallet-delegated capabilities scoped to each storage collection. First
  login, returning login on a new device, and zero-popup hot restore of a
  persisted session are all supported.
- WAS replication. The local database replicates encrypted envelopes to the
  user's storage space over the delegated capabilities, pulling remote changes
  through the changes feed and pushing with conditional writes. Incoming changes
  patch the in-memory view per document (including tombstone removals and the
  current-focus singleton) for live multi-device updates. A best-effort marker
  declares each collection encrypted on connect.
- Domain features ported faithfully from the previous app: MYWN action-item
  categories with inline toggle, bump, category move, and area planning; the
  project status machine and project-to-goal serving; goals with sub-goals;
  questions and answers; thoughts and web links with round-trip conversion to and
  from action items; a virtual "day" parent convention; a current-focus banner;
  and a 60-day history journal. All queries run in memory over the decrypted data.
- Session hardening. A sync-status indicator reflects live replication state; a
  reconnect banner appears when storage access nears expiry, has expired, or a
  live request is rejected, and re-runs the grants flow in place with one wallet
  prompt. An export action downloads every decrypted collection as a single JSON
  file. A Content-Security-Policy restricts script, connection, and frame origins
  to shrink the cross-site-scripting attack surface.

### Changed

- Replaced the app's own identity, auth, storage, sync, and session plumbing
  with `@interop/was-react` (the library extracted from this app). The app
  supplies a single `WasAppConfig` and a collection-to-store registry, wraps
  the app in `WasSessionProvider`, and consumes the library's hooks and MUI
  components (`ProtectedRoute`, `SyncStatusChip`, `ReconnectBanner`, and the
  logout, clear-data, and adoption dialogs).
- Local-first onboarding. In development mode the app opens directly over an
  anonymous local encrypted replica with no login gate; a later wallet login
  adopts that data into the connected replica (last-write-wins merge by
  logical id). Logout became an in-shell dialog offering to keep or wipe the
  local replica.
- One-popup login. The multi-step probe / store-key / request-grants CHAPI
  ceremony collapsed into a single App Connect exchange; the sync target now
  comes from the granted capabilities instead of a configured server URL, and
  the last-write-wins tiebreak field is `clientId`.
- The development harness connects through locally provisioned grants and the
  library's `connectWithGrants`; the end-to-end suites boot the WAS server
  from the `was-teaching-server` npm package instead of a sibling checkout.
