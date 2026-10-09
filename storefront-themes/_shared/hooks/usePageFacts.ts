import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../contexts/StoreContext';
import { fetchPaymentMethods } from './usePaymentBadges';
import { pickBrandText } from './useContactInfo';
import { PROVIDER_NAMES_AR } from '../components/commerce/TrustBadges';
import type { PaymentMethodPublic } from '../api/client';
import type { BrandText } from '../types/commerce';
import type { PageIconName } from '../components/pages/PageIcon';

/**
 * Short facts for the generated pages' fact cards (PBI 10): "Serving you
 * since 2019", "Based in Khartoum", delivery areas and time, returns, how to
 * pay. Built only from what the merchant told us — the About answers and the
 * policy answers (`store.trust`) — and a fact is left out when its answer is.
 */
export type PageFactKey = 'since' | 'city' | 'delivery' | 'deliveryTime' | 'returns' | 'payment';

export interface PageFact {
  key: PageFactKey;
  icon: PageIconName;
  label: string;
  value: string;
}

export interface PageFactsInput {
  /** Which facts, in display order. */
  keys: readonly PageFactKey[];
  /** From the generated About page (`page.generated`). */
  since?: number | null;
  city?: BrandText | null;
}

/** A number for the pages: Western digits (0-9) in every language, without grouping. */
export function formatPageNumber(n: number, lang: string): string {
  try {
    return new Intl.NumberFormat(lang.startsWith('en') ? 'en-u-nu-latn' : 'ar-u-nu-latn', { useGrouping: false }).format(n);
  } catch {
    return String(n);
  }
}

export function usePageFacts({ keys, since, city }: PageFactsInput): PageFact[] {
  const { store } = useStore();
  const { t, i18n } = useTranslation('generated');
  const lang = i18n.language || 'ar';
  const isArabic = !lang.startsWith('en');
  const trust = store?.trust;
  const wantsPayment = keys.includes('payment') && !!trust?.payments;
  const [methods, setMethods] = useState<PaymentMethodPublic[]>([]);

  useEffect(() => {
    if (!wantsPayment) return;
    let cancelled = false;
    fetchPaymentMethods()
      .then((list) => { if (!cancelled) setMethods(list); })
      .catch(() => { if (!cancelled) setMethods([]); });
    return () => { cancelled = true; };
  }, [wantsPayment]);

  const sep = isArabic ? '، ' : ', ';
  const facts: PageFact[] = [];
  for (const key of keys) {
    if (key === 'since' && since) {
      facts.push({ key, icon: 'calendar', label: t('pages.facts.since'), value: formatPageNumber(since, lang) });
    } else if (key === 'city') {
      const value = pickBrandText(city, lang) || pickBrandText(store?.brand?.city, lang);
      if (value) facts.push({ key, icon: 'pin', label: t('pages.facts.city'), value });
    } else if (key === 'delivery') {
      const value = trust?.delivery?.zones?.length
        ? trust.delivery.zones.join(sep)
        : pickBrandText(trust?.delivery?.areas, lang);
      if (value) facts.push({ key, icon: 'truck', label: t('pages.facts.delivery'), value });
    } else if (key === 'deliveryTime') {
      const value = pickBrandText(trust?.delivery?.time, lang);
      if (value) facts.push({ key, icon: 'clock', label: t('pages.facts.delivery_time'), value });
    } else if (key === 'returns' && trust?.returns?.days) {
      const days = trust.returns.days;
      facts.push({
        key,
        icon: 'returns',
        label: t('pages.facts.returns'),
        value: t('pages.facts.returns_value', { count: days, days: formatPageNumber(days, lang) }),
      });
    } else if (key === 'payment' && wantsPayment) {
      const names: string[] = [];
      let cod = false;
      for (const m of methods) {
        if (m.type === 'cod') cod = true;
        if (m.type !== 'manual') continue;
        for (const p of m.providers || []) names.push((isArabic && PROVIDER_NAMES_AR[p.code]) || p.label || p.code);
      }
      const parts = [...(cod ? [t('pages.facts.cod')] : []), ...names.map((name) => t('trust.transfer', { name }))];
      if (parts.length) {
        facts.push({ key, icon: cod ? 'cash' : 'card', label: t('pages.facts.payment'), value: parts.join(sep) });
      }
    }
  }
  return facts;
}
