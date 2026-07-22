/**
 * Boots a was-teaching-server for the e2e tiers from the `was-teaching-server`
 * npm package (a devDependency of this app) -- no server checkout needed.
 * Composes `createApp` with an explicit `FileSystemBackend` so server state
 * lands in DATA_DIR (git-ignored, wiped on every boot for a deterministic
 * starting state) instead of inside the installed package.
 *
 * Env (all required):
 *   PORT         port to listen on
 *   SERVER_URL   public base URL; MUST match the URL clients sign zcap
 *                invocations against
 *   DATA_DIR     server state directory (resolved against cwd; wiped on boot)
 */
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp, FileSystemBackend } from 'was-teaching-server'

const port = Number(process.env.PORT)
const serverUrl = process.env.SERVER_URL
const dataDirEnv = process.env.DATA_DIR
if (!port || !serverUrl || !dataDirEnv) {
  throw new Error('startWasServer: PORT, SERVER_URL and DATA_DIR are required')
}

const dataDir = resolve(dataDirEnv)
rmSync(dataDir, { recursive: true, force: true })

const app = createApp({
  serverUrl,
  backend: new FileSystemBackend({ dataDir, capacityBytes: Infinity })
})
await app.listen({ port, host: '0.0.0.0' })
