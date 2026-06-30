import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import { initSentry, Sentry } from './sentry'
import App from './App.tsx'
import { LanguageProvider } from './i18n/LanguageProvider'
import { hydrateAuthFromUrlHash } from './lib/authHandoff'

// Cross-host auth handoff (#auth= / #impersonation=) MUST be consumed before
// React Router mounts — the router strips the fragment during its initial
// redirect, so a useEffect-based read loses the token and bounces to /login.
hydrateAuthFromUrlHash()

// Sentry must be initialized before the first React render so errors
// thrown during mount are captured. No-op when VITE_SENTRY_DSN is unset.
initSentry()

// Wrap the top-level App with Sentry's error boundary. The fallback
// intentionally stays minimal so a mid-render crash never cascades into
// a completely blank page. The boundary also captures the error before
// React unmounts the tree, so we still get a Sentry event for any
// uncaught render error.
const AppWithBoundary = Sentry.withErrorBoundary(App, {
  fallback: (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
      <p style={{ marginTop: 8, color: '#666' }}>
        The page failed to load. Please refresh; if this keeps happening, contact support.
      </p>
    </div>
  ),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AppWithBoundary />
    </LanguageProvider>
  </StrictMode>,
)
