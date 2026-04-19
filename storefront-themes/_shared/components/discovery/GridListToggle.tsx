import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'gridListToggle';

interface GridListToggleProps {
  view: 'grid' | 'list';
  onChange: (view: 'grid' | 'list') => void;
  className?: string;
}

export function GridListToggle(props: GridListToggleProps) {
  const Override = useThemeSlot<React.ComponentType<GridListToggleProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { t } = useTranslation('discovery');
  const { view, onChange, className } = props;
  return (
    <div className={cn('inline-flex border rounded-lg overflow-hidden', className)}>
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'p-2 transition-colors',
          view === 'grid' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100'
        )}
        aria-label={t('toggle.grid_aria')}
        aria-pressed={view === 'grid'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn(
          'p-2 transition-colors',
          view === 'list' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100'
        )}
        aria-label={t('toggle.list_aria')}
        aria-pressed={view === 'list'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="14" height="3" rx="1" />
          <rect x="1" y="6" width="14" height="3" rx="1" />
          <rect x="1" y="11" width="14" height="3" rx="1" />
        </svg>
      </button>
    </div>
  );
}
