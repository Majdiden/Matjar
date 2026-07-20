import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { paymentMethodsApi, PaymentMethodPublic } from '../../api/client';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';
import PaymentLogo from './PaymentLogo';

export const SLOT_KEY = 'guaranteedCheckout';

interface Props {
  className?: string;
  heading?: string;
}

// Module-level cache — keeps us from refetching the method list on every
// PDP mount. 60-second TTL is short enough that admin toggles propagate
// quickly, long enough that hovering between products is free.
const CACHE_TTL_MS = 60_000;
let cachedPromise: Promise<PaymentMethodPublic[]> | null = null;
let cachedAt = 0;

function fetchMethods(): Promise<PaymentMethodPublic[]> {
  const now = Date.now();
  if (cachedPromise && now - cachedAt < CACHE_TTL_MS) return cachedPromise;
  cachedAt = now;
  cachedPromise = paymentMethodsApi.list().then((res: any) => {
    return (res?.data?.methods || res?.responseObject?.methods || res?.methods || []) as PaymentMethodPublic[];
  }).catch((err) => {
    cachedPromise = null; // allow retry
    throw err;
  });
  return cachedPromise;
}

const GuaranteedCheckout: React.FC<Props> = (props) => {
  const Override = useThemeSlot<React.ComponentType<Props>>(SLOT_KEY);
  if (Override) return <Override {...props} />;

  const { t } = useTranslation('product');
  const { className = '', heading } = props;
  const resolvedHeading = heading ?? t('payment.guaranteed.title');
  const [badges, setBadges] = useState<{ code: string; src?: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMethods()
      .then((methods) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const out: { code: string; src?: string }[] = [];
        const push = (code: string, src?: string) => {
          const k = (src || code).toLowerCase();
          if (!k || seen.has(k)) return;
          seen.add(k);
          out.push({ code, src });
        };

        const isUrl = (s?: string) => !!s && /^(https?:|\/)/.test(s);
        for (const m of methods) {
          const providers = (m as any).providers as
            | { code?: string; logo?: string }[]
            | undefined;
          let contributed = false;
          if (providers && providers.length) {
            // Manual method — show ONLY the enabled providers the server
            // returned (each with its own uploaded image or stock logo). Do
            // NOT fall through to providerLogos: that's the STATIC list of ALL
            // providers (including disabled ones), so it would surface methods
            // the merchant turned off.
            for (const p of providers) {
              const logo = p.logo || '';
              if (isUrl(logo)) { push(p.code || logo, logo); contributed = true; }
              else if (logo) { push(logo); contributed = true; }
            }
          } else {
            // Non-manual (card/gateway) — the accepted brand logos on the
            // method itself (e.g. visa, mastercard).
            const logos = m.providerLogos && m.providerLogos.length > 0 ? m.providerLogos : [];
            for (const l of logos) {
              if (l) { push(l); contributed = true; }
            }
          }
          // Every available method should show at least ONE badge — its own.
          // Without this, a Cash-on-Delivery-only store (which has no provider
          // or brand logos) rendered nothing at all. Prefer the method's
          // uploaded icon, else its code (→ stock SVG: cod, bank, card, …).
          if (!contributed) {
            const icon = (m as any).icon as string | undefined;
            if (isUrl(icon)) push(m.code, icon);
            else push(m.code);
          }
        }
        setBadges(out);
      })
      .catch(() => {
        if (!cancelled) setBadges([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!badges || badges.length === 0) return null;

  return (
    <div
      className={`rounded-lg border p-4 ${className}`}
      style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
    >
      <p
        className="text-center text-[11px] font-bold uppercase tracking-wider mb-3"
        style={{ color: 'var(--color-muted, #6b7280)' }}
      >
        {resolvedHeading}
      </p>
      <div className="flex items-center justify-center gap-2.5 flex-wrap">
        {badges.map((b) => (
          <PaymentLogo key={b.src || b.code} code={b.code} src={b.src} size="lg" />
        ))}
      </div>
    </div>
  );
};

export default GuaranteedCheckout;
