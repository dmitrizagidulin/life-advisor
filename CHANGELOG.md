# life-advisor Changelog

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
