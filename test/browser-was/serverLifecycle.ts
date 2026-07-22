/**
 * Shared lifecycle for the WAS-backed Playwright suite: boot a local
 * was-teaching-server, provision the dev Space + collections + grants against it,
 * and tear the server down afterwards. globalSetup and globalTeardown run in the
 * same Playwright runner process, so the child handle is stashed on `globalThis`.
 *
 * The server comes from the `was-teaching-server` npm package (a devDependency
 * of this app), booted via `test/lib/startWasServer.ts` with its state in the
 * git-ignored `.e2e/was-data` (wiped on every boot) -- no server checkout is
 * needed. SERVER_URL / PORT MUST match the URL the client builds from the
 * granted zcaps' invocationTargets.
 */
import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

export const WAS_PORT = Number(process.env.WAS_E2E_PORT ?? 3102)
export const WAS_SERVER_URL = `http://localhost:${WAS_PORT}`

const HANDLE_KEY = Symbol.for('life-advisor.was-e2e.server')

interface Stash {
  child?: ChildProcess
}

function stash(): Stash {
  const g = globalThis as unknown as Record<symbol, Stash>
  g[HANDLE_KEY] ??= {}
  return g[HANDLE_KEY]
}

/** Polls the server root until it answers, or throws after `timeoutMs`. */
async function waitForServer(timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${WAS_SERVER_URL}/`)
      if (response.ok || response.status === 404) {
        return
      }
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`was-teaching-server did not come up at ${WAS_SERVER_URL}`)
}

/** Boots the server and runs the provisioning script. Called by globalSetup. */
export async function startServerAndProvision(): Promise<void> {
  const child = spawn(
    'npx',
    ['tsx', join('test', 'lib', 'startWasServer.ts')],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        SERVER_URL: WAS_SERVER_URL,
        PORT: String(WAS_PORT),
        DATA_DIR: join('.e2e', 'was-data')
      },
      detached: true,
      stdio: 'ignore'
    }
  )
  child.unref()
  stash().child = child

  await waitForServer()

  await execFileAsync('npx', ['tsx', 'scripts/provision-dev-grants.ts'], {
    cwd: repoRoot,
    env: { ...process.env, SERVER_URL: WAS_SERVER_URL }
  })
}

/** Stops the server (its whole detached process group). Called by globalTeardown. */
export async function stopServer(): Promise<void> {
  const child = stash().child
  if (child?.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      /* already gone */
    }
  }
}
