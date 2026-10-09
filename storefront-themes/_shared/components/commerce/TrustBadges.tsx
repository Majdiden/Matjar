import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../contexts/StoreContext';
import { fetchPaymentMethods } from '../../hooks/usePaymentBadges';
import { pickBrandText } from '../../hooks/useContactInfo';
import type { PaymentMethodPublic } from '../../api/client';

/**
 * Arabic names of the manual-transfer providers seeded by the platform
 * (mirrors TRANSFER_PROVIDER_NAMES in services/generatedPages.js). Other
 * providers, and every provider in English, use the store's own label.
 */
export const PROVIDER_NAMES_AR: Record<string, string> = {
  bankak: 'بنكك',
  fawry: 'فوري',
  ocash: 'أوكاش',
  bravo: 'برافو',
  cashi: 'كاشي',
};

type BadgeIcon = 'cash' | 'transfer' | 'truck' | 'clock' | 'return';

const ICON_PATHS: Record<BadgeIcon, string> = {
  cash: 'M2.25 18.75a60 60 0 0115.8 2.1c.73.2 1.45-.34 1.45-1.1V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.38c0-.62.5-1.12 1.13-1.12H20.25M2.25 6v9m18-10.5v.75c0 .41.34.75.75.75h.75m-1.5-1.5h.38c.62 0 1.12.5 1.12 1.13v9.75c0 .62-.5 1.12-1.12 1.12h-.38m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.38a1.13 1.13 0 01-1.12-1.12V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z',
  transfer: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  truck: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.38a1.13 1.13 0 01-1.13-1.12V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.13c.62 0 1.13-.5 1.1-1.12a17.9 17.9 0 00-3.21-9.42 2.06 2.06 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.18v-.96c0-.57-.42-1.05-.98-1.12a48.6 48.6 0 00-10.04 0 1.13 1.13 0 00-.98 1.12v7.64m12 0V7.57m0 6.68H2.25',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  return: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3',
};

const Icon: React.FC<{ name: BadgeIcon }> = ({ name }) => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[name]} />
  </svg>
);

interface Badge {
  key: string;
  icon: BadgeIcon;
  text: string;
}

interface TrustBadgesProps {
  className?: string;
}

/**
 * Trust badges for product pages (PBI 10-11): "Cash on delivery", "Bankak
 * transfer", "Delivery to: …", "Returns within N days". Built from the
 * merchant's policy answers (`store.trust`) and the store's live payment
 * methods. Renders nothing — and fetches nothing — for a store that never
 * answered the policy questions, so those stores look exactly as before.
 */
export const TrustBadges: React.FC<TrustBadgesProps> = ({ className = '' }) => {
  const { store } = useStore();
  const { t, i18n } = useTranslation('generated');
  const trust = store?.trust;
  const [methods, setMethods] = useState<PaymentMethodPublic[] | null>(null);

  useEffect(() => {
    if (!trust?.payments) return;
    let cancelled = false;
    fetchPaymentMethods()
      .then((list) => { if (!cancelled) setMethods(list); })
      .catch(() => { if (!cancelled) setMethods([]); });
    return () => { cancelled = true; };
  }, [trust?.payments]);

  if (!trust) return null;

  const lang = i18n.language || 'ar';
  const isArabic = !lang.startsWith('en');
  const badges: Badge[] = [];

  for (const m of methods || []) {
    if (m.type === 'cod') badges.push({ key: 'cod', icon: 'cash', text: t('trust.cod') });
    if (m.type !== 'manual') continue;
    for (const p of m.providers || []) {
      const name = (isArabic && PROVIDER_NAMES_AR[p.code]) || p.label || p.code;
      badges.push({ key: `transfer-${p.code}`, icon: 'transfer', text: t('trust.transfer', { name }) });
    }
  }

  const areas = trust.delivery?.zones?.length
    ? trust.delivery.zones.join(isArabic ? '، ' : ', ')
    : pickBrandText(trust.delivery?.areas, lang);
  if (areas) badges.push({ key: 'delivery', icon: 'truck', text: t('trust.delivery_to', { areas }) });
  const time = pickBrandText(trust.delivery?.time, lang);
  if (time) badges.push({ key: 'time', icon: 'clock', text: t('trust.delivery_time', { time }) });
  if (trust.returns?.days) {
    badges.push({ key: 'returns', icon: 'return', text: t('trust.returns', { count: trust.returns.days }) });
  }

  if (!badges.length) return null;

  return (
    <div className={className} aria-label={t('trust.heading')} role="group">
      <ul className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <li
            key={b.key}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--color-border, #e5e7eb)', color: 'var(--color-text, inherit)' }}
          >
            <Icon name={b.icon} />
            <span>{b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TrustBadges;
