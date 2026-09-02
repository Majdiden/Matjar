import React from 'react';
import { usePaymentBadges } from '../../hooks/usePaymentBadges';
import PaymentLogo from './PaymentLogo';

interface Props {
  className?: string;
  /** Badge height token/px — footers usually want a compact row. */
  size?: 'sm' | 'md' | 'lg' | number;
}

/**
 * Footer payment badges driven by the store's ACTUAL enabled payment
 * methods (COD, Bankak, Fawry, cards, …) — never a hardcoded VISA/MC row.
 * Renders nothing while loading or when the store exposes no methods, so
 * a footer never shows badges the merchant doesn't accept.
 */
export const FooterPaymentBadges: React.FC<Props> = ({ className = '', size = 'sm' }) => {
  const badges = usePaymentBadges();
  if (!badges || badges.length === 0) return null;
  return (
    <div className={`flex items-center flex-wrap gap-2 ${className}`}>
      {badges.map((b) => (
        <PaymentLogo key={b.src || b.code} code={b.code} src={b.src} size={size} />
      ))}
    </div>
  );
};

export default FooterPaymentBadges;
