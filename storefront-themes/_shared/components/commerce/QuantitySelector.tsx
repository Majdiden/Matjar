import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'quantitySelector';

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const sizeStyles = {
  sm: { button: 'w-7 h-7 text-sm', display: 'w-8 text-sm' },
  md: { button: 'w-9 h-9 text-base', display: 'w-10 text-base' },
  lg: { button: 'w-11 h-11 text-lg', display: 'w-12 text-lg' },
};

export function QuantitySelector(props: QuantitySelectorProps) {
  const Override = useThemeSlot<React.ComponentType<QuantitySelectorProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    value,
    onChange,
    min = 1,
    max = 99,
    className,
    size = 'md',
    disabled = false,
  } = props;
  const { t } = useTranslation('product');
  const styles = sizeStyles[size];

  return (
    <div className={cn('inline-flex items-center border rounded-lg', className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className={cn(
          styles.button,
          'flex items-center justify-center rounded-s-lg transition',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'disabled:opacity-30 disabled:cursor-not-allowed'
        )}
        aria-label={t('quantity.aria.decrement')}
      >
        &minus;
      </button>
      <span className={cn(styles.display, 'text-center font-medium select-none')} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className={cn(
          styles.button,
          'flex items-center justify-center rounded-e-lg transition',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'disabled:opacity-30 disabled:cursor-not-allowed'
        )}
        aria-label={t('quantity.aria.increment')}
      >
        +
      </button>
    </div>
  );
}
