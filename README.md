# life-advisor

> A personal-productivity app (action items, projects, goals, questions,
> thoughts, web links, focus modes, history) built as a client-side React SPA
> on Wallet Attached Storage.

## Table of Contents

- [Background](#background)
- [Security](#security)
- [Install](#install)
- [Usage](#usage)
- [Testing](#testing)
- [Deploying](#deploying)
- [Contribute](#contribute)
- [License](#license)

## Background

`life-advisor` is built in the "Bring Your Own Everything" model: the user
brings their own identity (a wallet) and their own storage (a Wallet Attached
Storage (WAS) space), and the app stores everything encrypted in that user-owned
space.

Key properties:

- **Client-side SPA, no app server.** All application logic runs in the
  browser. Storage and identity are external, user-owned services.
- **Relying party, not a wallet.** The app authenticates via "Login With
  Wallet" (CHAPI) and stores data using wallet-delegated authorization
  capabilities (zCaps). It never holds the wallet's root key.
- **Encrypted at rest, client-side.** Every collection is encrypted as an
  Encrypted Data Vault (EDV); the server only ever sees opaque JWE envelopes.
- **Local-first.** RxDB (IndexedDB) holds the encrypted envelopes locally and
  replicates them to WAS. On unlock, documents decrypt into in-memory stores;
  all queries are in-memory selectors.
- **Multi-app interop is a design goal.** Collections use generic, unprefixed
  names, and access is granted per collection -- a read-only capability plus an
  entry in that collection's key-epoch roster -- so other apps can eventually be
  admitted to individual collections.

The full design -- identity and key derivation, the login flows, the sync and
conflict-resolution model, the id/timestamp planes, and the domain rules
-- lives in [ARCHITECTURE.md](ARCHITECTURE.md). Read it before making
structural changes.

## Security

- The app's identity and its vault key derive from a single 32-byte app root
  seed, stored in the user's wallet as a self-issued app-key credential
  (marker type `AppKeyCredential`, scoped by its `appUrl`) and recovered at
  login. The vault key is the app's one X25519
  key-agreement key, the twin of its `did:key` controller, and every collection
  is encrypted to it: an entry in a key-epoch roster is always the twin of a
  controller DID, whether the app is reading its own collections or one the
  wallet shared with it.
- Giving another party access to a collection never moves a key. The wallet
  grants a read-only capability on the collection together with an entry in that
  collection's key-epoch roster, and the recipient key is derived from the
  grantee's `did:key` controller, so both sides compute it and nothing travels on
  the wire. Removing access stops future reads but cannot take back what was
  already read.
- The wallet is the trust anchor; CHAPI origin binding plus an `origin` field
  baked into the seed credential guard against phishing.
- While the app is unlocked, the seed and session live in IndexedDB, so
  cross-site scripting is the primary threat model.

See the "Relying-party verification contract" and "Trust model" sections of
[ARCHITECTURE.md](ARCHITECTURE.md) for details.

## Install

Requires Node.js 24+ and [pnpm](https://pnpm.io/).

```
git clone https://github.com/dmitrizagidulin/life-advisor.git
cd life-advisor
pnpm install
```

## Usage

Start the dev server (Vite, http://localhost:5173):

```
pnpm dev
```

The app is gated behind "Login With Wallet" (CHAPI): it needs a reachable
wallet (e.g. a local [freewallet](https://github.com/interop-alliance/freewallet)
dev server) whose storage lives on a running WAS server (e.g. a local
[`was-teaching-server`](https://github.com/interop-alliance/was-teaching-server)).

### Other scripts

```
pnpm build        # typecheck + production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm fix          # eslint --fix + prettier
```

## Testing

```
pnpm test                  # lint + unit tests (Vitest)
pnpm test:coverage         # unit tests with coverage
pnpm test:browser          # Playwright driving the full wallet login flow
```

Unit tests cover the pure domain layer (`src/domain/`) and the encryption and
conflict-resolution paths. The browser suite boots a local WAS server and a
freewallet dev server (from a sibling checkout named by `FREEWALLET_DIR`) and
drives the real Login With Wallet flow end to end.

## Deploying

The app deploys as static assets to
[Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).
Configuration lives in `wrangler.jsonc`: it serves the `dist/` build output and
uses single-page-application fallback, so deep links into client-side routes
serve `index.html`.

One-time setup: link the Wrangler CLI (installed as a devDependency) to a
Cloudflare account:

```
pnpm exec wrangler login
```

(For non-interactive deploys, e.g. from CI, set `CLOUDFLARE_API_TOKEN` to a
token created from the "Edit Cloudflare Workers" template instead.)

Then to deploy (typecheck + build + upload):

```
pnpm run deploy
```

Note: it must be `pnpm run deploy`; bare `pnpm deploy` invokes pnpm's built-in
workspace command, not this script.

The first deploy prints the `*.workers.dev` URL. Remember that the app's origin
must be allowed by the WAS server's CORS configuration, and that CHAPI wallet
registration is per-origin.

## Contribute

PRs accepted. See [CONTRIBUTING.md](CONTRIBUTING.md) for editor setup
(Prettier, ESLint, and EditorConfig) and how it maps to CI.

If editing the Readme, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme)
specification.

## License

[MIT License](LICENSE.md) © 2026 Dmitri Zagidulin.
