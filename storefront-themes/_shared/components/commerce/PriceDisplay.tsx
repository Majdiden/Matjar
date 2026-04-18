import React from 'react';
import { cn } from '../../utils/cn';
import { useStore } from '../../contexts/StoreContext';
import { calculateDiscount } from '../../utils/formatCurrency';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'priceDisplay';

interface PriceDisplayProps {
  price: number;
  compareAtPrice?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showDiscount?: boolean;
  layout?: 'inline' | 'stacked';
}

const sizeClasses = {
  sm: { price: 'text-sm font-bold', compare: 'text-xs', badge: 'text-[10px] px-1 py-0.5' },
  md: { price: 'text-base font-bold', compare: 'text-sm', badge: 'text-xs px-1.5 py-0.5' },
  lg: { price: 'text-2xl font-bold', compare: 'text-base', badge: 'text-sm px-2 py-1' },
};

export function PriceDisplay(props: PriceDisplayProps) {
  const Override = useThemeSlot<React.ComponentType<PriceDisplayProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    price,
    compareAtPrice,
    className,
    size = 'md',
    showDiscount = true,
    layout = 'inline',
  } = props;
  const { formatPrice } = useStore();
  const discount = calculateDiscount(price, compareAtPrice);
  const styles = sizeClasses[size];

  return (
    <div className={cn(
      'flex items-baseline gap-2',
      layout === 'stacked' && 'flex-col gap-0.5',
      className
    )}>
      <span className={cn(styles.price, discount > 0 && 'text-red-600')}>
        {formatPrice(price)}
      </span>
      {discount > 0 && compareAtPrice && (
        <span className={cn(styles.compare, 'text-gray-400 line-through')}>
          {formatPrice(compareAtPrice)}
        </span>
      )}
      {showDiscount && discount > 0 && (
        <span className={cn(styles.badge, 'font-semibold text-red-600 bg-red-50 rounded')}>
          -{discount}%
        </span>
      )}
    </div>
  );
}
