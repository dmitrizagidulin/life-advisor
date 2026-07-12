/**
 * Dev grant provisioning (CHAPI bypassed), a thin wrapper over
 * `provisionDevGrants` from `@interop/was-react/dev`. Against a running
 * was-teaching-server, it derives a throwaway "provisioner" identity (stands in
 * for the wallet that owns the Space) and the app's own controller DID from the
 * shared DEV_SEED, creates a Space and the eight app collections (PLAINTEXT --
 * mirroring wallet provisioning), delegates a per-collection read/write zcap to
 * the app's DID, writes the signed grants to a git-ignored JSON file the app
 * loads in dev-sync mode, and probes whether the delegated RW zcap authorizes
 * the RP-side `{ encryption: { scheme: 'edv' } }` collection-description PUT.
 *
 * Run (with the server already up on $SERVER_URL):
 *   SERVER_URL=http://localhost:3002 npx tsx scripts/provision-dev-grants.ts
 *
 * Reads (all optional):
 *   SERVER_URL       WAS base URL (default http://localhost:3002)
 *   DEV_GRANTS_OUT   output path (default <repo>/public/dev-grants.local.json)
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { provisionDevGrants } from '@interop/was-react/dev'
import { LA_COLLECTIONS } from '../src/app.config.ts'
import { DEV_SEED } from '../src/stores/devSeed.ts'

const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:3002'
const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = dirname(scriptDir)
const OUT_PATH =
  process.env.DEV_GRANTS_OUT ?? join(repoRoot, 'public', 'dev-grants.local.json')

// A fixed, distinct provisioner seed -- the "wallet" that owns the dev Space.
// Kept separate from DEV_SEED (the app / relying party) so the delegation is a
// genuine cross-identity grant, exactly as in the real wallet-to-RP flow.
const PROVISIONER_SEED = new Uint8Array([
  0x70, 0x72, 0x6f, 0x76, 0x69, 0x73, 0x69, 0x6f, 0x6e, 0x65, 0x72, 0x2d, 0x64,
  0x65, 0x76, 0x2d, 0x73, 0x65, 0x65, 0x64, 0x2d, 0x30, 0x31, 0x32, 0x33, 0x34,
  0x35, 0x36, 0x37, 0x38, 0x39, 0x41
])

async function main(): Promise<void> {
  console.log(`Provisioning against ${SERVER_URL}`)
  const result = await provisionDevGrants({
    serverUrl: SERVER_URL,
    seed: DEV_SEED,
    collections: LA_COLLECTIONS.map(({ id }) => id),
    spaceName: 'Life Advisor (dev)',
    outFile: OUT_PATH,
    provisionerSeed: PROVISIONER_SEED,
    probe: true,
    log: (msg) => console.log(msg)
  })
  console.log(`\nWrote ${result.grants.length} grants to ${OUT_PATH}`)
}

main().catch((err) => {
  console.error('Provisioning failed:', err)
  process.exit(1)
})
