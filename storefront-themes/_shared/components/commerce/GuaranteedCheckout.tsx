import React from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';
import { usePaymentBadges } from '../../hooks/usePaymentBadges';
import PaymentLogo from './PaymentLogo';

export const SLOT_KEY = 'guaranteedCheckout';

interface Props {
  className?: string;
  heading?: string;
}

const GuaranteedCheckout: React.FC<Props> = (props) => {
  const Override = useThemeSlot<React.ComponentType<Props>>(SLOT_KEY);
  if (Override) return <Override {...props} />;

  const { t } = useTranslation('product');
  const { className = '', heading } = props;
  const resolvedHeading = heading ?? t('payment.guaranteed.title');
  const badges = usePaymentBadges();

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
