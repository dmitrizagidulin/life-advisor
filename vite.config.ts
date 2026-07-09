/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

/** The scheme://host[:port] origin of a URL, or null if unparseable/empty. */
function originOf(url: string | undefined): string | null {
  if (!url) {
    return null
  }
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * Injects a Content-Security-Policy meta tag into index.html. The seed and vault
 * keys live in IndexedDB, so XSS is the main threat; a tight default-src plus
 * script-src 'self' shrinks the attack surface. `connect-src` allows the app's
 * own origin plus the configured WAS server (its EDV/changes-feed requests), and
 * `frame-src` allows the CHAPI mediator (authn.io uses an iframe/popup).
 *
 * Dev mode loosens two things Vite's HMR needs: `'unsafe-inline'` scripts (the
 * React-refresh preamble is injected inline) and `ws:` + localhost origins on
 * `connect-src` (the HMR socket and the local was-teaching-server on any port).
 * The production build keeps script-src 'self' -- no inline scripts, since the
 * module-preload polyfill (which would inject one) is disabled below.
 */
function cspPlugin(): Plugin {
  return {
    name: 'life-advisor-csp',
    transformIndexHtml(html, ctx) {
      const isDev = ctx.server !== undefined
      const wasOrigin = originOf(process.env.VITE_WAS_SERVER_URL)
      const connect = ["'self'", ...(wasOrigin ? [wasOrigin] : [])]
      if (isDev) {
        connect.push('ws:', 'http://localhost:*', 'https://localhost:*')
      }
      const scriptSrc = isDev ? "'self' 'unsafe-inline'" : "'self'"
      const directives = [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        "style-src 'self' 'unsafe-inline'",
        `connect-src ${connect.join(' ')}`,
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        'frame-src https://authn.io',
        "object-src 'none'",
        "base-uri 'self'"
      ]
      const content = directives.join('; ')
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${content}" />\n  </head>`
      )
    }
  }
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  // No inline module-preload polyfill: modern (Chromium) targets support
  // <link rel="modulepreload"> natively, so the production HTML carries no
  // inline script and script-src 'self' holds.
  build: {
    modulePreload: { polyfill: false }
  },
  resolve: {
    alias: {
      '@': srcDir
    }
  },
  test: {
    include: ['test/node/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts']
    }
  }
})
