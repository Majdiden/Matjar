import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { StoreProvider } from '../contexts/StoreContext';
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
                      <App />
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
