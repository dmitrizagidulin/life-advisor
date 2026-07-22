/**
 * Entry point: mounts the app inside `WasSessionProvider`, which builds the
 * session/auth store once from the app config and collection registry. The
 * provider sits ABOVE the router so every route (including /login) can reach
 * the session hooks.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WasSessionProvider } from '@interop/was-react'
import { WAS_APP_CONFIG } from '@/app.config'
import { COLLECTION_REGISTRY } from '@/stores/collectionRegistry'
import { App } from '@/App'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root not found.')
}
createRoot(container).render(
  <StrictMode>
    <WasSessionProvider config={WAS_APP_CONFIG} registry={COLLECTION_REGISTRY}>
      <App />
    </WasSessionProvider>
  </StrictMode>
)
