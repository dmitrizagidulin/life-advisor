/**
 * Serves the freewallet dev server for the wallet-login tier from a local
 * checkout (installing its dependencies on first use if needed).
 *
 * Env:
 *   WALLET_PORT           port for the vite dev server (required)
 *   VITE_WAS_SERVER_URL   forwarded to the wallet build (set by the config)
 *   FREEWALLET_DIR        path to a local freewallet checkout (required)
 */
import { existsSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { join, resolve } from 'node:path'

const port = process.env.WALLET_PORT
if (!port) {
  throw new Error('startWallet: WALLET_PORT is required')
}

if (!process.env.FREEWALLET_DIR) {
  throw new Error(
    'startWallet: the wallet tier needs a local freewallet checkout; ' +
      'set FREEWALLET_DIR to its path'
  )
}
const walletDir = resolve(process.env.FREEWALLET_DIR)
if (!existsSync(join(walletDir, 'package.json'))) {
  throw new Error(
    `startWallet: FREEWALLET_DIR (${walletDir}) is not a freewallet checkout`
  )
}

const viteBin = join(walletDir, 'node_modules', '.bin', 'vite')
if (!existsSync(viteBin)) {
  console.log('Installing freewallet dependencies ...')
  try {
    execFileSync('pnpm', ['install', '--ignore-workspace'], {
      cwd: walletDir,
      stdio: 'inherit'
    })
  } catch (err) {
    // pnpm can exit non-zero over ignored dependency build scripts (none of
    // which the dev-served wallet needs); only fail if vite did not land.
    if (!existsSync(viteBin)) {
      throw err
    }
    console.log('pnpm install reported a non-fatal error; continuing.')
  }
}

// Spawn vite from the checkout's own bin dir so resolution can never escape
// upward into the enclosing workspace.
const child = spawn(
  viteBin,
  ['--cors', '--host', '--port', port, '--strictPort'],
  { cwd: walletDir, stdio: 'inherit' }
)
child.on('exit', code => process.exit(code ?? 1))
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => child.kill(signal))
}
