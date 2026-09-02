import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api-client';
import type { Address, Order } from '../../../types';

/**
 * Store header info used on printed documents. Sourced from the tenant's
 * settings (same record the Settings page writes to). We keep the shape
 * narrow — only fields the documents render — so a failure to resolve
 * one field doesn't blank the whole header.
 */
export interface StoreInfo {
  storeName: string;
  storeDescription?: string;
  logo?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
}

/** Raw settings bag as returned by `domains.getInfo()` — the endpoint
 * funnels several shapes into `data.settings`. We only read the keys
 * the header block needs, so keep it narrow + optional. */
interface StoreSettingsRaw {
  storeName?: string;
  storeDescription?: string;
  logo?: string;
  email?: string;
  contactEmail?: string;
  phone?: string;
  contactPhone?: string;
  address?: string;
  storeAddress?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  currency?: string;
  notifications?: { fromEmail?: string };
}

interface SettingsWrapper {
  data?: { settings?: StoreSettingsRaw };
  responseObject?: { data?: { settings?: StoreSettingsRaw } };
  settings?: StoreSettingsRaw;
}

const extractSettings = (res: unknown): StoreSettingsRaw => {
  const r = (res ?? {}) as SettingsWrapper;
  return (
    r?.data?.settings ||
    r?.responseObject?.data?.settings ||
    r?.settings ||
    {}
  );
};

/** The order-fetch response goes through several historical wrappers.
 * We probe each in order so old tenants' payloads still resolve. */
interface OrderResponseEnvelope {
  responseObject?: { order?: Order } | Order;
  data?: { order?: Order } | Order;
}

/**
 * Fetch the order + store header in one hook. Returns `{ loading, error,
 * order, store }`. `order` is loaded from `/api/orders/:id`; `store` from
 * the same admin endpoint the Settings page uses so we share one source
 * of truth for the merchant's legal info block.
 */
export function useOrderAndStore(orderId: string | undefined) {
  const { t } = useTranslation(['orders']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [store, setStore] = useState<StoreInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orderId) {
        setError(t('orders:document.shared.no_order_id'));
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const [orderRes, storeRes] = await Promise.all([
          api.orders.getById(orderId),
          api.domains.getInfo().catch(() => null),
        ]);
        if (cancelled) return;
        const r = orderRes as OrderResponseEnvelope | Order;
        const env = r as OrderResponseEnvelope;
        const fromResponseObject =
          (env?.responseObject as { order?: Order } | undefined)?.order ||
          (env?.responseObject as Order | undefined);
        const fromData =
          (env?.data as { order?: Order } | undefined)?.order ||
          (env?.data as Order | undefined);
        const o: Order | undefined =
          fromResponseObject || fromData || (r as Order);
        setOrder(o as Order);
        const s = extractSettings(storeRes);
        setStore({
          storeName: s.storeName || 'Store',
          storeDescription: s.storeDescription || '',
          logo: s.logo || '',
          email: s.email || s.contactEmail || s.notifications?.fromEmail || '',
          phone: s.phone || s.contactPhone || '',
          address:
            s.address ||
            s.storeAddress ||
            [s.addressLine1, s.addressLine2].filter(Boolean).join(', '),
          city: s.city,
          country: s.country,
          currency: s.currency,
        });
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : null;
        setError(msg || t('orders:document.shared.load_failed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return { loading, error, order, store };
}

/**
 * Fire `window.print()` once the page has painted so the browser can
 * lay out the document first. We defer with a short timeout because
 * some browsers will otherwise print before fonts / images finish
 * loading. The user can always re-trigger print from the browser UI.
 */
export function useAutoPrint(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        /* ignore — user can print manually */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [ready]);
}

/** Broader than the typed `Address` — accepts the shape the order may
 * ship with `company` / `street` fields that the canonical `Address`
 * doesn't declare. Still strictly typed so consumers get autocompletion. */
export type AddressLike =
  | (Partial<Address> & {
      company?: string;
      street?: string;
    })
  | null
  | undefined;

export function formatAddress(addr: AddressLike): string[] {
  if (!addr) return [];
  const lines: string[] = [];
  const name = [addr.firstName, addr.lastName].filter(Boolean).join(' ');
  if (name) lines.push(name);
  if (addr.company) lines.push(addr.company);
  if (addr.addressLine1) lines.push(addr.addressLine1);
  if (addr.addressLine2) lines.push(addr.addressLine2);
  const cityLine = [addr.city, addr.state, addr.postalCode]
    .filter(Boolean)
    .join(', ');
  if (cityLine) lines.push(cityLine);
  if (addr.country) lines.push(addr.country);
  if (addr.phone) lines.push(`Tel: ${addr.phone}`);
  return lines;
}
