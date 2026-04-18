import React from 'react';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'colorSwatch';

interface ColorOption {
  name: string;
  value: string;
  /** Optional image for pattern swatches */
  image?: string;
  disabled?: boolean;
}

interface ColorSwatchProps {
  options: ColorOption[];
  selected?: string;
  onChange: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

export function ColorSwatch(props: ColorSwatchProps) {
  const Override = useThemeSlot<React.ComponentType<ColorSwatchProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    options,
    selected,
    onChange,
    className,
    size = 'md',
    showLabel = true,
  } = props;
  const selectedOption = options.find(o => o.value === selected);

  return (
    <div className={className}>
      {showLabel && selectedOption && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Color: <span className="font-medium text-gray-900 dark:text-white">{selectedOption.name}</span>
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
              sizeClasses[size],
              'rounded-full border-2 transition-all relative',
              selected === option.value
                ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-900/20'
                : 'border-gray-200 hover:border-gray-400',
              option.disabled && 'opacity-30 cursor-not-allowed'
            )}
            style={option.image ? undefined : { backgroundColor: option.value }}
            title={option.name}
            aria-label={option.name}
            aria-pressed={selected === option.value}
          >
            {option.image && (
              <img src={option.image} alt={option.name} className="w-full h-full rounded-full object-cover" />
            )}
            {option.disabled && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-0.5 bg-gray-400 rotate-45 transform" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
