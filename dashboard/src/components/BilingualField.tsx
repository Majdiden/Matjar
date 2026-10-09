/**
 * BilingualField (PBI 10-14) — Arabic-first text field with optional English.
 *
 * Merchants write in Arabic; English is always optional. The Arabic input
 * (dir="rtl", lang="ar") is always shown. A small "+ English (optional)"
 * link reveals an English input (dir="ltr"); when the value already has
 * English, that input is shown from the start.
 *
 * In the English dashboard both inputs are shown, English first (left to
 * right, like the rest of the page) and Arabic under it, so the field
 * doesn't read right-to-left for a merchant working in English. Arabic is
 * still the required language.
 *
 * Usage:
 *
 *   const [tagline, setTagline] = useState<BilingualValue>({ ar: 'عطور أصلية' });
 *   <BilingualField
 *     id="tagline"
 *     label={t('storeDesign:brand.tagline.label')}
 *     value={tagline}
 *     onChange={setTagline}
 *     onCommit={(v) => save({ brand: { tagline: v.ar || v.en ? v : null } })}
 *     maxLength={140}
 *     multiline
 *   />
 *
 * Props:
 *   - `value` / `onChange`: controlled `{ ar?, en? }`. Empty strings are
 *     passed through as typed; trim on save (see `cleanBilingual`).
 *   - `onCommit(value)`: fires when focus leaves the WHOLE field (moving
 *     between the Arabic and English inputs does not count) and the value
 *     is valid — the autosave hook point. Not called while Arabic is missing.
 *   - `required`: Arabic must be filled. Without it the field may be left
 *     empty, but English alone is never accepted (the brand-kit API rule).
 *   - `multiline` + `rows`: textarea instead of a one-line input.
 *   - `maxLength`: per language; shows a "12/140" counter and caps typing.
 *   - `error`: an outside error (e.g. from the server), shown under the field.
 *   - `help`: one plain line under the label.
 *   - `labelAction`: small element at the end of the label row (e.g. the
 *     brand form's "Saved" indicator).
 *   - `placeholder`: `{ ar?, en? }`.
 *   - `disabled`.
 *
 * Helpers (lib/bilingual.ts, kept out of this file for fast refresh):
 * `validateBilingual(value, { required })` returns the error kind
 * ('ar_required' | 'en_only' | null); `cleanBilingual(value)` trims and drops
 * empty languages, returning null when nothing is left (= clear the field);
 * `sameBilingual(a, b)` compares two values after trimming.
 */
import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { validateBilingual, type BilingualValue } from '../lib/bilingual';

export type { BilingualValue, BilingualError } from '../lib/bilingual';

export interface BilingualFieldProps {
  id?: string;
  label: React.ReactNode;
  value: BilingualValue;
  onChange: (next: BilingualValue) => void;
  onCommit?: (value: BilingualValue) => void;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  error?: string | null;
  help?: React.ReactNode;
  /** Small element at the end of the label row (e.g. a "Saved" indicator). */
  labelAction?: React.ReactNode;
  placeholder?: BilingualValue;
  disabled?: boolean;
  className?: string;
}

const inputClass =
  'block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export const BilingualField: React.FC<BilingualFieldProps> = ({
  id,
  label,
  value,
  onChange,
  onCommit,
  required = false,
  multiline = false,
  rows = 2,
  maxLength,
  error,
  help,
  labelAction,
  placeholder,
  disabled,
  className,
}) => {
  const { t, i18n } = useTranslation('storeDesign');
  const englishFirst = !(i18n.language || 'ar').startsWith('ar');
  const autoId = useId();
  const baseId = id || autoId;
  const arId = `${baseId}-ar`;
  const enId = `${baseId}-en`;

  const hasEnglish = !!(value.en && value.en.length);
  const [englishOpen, setEnglishOpen] = useState(hasEnglish);
  const showEnglish = englishOpen || hasEnglish;
  // Validation shows only after the merchant has left the field once, so an
  // empty required field doesn't greet them with an error.
  const [touched, setTouched] = useState(false);

  const kind = touched ? validateBilingual(value, { required }) : null;
  const message = error || (kind ? t(`bilingual.error.${kind}`) : null);
  const errorId = message ? `${baseId}-error` : undefined;

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Focus moving between our own inputs (or the toggle) isn't "leaving".
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setTouched(true);
    if (!validateBilingual(value, { required })) onCommit?.(value);
  };

  // Opening English moves focus into it; removing it moves focus back to the
  // Arabic input first, so the toggle unmounting never reads as "leaving".
  const [focusEnglish, setFocusEnglish] = useState(false);
  const removeEnglish = () => {
    document.getElementById(arId)?.focus();
    setEnglishOpen(false);
    const next = { ar: value.ar };
    onChange(next);
    if (!validateBilingual(next, { required })) onCommit?.(next);
  };

  const renderInput = (lang: 'ar' | 'en') => {
    const props = {
      id: lang === 'ar' ? arId : enId,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      lang,
      value: value[lang] || '',
      maxLength,
      disabled,
      autoFocus: lang === 'en' && focusEnglish,
      placeholder: placeholder?.[lang],
      'aria-invalid': lang === 'ar' && message ? true : undefined,
      'aria-describedby': errorId,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChange({ ...value, [lang]: e.target.value }),
      className: cn(inputClass, message && lang === 'ar' && 'border-destructive', multiline && 'resize-y min-h-[3.5rem]'),
    } as const;
    const count = (value[lang] || '').length;
    return (
      <div className="space-y-1">
        {multiline ? <textarea rows={rows} {...props} /> : <input type="text" {...props} />}
        {maxLength ? (
          <p
            className={cn('text-xs tabular-nums text-muted-foreground', lang === 'ar' ? 'text-start' : 'text-end')}
            dir="ltr"
            aria-live="polite"
          >
            {count}/{maxLength}
          </p>
        ) : null}
      </div>
    );
  };

  if (englishFirst) {
    return (
      <div className={cn('space-y-2', className)} onBlur={handleBlur}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <label htmlFor={enId} className="text-base font-semibold">
            {label}
          </label>
          {labelAction}
        </div>
        {help && <p className="text-sm text-muted-foreground">{help}</p>}
        <p className="text-xs font-medium text-muted-foreground">{t('bilingual.english')}</p>
        {renderInput('en')}
        <label htmlFor={arId} className="block pt-1 text-xs font-medium text-muted-foreground">
          {t('bilingual.arabic')}
        </label>
        {renderInput('ar')}
        {message && (
          <p id={errorId} className="text-sm text-destructive" role="alert">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)} onBlur={handleBlur}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={arId} className="text-base font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      {help && <p className="text-sm text-muted-foreground">{help}</p>}

      {showEnglish && (
        <p className="text-xs font-medium text-muted-foreground">{t('bilingual.arabic')}</p>
      )}
      {renderInput('ar')}

      {showEnglish ? (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={enId} className="text-xs font-medium text-muted-foreground">
              {t('bilingual.english')}
            </label>
            {!disabled && (
              <button
                type="button"
                onClick={removeEnglish}
                className="inline-flex min-h-[40px] items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                {t('bilingual.remove_english')}
              </button>
            )}
          </div>
          {renderInput('en')}
        </div>
      ) : (
        !disabled && (
          <button
            type="button"
            onClick={() => {
              setFocusEnglish(true);
              setEnglishOpen(true);
            }}
            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            {t('bilingual.add_english')}
          </button>
        )
      )}

      {message && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
    </div>
  );
};

export default BilingualField;
