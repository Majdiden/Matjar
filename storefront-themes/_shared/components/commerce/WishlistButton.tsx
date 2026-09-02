import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useWishlist } from '../../hooks/useWishlist';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'wishlistButton';

interface WishlistButtonProps {
  productId: string;
  /**
   * Optional light product object. Stored for GUESTS so the /wishlist page can
   * render the item (name, image, price) without a second fetch. Pass it from
   * anywhere the full product is already in hand (e.g. ProductCard).
   */
  product?: any;
  /** Kept for backwards-compat; the hook is now the source of truth. */
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

function toSnapshot(product: any, productId: string) {
  if (!product) return undefined;
  return {
    _id: productId,
    name: product.name,
    slug: product.slug,
    price: product.price,
    images: product.images,
    image: product.images?.[0] || product.image,
  };
}

export function WishlistButton(props: WishlistButtonProps) {
  const Override = useThemeSlot<React.ComponentType<WishlistButtonProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    productId,
    product,
    className,
    size = 'md',
    variant = 'icon',
    onToggle,
  } = props;
  const { t } = useTranslation('product');
  const { includes, toggle } = useWishlist();
  const [loading, setLoading] = useState(false);

  // Membership is derived from the shared store, so the heart reflects the
  // real state on mount and updates when toggled from anywhere else.
  const wishlisted = includes(productId) || !!props.isWishlisted;

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const next = await toggle(productId, toSnapshot(product, productId));
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
        type="button"
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
      type="button"
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
      aria-pressed={wishlisted}
    >
      <svg className={sizeClasses[size]} viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  );
}
