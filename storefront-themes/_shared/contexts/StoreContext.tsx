import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { storefrontApi, setPriceFilterRate, setPricingHeaders } from '../api/client';
import i18n, { readShopperLang, saveShopperLang } from '../i18n';
import type { BrandKit, GeneratedPages, StoreTrust } from '../types/commerce';

export interface StoreInfo {
  name: string;
  /** The store's language (Settings → Regional): the storefront opens in it. */
  language?: 'ar' | 'en';
  description?: string;
  logo?: string;
  favicon?: string;
  /** The pricing currency: every amount from the API is in it. */
  currency: string;
  /**
   * Exchange rates from the pricing currency (Settings → Currencies):
   * `{ SDG: 600 }` = 1 unit of `currency` is 600 SDG. Present when the
   * website shows another currency or visitors may switch.
   */
  currencyRates?: Record<string, number>;
  /** What visitors see and pay in, when not the pricing currency. */
  displayCurrency?: string;
  /** Visitors may switch currency (language menu). */
  currencySwitcher?: boolean;
  /**
   * Regions (Settings → Markets): each with its currency and price
   * adjustment. When present, visitors pick a region instead of a currency.
   */
  markets?: StoreMarket[];
  /** The region detected for this visitor (by country), else the default one. */
  market?: string;
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
  policies?: Record<
    string,
    {
      title?: string | null;
      body: string;
      /** Generated policies: one copy per language while the text is untouched. */
      translations?: Record<string, { title?: string | null; body?: string | null }> | null;
    }
  > | null;
  giftCards?: {
    enabled: boolean;
  };
  /** Brand kit (PBI 10): only what the merchant set; null when nothing is. */
  brand?: BrandKit | null;
  /** Pages built from store data (PBI 10-10); absent unless switched on. */
  generatedPages?: GeneratedPages;
  /** Trust-badge facts (PBI 10-11); absent unless the policy questions were answered. */
  trust?: StoreTrust;
  /** Delivery areas (shipping zones) to pick from at checkout; absent unless the store delivers by zone. */
  deliveryZones?: Array<{ id: string; name: string; countries?: string[] }>;
  /** Countries checkout offers (ISO codes): where the store delivers. */
  shipCountries?: string[];
}

interface StoreContextType {
  store: StoreInfo | null;
  loading: boolean;
  /** The currency prices are shown in: the visitor's choice, else the website currency. */
  currency: string;
  /** The website currency: what visitors pay in (checkout, orders). */
  chargeCurrency: string;
  /** The pricing currency (what API amounts are in). */
  baseCurrency: string;
  /** Currencies the visitor can pick (one entry when switching is off). */
  currencies: string[];
  setCurrency: (code: string) => void;
  /** A pricing-currency amount, shown in the visitor's currency. */
  formatPrice: (amount: number) => string;
  /** A pricing-currency amount in the website currency (what is charged, e.g. checkout). */
  formatChargedPrice: (amount: number) => string;
  /**
   * An amount of a placed order, in the currency and at the rate the order
   * was placed with (falls back to the website currency).
   */
  formatOrderPrice: (amount: number, order?: OrderCurrency | null) => string;
  /** An order total as the customer paid it (their currency, region prices). */
  formatOrderAmount: (order: (OrderCurrency & Partial<Record<OrderAmountField, number>>) | null | undefined, field: OrderAmountField) => string;
  /** An order line's unit price × quantity as the customer paid it. */
  formatOrderLine: (item: { price: number; presentmentPrice?: number }, order: OrderCurrency | null | undefined, quantity?: number) => string;
  /** An amount typed in the visitor's currency (e.g. a price filter) → pricing currency. */
  toBaseAmount: (amount: number) => number;
  /** An amount already in `code` (e.g. a quote's presentment total). */
  formatMoney: (amount: number, code: string) => string;
  /** The store's regions (empty without markets). */
  markets: StoreMarket[];
  /** The visitor's region: chosen, else detected, else the default one. */
  market: StoreMarket | null;
  setMarket: (code: string) => void;
  refresh: () => Promise<void>;
}

/** A storefront region (market). */
export interface StoreMarket {
  code: string;
  name: string;
  currency: string;
  language?: string;
  /** 0.1 = prices 10% higher in this region. */
  priceAdjustmentPct?: number;
  isDefault?: boolean;
}

/** The currency fields a placed order carries. */
export interface OrderCurrency {
  baseCurrency?: string;
  presentmentCurrency?: string;
  fxRate?: number;
  /** What the customer paid, in presentmentCurrency. */
  presentmentSubtotal?: number;
  presentmentDiscount?: number;
  presentmentShipping?: number;
  presentmentTax?: number;
  presentmentTotal?: number;
  giftCardRedemption?: { amount?: number } | null;
}

/** An order amount: the pricing-currency field and its presentment mirror. */
export type OrderAmountField = 'subtotal' | 'discount' | 'shippingCost' | 'tax' | 'totalAmount';
const PRESENTMENT_FIELD: Record<OrderAmountField, keyof OrderCurrency> = {
  subtotal: 'presentmentSubtotal',
  discount: 'presentmentDiscount',
  shippingCost: 'presentmentShipping',
  tax: 'presentmentTax',
  totalAmount: 'presentmentTotal',
};

/** The shopper's currency / region choice, kept for the visit (like the language). */
const CURRENCY_KEY = 'matjar.storefront.currency';
const MARKET_KEY = 'matjar.storefront.market';
const readChoice = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const saveChoice = (key: string, value: string): boolean => {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    /* storage unavailable: the choice holds until reload */
    return false;
  }
};
/**
 * Product and cart prices come from the server already set for the region and
 * currency (own prices, rounding), so a new choice reloads the page to fetch
 * them again. Only when the choice was saved, or the reload would undo it.
 */
const reloadForPrices = (saved: boolean) => {
  if (saved && typeof window !== 'undefined') window.location.reload();
};

const money = (amount: number, code: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
  } catch {
    // An unknown code: the number and the code.
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)} ${code}`;
  }
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

/**
 * Read the store payload the server embedded in the SPA shell
 * (middlewares/storefrontServe.js). Every theme reads its colors, fonts,
 * layout and section config off `store.themeCustomization`; fetching that
 * over the network means the first paint happens against the theme's
 * manifest DEFAULTS and then swaps — the flash of the default theme on
 * refresh. Reading it here, synchronously during module evaluation, makes
 * the very first render the real store.
 *
 * Returns null on anything unexpected (tag absent, malformed JSON, an old
 * cached shell) so the component falls back to fetching, as before.
 */
const readEmbeddedStore = (): StoreInfo | null => {
  try {
    const el = document.getElementById('__MATJAR_STORE__');
    if (!el?.textContent) return null;
    const parsed = JSON.parse(el.textContent);
    return parsed && typeof parsed === 'object' && parsed.name ? (parsed as StoreInfo) : null;
  } catch {
    return null;
  }
};

const EMBEDDED_STORE = typeof document !== 'undefined' ? readEmbeddedStore() : null;

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

/**
 * The store's brand kit (tagline, cover photo, colour, WhatsApp, city, hours)
 * or null when the merchant has set none of it — or before the store loads.
 * Themes must treat null/missing keys as "use your own default" so stores
 * without a brand kit render unchanged.
 */
export const useBrand = (): BrandKit | null => useStore().store?.brand ?? null;

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<StoreInfo | null>(EMBEDDED_STORE);
  // Already hydrated from the shell => never gate the app on the network.
  // BootGate stays as the fallback for a shell without the payload.
  const [loading, setLoading] = useState(!EMBEDDED_STORE);

  const refresh = React.useCallback(async () => {
    try {
      const res = await storefrontApi.getStoreInfo();
      const next = res.data?.store || null;
      setStore(next);
      // Without the embedded payload the page opened in Arabic: switch to the
      // store's language once it is known, unless the shopper picked one.
      if (!EMBEDDED_STORE && next?.language && !readShopperLang() && !i18n.language?.startsWith(next.language)) {
        void i18n.changeLanguage(next.language);
      }
    } catch {
      // keep stale store on failure
    } finally {
      setLoading(false);
    }
  }, []);

  // Revalidate in the background even when the shell was embedded — the HTML
  // may have been served from a cache before the merchant's latest publish.
  // A no-op when nothing changed; a correction (not a flash) when it did.
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

  const baseCurrency = store?.currency || 'SDG';
  const rates = store?.currencyRates || {};
  const rateOf = (code: string) => (code === baseCurrency ? 1 : rates[code] > 0 ? rates[code] : null);
  const chargeCurrency = store?.displayCurrency && rateOf(store.displayCurrency) ? store.displayCurrency : baseCurrency;
  // The website currency first, then the pricing currency and the others.
  const currencies = store?.currencySwitcher
    ? Array.from(new Set([chargeCurrency, baseCurrency, ...Object.keys(rates)]))
    : [chargeCurrency];
  const [choice, setChoice] = useState<string | null>(() => readChoice(CURRENCY_KEY));
  const setCurrency = React.useCallback((code: string) => {
    if (code === readChoice(CURRENCY_KEY)) return;
    setChoice(code);
    reloadForPrices(saveChoice(CURRENCY_KEY, code));
  }, []);

  // Regions: the visitor's choice, else the region detected by the server,
  // else the default one. A region sets the currency and price adjustment
  // (and replaces the currency choice).
  const markets = store?.markets || [];
  const [marketChoice, setMarketChoice] = useState<string | null>(() => readChoice(MARKET_KEY));
  const market =
    markets.find((m) => m.code === marketChoice) ||
    markets.find((m) => m.code === store?.market) ||
    markets.find((m) => m.isDefault) ||
    null;
  const setMarket = React.useCallback(
    (code: string) => {
      if (code === market?.code) return;
      setMarketChoice(code);
      const saved = saveChoice(MARKET_KEY, code);
      const lang = markets.find((m) => m.code === code)?.language;
      if (lang === 'ar' || lang === 'en') {
        saveShopperLang(lang);
        void i18n.changeLanguage(lang);
      }
      reloadForPrices(saved);
    },
    [markets, market?.code],
  );

  // What prices are shown in: the region's currency, else the visitor's
  // currency choice, else the website currency. `factor` turns a pricing-
  // currency amount into it (region adjustment × exchange rate).
  const currency = market && rateOf(market.currency)
    ? market.currency
    : choice && currencies.includes(choice) ? choice : chargeCurrency;
  const factor = (rateOf(currency) ?? 1) * (market && currency === market.currency ? 1 + (market.priceAdjustmentPct || 0) : 1);

  const convert = (amount: number, code: string) => money(amount * (rateOf(code) ?? 1), rateOf(code) ? code : baseCurrency);
  const formatPrice = (amount: number) => money(amount * factor, currency);
  // What is charged: the region's prices when there is a region (checkout
  // confirms by the shipping address), else the website currency.
  const formatChargedPrice = (amount: number) => (market ? formatPrice(amount) : convert(amount, chargeCurrency));
  const formatOrderPrice = (amount: number, order?: OrderCurrency | null) =>
    order?.presentmentCurrency && order.fxRate && order.fxRate > 0
      ? money(amount * order.fxRate, order.presentmentCurrency)
      : order?.baseCurrency
        ? money(amount, order.baseCurrency)
        : formatChargedPrice(amount);
  const formatOrderAmount: StoreContextType['formatOrderAmount'] = (order, field) => {
    const shown = order?.[PRESENTMENT_FIELD[field]];
    // The presentment total is before a gift card; the charged total after it.
    const usable = typeof shown === 'number' && order?.presentmentCurrency && !(field === 'totalAmount' && order.giftCardRedemption?.amount);
    return usable ? money(shown as number, order!.presentmentCurrency!) : formatOrderPrice(Number(order?.[field]) || 0, order);
  };
  const formatOrderLine: StoreContextType['formatOrderLine'] = (item, order, quantity = 1) =>
    typeof item.presentmentPrice === 'number' && order?.presentmentCurrency
      ? money(item.presentmentPrice * quantity, order.presentmentCurrency)
      : formatOrderPrice(item.price * quantity, order);
  const toBaseAmount = (amount: number) => amount / factor;

  // The API client converts price filters typed in the visitor's currency.
  useEffect(() => {
    setPriceFilterRate(factor);
  });
  // The server prices products for this region and currency (own prices,
  // rounding). Set during render so pages' first requests carry it.
  setPricingHeaders(market?.code || null, market ? null : currency);

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
    <StoreContext.Provider
      value={{
        store,
        loading,
        currency,
        chargeCurrency,
        baseCurrency,
        currencies,
        setCurrency,
        formatPrice,
        formatChargedPrice,
        formatOrderPrice,
        formatOrderAmount,
        formatOrderLine,
        toBaseAmount,
        formatMoney: money,
        markets,
        market,
        setMarket,
        refresh,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};
