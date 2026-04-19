import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'sizeSwatch';

interface SizeOption {
  name: string;
  value: string;
  disabled?: boolean;
}

interface SizeSwatchProps {
  options: SizeOption[];
  selected?: string;
  onChange: (value: string) => void;
  className?: string;
  showLabel?: boolean;
}

export function SizeSwatch(props: SizeSwatchProps) {
  const Override = useThemeSlot<React.ComponentType<SizeSwatchProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    options,
    selected,
    onChange,
    className,
    showLabel = true,
  } = props;
  const { t } = useTranslation('product');
  const selectedOption = options.find(o => o.value === selected);

  return (
    <div className={className}>
      {showLabel && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {t('size_swatch.label')}: <span className="font-medium text-gray-900 dark:text-white">{selectedOption?.name || t('size_swatch.select')}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => !option.disabled && onChange(option.value)}
            disabled={option.disabled}
            className={cn(
              'min-w-[2.5rem] h-10 px-3 border-2 rounded-lg text-sm font-medium transition-all',
              selected === option.value
                ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'border-gray-200 hover:border-gray-400 text-gray-700 dark:text-gray-300',
              option.disabled && 'opacity-30 cursor-not-allowed line-through'
            )}
            aria-pressed={selected === option.value}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}
