/**
 * Dev grant provisioning (P2, CHAPI bypassed). Against a running
 * was-teaching-server, this:
 *
 *   1. derives a throwaway "provisioner" identity (stands in for the wallet that
 *      owns the Space) and the app's own controller DID from the shared DEV_SEED;
 *   2. creates a Space (owned by the provisioner) and the eight app collections,
 *      PLAINTEXT -- deliberately WITHOUT an encryption marker, mirroring what a
 *      wallet does when it provisions RP-requested collections;
 *   3. delegates a per-collection read/write zcap to the app's controller DID;
 *   4. writes the signed grants to a git-ignored JSON file the app loads in
 *      dev-sync mode (public/dev-grants.local.json by default);
 *   5. probes the open question: does the delegated, collection-scoped RW zcap
 *      authorize an RP-side PUT of the collection description carrying the
 *      { encryption: { scheme: 'edv' } } marker? The server's response is printed.
 *
 * Run (with the server already up on $SERVER_URL):
 *   SERVER_URL=http://localhost:3002 npx tsx scripts/provision-dev-grants.ts
 *
 * Reads (all optional):
 *   SERVER_URL       WAS base URL (default http://localhost:3002)
 *   DEV_GRANTS_OUT   output path (default <repo>/public/dev-grants.local.json)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WasClient, type ActionInput } from '@interop/was-client'
import type { IDelegatedZcap } from '@interop/data-integrity-core'
import { ZcapClient } from '@interop/ezcap'
import { Ed25519Signature2020 } from '@interop/ed25519-signature'
import { CapabilityAgent } from '@interop/webkms-client'
import { deriveIdentity, DEV_SEED } from '../src/app-identity/agents.ts'
import { LA_COLLECTIONS } from '../src/app.config.ts'

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

// Must match the actions the wallet mints for RP grants (see
// src/auth/loginRequest.ts RW_ACTIONS); the server accepts HEAD even though
// storage-core's ActionInput union omits it, hence the assertion.
const RW_ACTIONS = ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'] as ActionInput[]

/** Builds the provisioner's WAS client (owns / provisions the Space). */
async function provisionerClient(): Promise<{ was: WasClient; did: string }> {
  const agent = await CapabilityAgent.fromSeed({
    seed: PROVISIONER_SEED,
    handle: 'la-provisioner',
    keyName: 'provisioner-key'
  })
  const signer = agent.getSigner()
  const zcapClient = new ZcapClient({
    SuiteClass: Ed25519Signature2020,
    invocationSigner: signer,
    delegationSigner: signer
  })
  return { was: new WasClient({ serverUrl: SERVER_URL, zcapClient }), did: agent.id }
}

async function main(): Promise<void> {
  const { controllerDid: appDid, zcapClient: appZcapClient } =
    await deriveIdentity({ seed: DEV_SEED })
  const { was: provisioner, did: provisionerDid } = await provisionerClient()

  console.log(`Provisioning against ${SERVER_URL}`)
  console.log(`  provisioner DID: ${provisionerDid}`)
  console.log(`  app (RP) DID:    ${appDid}`)

  const space = await provisioner.createSpace({
    name: 'Life Advisor (dev)',
    controller: provisionerDid
  })
  console.log(`  space id:        ${space.id}`)

  // Each collection grant is delegated from the SPACE ROOT (not the collection
  // root) attenuating down to the collection URL. This is what the reference
  // server authorizes for a collection's sub-resources: a chain rooted at the
  // space root, whose invocationTarget (the collection URL) is a RESTful prefix
  // of every `/<collection>/<resource>` and `/<collection>/query` request. A
  // grant rooted at the collection's own root authorizes only the exact
  // collection-description URL, not its resources or the changes feed.
  const spaceUrl = `${SERVER_URL}/space/${space.id}`
  const spaceRoot = {
    '@context': 'https://w3id.org/zcap/v1',
    id: `urn:zcap:root:${encodeURIComponent(spaceUrl)}`,
    controller: provisionerDid,
    invocationTarget: spaceUrl
  } as unknown as Parameters<typeof provisioner.grant>[0]['capability']

  const grants: IDelegatedZcap[] = []
  for (const { id } of LA_COLLECTIONS) {
    // Plaintext collection (no encryption marker) -- mirrors wallet provisioning.
    await space.createCollection({ id, name: id })
    const zcap = await provisioner.grant({
      to: appDid,
      actions: RW_ACTIONS,
      target: `${spaceUrl}/${id}`,
      capability: spaceRoot
    })
    grants.push(zcap)
    console.log(`  collection "${id}": created + delegated RW to app`)
  }

  await mkdir(dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, JSON.stringify({ grants }, null, 2))
  console.log(`\nWrote ${grants.length} grants to ${OUT_PATH}`)

  // --- Encryption-marker probe ---------------------------------------------
  // Using the app's OWN delegated RW zcap (not the provisioner root key),
  // attempt to PUT the collection description with the edv marker. This is the
  // open question the plan wants answered in P2.
  const appWas = new WasClient({ serverUrl: SERVER_URL, zcapClient: appZcapClient })
  const probeCollectionId = LA_COLLECTIONS[0]!.id
  const probeCapability = grants[0]!
  console.log(`\nEncryption-marker probe on "${probeCollectionId}" (delegated RW zcap):`)
  try {
    const response = await appWas.request({
      capability: probeCapability,
      path: `/space/${space.id}/${probeCollectionId}`,
      method: 'PUT',
      json: { id: probeCollectionId, encryption: { scheme: 'edv' } }
    })
    console.log(`  AUTHORIZED -- server responded ${response.status}`)
  } catch (err) {
    const status =
      (err as { status?: number }).status ??
      (err as { response?: { status?: number } }).response?.status
    const data = (err as { data?: unknown }).data
    console.log(`  NOT AUTHORIZED -- status ${status ?? 'n/a'}`)
    if (data !== undefined) {
      console.log(`  server body: ${JSON.stringify(data)}`)
    }
  }
}

main().catch((err) => {
  console.error('Provisioning failed:', err)
  process.exit(1)
})
