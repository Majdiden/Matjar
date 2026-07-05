import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { storefrontApi } from '../api/client';

export interface StoreInfo {
  name: string;
  description?: string;
  logo?: string;
  favicon?: string;
  currency: string;
  theme?: any;
  themeCustomization?: {
    settings?: {
      colors?: Record<string, string>;
      typography?: Record<string, string>;
      layout?: Record<string, string>;
    };
    sections?: any[];
    customCSS?: string;
  };
  socialLinks?: Record<string, string>;
  contactInfo?: Record<string, string>;
  /** Store contact / company info (settings.contact). */
  contact?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  /** Merchant-authored store policies keyed by slug (privacy/returns/delivery/
   *  cod). Only policies with a body are present. Body is server-sanitised HTML. */
  policies?: Record<string, { title?: string | null; body: string }> | null;
  giftCards?: {
    enabled: boolean;
  };
}

interface StoreContextType {
  store: StoreInfo | null;
  loading: boolean;
  currency: string;
  formatPrice: (amount: number) => string;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await storefrontApi.getStoreInfo();
      setStore(res.data?.store || null);
    } catch {
      // keep stale store on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh after dashboard publishes a new theme version. The editor
  // posts `theme-published` to its preview iframe; merchant browser tabs
  // listen for the same event so the live storefront picks up new sections
  // without a hard reload.
  useEffect(() => {
    const dashboardOrigin =
      (import.meta as any).env?.VITE_DASHBOARD_ORIGIN || window.location.origin;
    const allowedOrigins = new Set([window.location.origin, dashboardOrigin]);

    // In preview mode the storefront is embedded in the dashboard editor's
    // iframe, which sits on a different origin (e.g. localhost:5173 in dev,
    // admin-domain in prod). Rather than hard-coding every possible
    // dashboard origin, we detect `?preview=<token>` on this page and fall
    // back to trusting `window.parent` as the message source. The iframe is
    // already serving draft content under that token's authority, so the
    // same origin is authorized to drive refreshes. Outside preview mode
    // the strict allowlist still applies.
    const isPreview = new URLSearchParams(window.location.search).has('preview');

    const onMessage = (e: MessageEvent) => {
      const data = e?.data;
      if (!data || typeof data !== 'object' || data.type !== 'theme-published') return;
      // Only accept `theme-published` refresh pings from the dashboard
      // origin (same-origin or the configured dashboard origin). Without
      // this check, any cross-origin page could force the storefront to
      // re-fetch store-info repeatedly — annoying rather than dangerous,
      // but easy to close.
      if (e.source !== window.parent && e.source !== window) {
        console.warn('[storefront] rejected theme-published: wrong source');
        return;
      }
      if (!isPreview && !allowedOrigins.has(e.origin)) {
        console.warn('[storefront] rejected theme-published: origin not allowed', e.origin);
        return;
      }
      console.log('[storefront] theme-published accepted, refreshing store-info');
      refresh();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refresh]);

  const currency = store?.currency || 'SDG';

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // Note: CSS variable injection for colors/typography is handled by ThemeProvider
  // to avoid duplication and ensure manifest defaults are merged properly.

  // Inject custom CSS from theme customization
  useEffect(() => {
    const css = store?.themeCustomization?.customCSS;
    if (!css) return;
    const id = 'tenant-custom-css';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = css;
    return () => { style?.remove(); };
  }, [store?.themeCustomization?.customCSS]);

  return (
    <StoreContext.Provider value={{ store, loading, currency, formatPrice, refresh }}>
      {children}
    </StoreContext.Provider>
  );
};
