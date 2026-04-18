import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { initSentry, Sentry } from './sentry';
import App from './App';
import './index.css';

// Init Sentry BEFORE the first React render so we capture mount-time
// errors. No-op when VITE_SENTRY_DSN is unset (dev default).
initSentry();

// In production Vite is built with `base: '/platform/'`, which exposes
// `import.meta.env.BASE_URL` as `/platform/`. React Router's BrowserRouter
// expects a basename WITHOUT the trailing slash, so we strip it. In dev
// the SPA runs at `/` on the Vite dev server and BASE_URL is just `/`,
// which becomes an empty basename — the correct behavior.
const rawBase = import.meta.env.BASE_URL || '/';
const routerBasename = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');

const AppWithBoundary = Sentry.withErrorBoundary(App, {
  fallback: (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
      <p style={{ marginTop: 8, color: '#666' }}>
        The page failed to load. Please refresh; if this keeps happening, contact support.
      </p>
    </div>
  ),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <AppWithBoundary />
    </BrowserRouter>
  </React.StrictMode>
);
