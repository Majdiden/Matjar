import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '../lib/utils';
import type { PhoneCountry, PhoneValue } from '../lib/phone';

export type { PhoneValue } from '../lib/phone';

export interface PhoneInputProps {
  id: string;
  value: PhoneValue;
  onChange: (next: PhoneValue) => void;
  countries: PhoneCountry[];
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: React.ReactNode;
  /** Small helper line under the field (hidden while an error is shown). */
  help?: React.ReactNode;
  className?: string;
}


/**
 * Mobile-first phone field: native country <select> (best UX on phones) plus
 * a tel input with the dial code pinned as a prefix. When the platform has a
 * single enabled country the select is hidden and the dial code is shown as a
 * static prefix. Digits always render LTR, even under Arabic.
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({
  id,
  value,
  onChange,
  countries,
  error,
  disabled,
  autoFocus,
  label,
  help,
  className,
}) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const list = countries.length ? countries : [];
  const selected = list.find((c) => c.iso2 === value.country) || list[0] || null;
  const single = list.length <= 1;
  const displayName = (c: PhoneCountry) => (isAr && c.nameAr ? c.nameAr : c.name);

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div
        className={cn(
          'flex items-stretch rounded-md border bg-background shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
          error && 'border-destructive',
          disabled && 'opacity-60',
        )}
      >
        {single ? (
          <div
            className="flex items-center px-3 text-sm text-muted-foreground bg-muted border-e whitespace-nowrap select-none"
            dir="ltr"
            aria-hidden
          >
            {selected?.dialCode}
          </div>
        ) : (
          <div className="relative flex items-center bg-muted border-e">
            <select
              id={`${id}-country`}
              aria-label={isAr ? 'الدولة' : 'Country'}
              value={selected?.iso2 || ''}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, country: e.target.value })}
              className="h-10 max-w-[9.5rem] appearance-none bg-transparent ps-3 pe-7 text-sm text-foreground focus:outline-none disabled:cursor-not-allowed"
            >
              {list.map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {displayName(c)} {c.dialCode}
                </option>
              ))}
            </select>
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="pointer-events-none absolute end-2 h-4 w-4 text-muted-foreground"
              fill="currentColor"
            >
              <path d="M5.5 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          placeholder={selected ? '9'.repeat(Math.min(selected.minDigits, 12)).replace(/9/g, '•') : ''}
          value={value.national}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          onChange={(e) => onChange({ ...value, national: e.target.value })}
          className="border-0 shadow-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-start"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>
      ) : help ? (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
};
