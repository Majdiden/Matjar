import { useEffect, useState } from 'react';
import { paymentMethodsApi, PaymentMethodPublic } from '../api/client';

/**
 * Resolves the store's ACTUAL enabled payment methods into a de-duplicated
 * list of badges (brand code + optional uploaded-logo URL), suitable for
 * rendering with <PaymentLogo>. Used by both the product-page guaranteed-
 * checkout strip and the footer payment badges so every surface reflects
 * what the merchant really accepts — never a hardcoded VISA/MC/AMEX row.
 */
export interface PaymentBadge {
  code: string;
  src?: string;
}

// Module-level cache — one fetch shared by every consumer (footer + PDP).
// 60s TTL keeps admin toggles propagating quickly without refetching on
// each mount.
const CACHE_TTL_MS = 60_000;
let cachedPromise: Promise<PaymentMethodPublic[]> | null = null;
let cachedAt = 0;

export function fetchPaymentMethods(): Promise<PaymentMethodPublic[]> {
  const now = Date.now();
  if (cachedPromise && now - cachedAt < CACHE_TTL_MS) return cachedPromise;
  cachedAt = now;
  cachedPromise = paymentMethodsApi
    .list()
    .then((res: any) => {
      return (res?.data?.methods ||
        res?.responseObject?.methods ||
        res?.methods ||
        []) as PaymentMethodPublic[];
    })
    .catch((err) => {
      cachedPromise = null; // allow retry
      throw err;
    });
  return cachedPromise;
}

const isUrl = (s?: string) => !!s && /^(https?:|\/)/.test(s);

/** Turn the enabled-methods list into a de-duplicated badge list. */
export function resolveBadges(methods: PaymentMethodPublic[]): PaymentBadge[] {
  const seen = new Set<string>();
  const out: PaymentBadge[] = [];
  const push = (code: string, src?: string) => {
    const k = (src || code).toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push({ code, src });
  };

  for (const m of methods) {
    const providers = (m as any).providers as
      | { code?: string; logo?: string }[]
      | undefined;
    let contributed = false;
    if (providers && providers.length) {
      // Manual method — show ONLY the enabled providers the server returned.
      for (const p of providers) {
        const logo = p.logo || '';
        if (isUrl(logo)) {
          push(p.code || logo, logo);
          contributed = true;
        } else if (logo) {
          push(logo);
          contributed = true;
        }
      }
    } else {
      // Non-manual (card/gateway) — the accepted brand logos on the method.
      const logos = m.providerLogos && m.providerLogos.length > 0 ? m.providerLogos : [];
      for (const l of logos) {
        if (l) {
          push(l);
          contributed = true;
        }
      }
    }
    // Every available method shows at least its own badge (e.g. COD-only).
    if (!contributed) {
      const icon = (m as any).icon as string | undefined;
      if (isUrl(icon)) push(m.code, icon);
      else push(m.code);
    }
  }
  return out;
}

/**
 * Hook: returns the store's payment badges. `null` while loading; `[]` when
 * the store exposes no methods (callers should render nothing).
 */
export function usePaymentBadges(): PaymentBadge[] | null {
  const [badges, setBadges] = useState<PaymentBadge[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPaymentMethods()
      .then((methods) => {
        if (!cancelled) setBadges(resolveBadges(methods));
      })
      .catch(() => {
        if (!cancelled) setBadges([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return badges;
}
