import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { StoreProvider } from '@shared/contexts/StoreContext';
import { CartProvider } from '@shared/contexts/CartContext';
import { ThemeProvider } from '@shared/theme/ThemeProvider';
import { ToastProvider } from '@shared/components/primitives/Toast';
import { CompareProvider } from '@shared/components/commerce/ProductCompare';
import { ConfirmProvider } from '@shared/components/primitives/ConfirmDialog';
import manifest from './theme.manifest';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
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
    </BrowserRouter>
  </React.StrictMode>
);
