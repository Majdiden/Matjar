import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { StoreProvider, useStore } from '../contexts/StoreContext';
import { CartProvider } from '../contexts/CartContext';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../components/primitives/Toast';
import { CompareProvider } from '../components/commerce/ProductCompare';
import { ConfirmProvider } from '../components/primitives/ConfirmDialog';
import '../i18n';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { registerThemeResources } from '../i18n';

import type { ThemeAppComponent } from './createThemeApp';

/**
 * Boot gate — the storefront's theme settings (colors, fonts, layout, section
 * config) all live on `store.themeCustomization`, so until the store fetch
 * resolves the ThemeProvider falls back to the manifest DEFAULTS. Rendering the
 * app during that window flashes default/demo chrome for a beat before the real
 * store data swaps in. We hold the app behind a neutral splash until the store
 * has loaded (StoreProvider flips `loading` to false even on failure, so this
 * never hangs), then fade the real, correctly-themed storefront in once.
 */
const GATE_CSS = `
@keyframes mbn-boot-spin { to { transform: rotate(360deg); } }
@keyframes mbn-boot-in { from { opacity: 0; } to { opacity: 1; } }
.mtg-splash { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center;
  background: var(--color-background, #ffffff); }
.mtg-spinner { width: 34px; height: 34px; border-radius: 9999px;
  border: 3px solid color-mix(in srgb, var(--color-foreground, #111) 15%, transparent);
  border-top-color: var(--color-primary, #2563eb); animation: mbn-boot-spin 720ms linear infinite; }
.mtg-app { animation: mbn-boot-in 320ms ease both; }
@media (prefers-reduced-motion: reduce) {
  .mtg-spinner { animation-duration: 0s; } .mtg-app { animation: none; }
}
`;

const BootGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useStore();
  if (loading) {
    return (
      <div className="mtg-splash" role="status" aria-live="polite" aria-busy="true">
        <style>{GATE_CSS}</style>
        <span className="mtg-spinner" />
      </div>
    );
  }
  return (
    <div className="mtg-app">
      <style>{GATE_CSS}</style>
      {children}
    </div>
  );
};

/**
 * Shared theme bootstrap — the entire `main.tsx` of a theme.
 *
 * Registers the theme's i18n bundles, then mounts the app inside the
 * canonical provider stack (identical in every pre-SDK main.tsx):
 * BrowserRouter > LanguageProvider > StoreProvider > ThemeProvider >
 * CartProvider > ToastProvider > CompareProvider > ConfirmProvider.
 */
export function mountTheme(App: ThemeAppComponent): void {
  if (App.locales) registerThemeResources(App.locales);

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <LanguageProvider>
          <StoreProvider>
            <ThemeProvider manifest={App.manifest}>
              <CartProvider>
                <ToastProvider>
                  <CompareProvider>
                    <ConfirmProvider>
                      <BootGate>
                        <App />
                      </BootGate>
                    </ConfirmProvider>
                  </CompareProvider>
                </ToastProvider>
              </CartProvider>
            </ThemeProvider>
          </StoreProvider>
        </LanguageProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

export default mountTheme;
