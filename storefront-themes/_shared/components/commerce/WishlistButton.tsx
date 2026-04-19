import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { wishlistApi } from '../../api/client';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'wishlistButton';

interface WishlistButtonProps {
  productId: string;
  isWishlisted?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'button';
  onToggle?: (wishlisted: boolean) => void;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function WishlistButton(props: WishlistButtonProps) {
  const Override = useThemeSlot<React.ComponentType<WishlistButtonProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    productId,
    isWishlisted: initialWishlisted = false,
    className,
    size = 'md',
    variant = 'icon',
    onToggle,
  } = props;
  const { t } = useTranslation('product');
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      await wishlistApi.toggle(productId);
      const next = !wishlisted;
      setWishlisted(next);
      onToggle?.(next);
    } catch (err) {
      console.error('Wishlist toggle failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'button') {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition',
          wishlisted
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-gray-200 hover:border-gray-300 text-gray-700',
          className
        )}
      >
        <svg className={sizeClasses[size]} viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {wishlisted ? t('wishlist.remove') : t('wishlist.add')}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        'p-2 rounded-full transition-all',
        wishlisted
          ? 'text-red-500 hover:text-red-600'
          : 'text-gray-400 hover:text-red-500',
        loading && 'animate-pulse',
        className
      )}
      aria-label={wishlisted ? t('wishlist.aria_remove') : t('wishlist.aria_add')}
    >
      <svg className={sizeClasses[size]} viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  );
}
