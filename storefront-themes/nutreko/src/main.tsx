import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { StoreProvider } from '@matjar/theme-shared/contexts/StoreContext';
import { CartProvider } from '@matjar/theme-shared/contexts/CartContext';
import { ThemeProvider } from '@matjar/theme-shared/theme/ThemeProvider';
import { ToastProvider } from '@matjar/theme-shared/components/primitives/Toast';
import { CompareProvider } from '@matjar/theme-shared/components/commerce/ProductCompare';
import { ConfirmProvider } from '@matjar/theme-shared/components/primitives/ConfirmDialog';
import manifest from './theme.manifest';
import '@matjar/theme-shared/i18n'
import { LanguageProvider } from '@matjar/theme-shared/i18n/LanguageProvider'
import { registerThemeResources } from '@matjar/theme-shared/i18n'
import { themeResources } from './i18n/theme'

import App from './App';
import './index.css';

registerThemeResources(themeResources)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
      <StoreProvider>
        <ThemeProvider manifest={manifest}>
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
  </React.StrictMode>
);
