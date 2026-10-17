import React from 'react';
import { useTranslation } from 'react-i18next';

/** The suggestions as buttons; the one in use is marked. */
export const StoreLinkSuggestions: React.FC<{
  suggestions: string[] | null;
  current: string;
  onPick: (subdomain: string) => void;
}> = ({ suggestions, current, onPick }) => {
  const { t } = useTranslation('common');
  if (!suggestions?.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{t('store_link.suggestions')}</p>
      <div className="flex flex-wrap gap-2" dir="ltr">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            aria-pressed={s === current}
            className={`min-h-[36px] rounded-full border px-3 text-sm font-medium transition-colors ${
              s === current ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};
