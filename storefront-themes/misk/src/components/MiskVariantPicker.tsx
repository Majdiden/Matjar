import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { findVariant, type Variant, type VariantOption } from '@matjar/theme-shared/components/commerce/VariantPicker';

interface Props {
  options: VariantOption[];
  variants: Variant[];
  selection: Record<string, string>;
  onSelectionChange: (next: Record<string, string>) => void;
  onVariantChange?: (v: Variant | null) => void;
  /** Picker presentation — a theme setting, not a per-product decision. */
  style?: 'buttons' | 'dropdown' | 'color-swatch';
}

/** Option names that carry a colour, so a swatch can paint itself from the value. */
const COLOUR_NAMES = /^(colou?r|لون|اللون)$/i;

/**
 * Variant picker in the Misk shape, with the presentation the merchant chose.
 *
 * A value is marked unavailable (struck through, still focusable) when no
 * variant in stock carries it alongside the rest of the current selection —
 * so a shopper can see what's gone rather than discovering it at checkout.
 */
export const MiskVariantPicker: React.FC<Props> = ({ options, variants, selection, onSelectionChange, onVariantChange, style = 'buttons' }) => {
  const { t } = useTranslation(['theme']);

  useEffect(() => {
    onVariantChange?.(findVariant(variants, selection, options) || null);
  }, [variants, selection, options, onVariantChange]);

  const pick = (name: string, value: string) => {
    const next = { ...selection };
    if (next[name] === value) delete next[name];
    else next[name] = value;
    onSelectionChange(next);
  };

  /** Would this value still resolve to something in stock? */
  const available = (name: string, value: string) => {
    const probe = { ...selection, [name]: value };
    return variants.some((v) => {
      const matches = v.optionValues.every((ov) => !probe[ov.name] || probe[ov.name] === ov.value);
      return matches && (v.stock ?? 0) > 0;
    });
  };

  return (
    <div className="space-y-6">
      {options.map((opt) => {
        const chosen = selection[opt.name];
        const isColour = COLOUR_NAMES.test(opt.name) && style === 'color-swatch';

        return (
          <div key={opt.name}>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="misk-eyebrow text-ink">{opt.name}</span>
              {chosen && <span className="text-sm text-muted">{chosen}</span>}
            </div>

            {style === 'dropdown' ? (
              <label className="block">
                <span className="sr-only">{t('theme.product.choose', { name: opt.name })}</span>
                <select
                  value={chosen || ''}
                  onChange={(e) => onSelectionChange(e.target.value ? { ...selection, [opt.name]: e.target.value } : (() => { const n = { ...selection }; delete n[opt.name]; return n; })())}
                  className="h-12 w-full rounded-full border border-line bg-white pe-10 ps-5 text-base text-ink outline-none focus:border-gold-ink"
                >
                  <option value="">{t('theme.product.choose', { name: opt.name })}</option>
                  {opt.values.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            ) : isColour ? (
              <div className="flex flex-wrap gap-3">
                {opt.values.map((v) => {
                  const on = chosen === v;
                  const ok = available(opt.name, v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => pick(opt.name, v)}
                      aria-pressed={on}
                      aria-label={v}
                      title={v}
                      className={`grid h-11 w-11 place-items-center rounded-full border-2 transition-colors duration-300 ${on ? 'border-ink' : 'border-line hover:border-gold-ink'} ${ok ? '' : 'opacity-40'}`}
                    >
                      <span className="h-7 w-7 rounded-full border border-black/10" style={{ background: v.toLowerCase() }} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {opt.values.map((v) => {
                  const on = chosen === v;
                  const ok = available(opt.name, v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => pick(opt.name, v)}
                      aria-pressed={on}
                      className={`min-h-[44px] rounded-full border px-5 text-sm transition-colors duration-300 ${on ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:border-gold-ink'} ${ok ? '' : 'text-muted line-through'}`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MiskVariantPicker;
