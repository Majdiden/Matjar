import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlist } from '../../hooks/useWishlist';

interface WishlistHeaderLinkProps {
  /** Classes for the tap target (size, colour, hover); keep at least 40px square on phones. */
  className?: string;
  /** Classes for the heart icon (default 22px, current colour). */
  iconClassName?: string;
  /** Classes for the count badge; it uses the store colour unless overridden. */
  badgeClassName?: string;
  /** Pass the theme's own heart icon to match its icon set. */
  icon?: React.ReactNode;
}

/**
 * Header heart that opens /wishlist, with the number of saved products
 * (PBI 10-39). Every theme shows it in its phone header so shoppers find
 * what they saved without opening the account menu. Themes style it to
 * match their header; the badge hides at zero.
 */
export const WishlistHeaderLink: React.FC<WishlistHeaderLinkProps> = ({
  className = 'relative inline-flex h-10 w-10 items-center justify-center',
  iconClassName = 'h-[22px] w-[22px]',
  badgeClassName = '',
  icon,
}) => {
  const { t } = useTranslation('common');
  const { count } = useWishlist();
  const label = t('aria.wishlist', { defaultValue: 'Wishlist' });
  return (
    <Link to="/wishlist" className={className} aria-label={count ? `${label} (${count})` : label}>
      {icon ?? (
        <svg className={iconClassName} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      )}
      {count > 0 && (
        <span
          className={
            badgeClassName ||
            'absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none'
          }
          style={badgeClassName ? undefined : { background: 'var(--brand, var(--color-primary, #111))', color: 'var(--brand-contrast, #fff)' }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
};

export default WishlistHeaderLink;
