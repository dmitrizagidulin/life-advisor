# life-advisor Changelog

## 0.1.0 - TBD

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
  the payload timestamp, with a per-install device id as the tiebreak.
- Per-collection encryption keys derived from a single 32-byte master seed: a
  stable did:key controller identity plus one X25519 key-agreement key per
  collection via HKDF, so a single collection's key can later be shared with
  another interoperable app without exposing the master or sibling collections.
- Login With Wallet (CHAPI). The app authenticates against the wallet, self-issues
  and stores its app-key credential (holding the master seed) for cross-device
  recovery, and requests wallet-delegated capabilities scoped to each storage
  collection. First login, returning login on a new device, and zero-popup hot
  restore of a persisted session are all supported, along with an offline
  development mode that runs without a wallet.
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
