/**
 * The merchant's own prices in other currencies (product.prices /
 * variant.prices, e.g. { SAR: 99 }). Shoppers paying in that currency see
 * exactly this amount; an empty box keeps the converted price, shown as the
 * placeholder (services/regionalPricing.js).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cleanOwnPrices, type OtherCurrency } from './ownPrices';

const converted = (price: number, rate: number) => (price > 0 ? String(Math.round(price * rate * 100) / 100) : '');

interface Props {
  currencies: OtherCurrency[];
  value: Record<string, number> | null | undefined;
  onChange: (next: Record<string, number> | null) => void;
  /** The pricing-currency price the placeholders convert. */
  basePrice: number;
  /** Small inline boxes (variant table) instead of labelled fields. */
  compact?: boolean;
  idPrefix?: string;
}

export const OwnPricesEditor: React.FC<Props> = ({ currencies, value, onChange, basePrice, compact = false, idPrefix = 'own-price' }) => {
  const { t } = useTranslation(['products']);
  if (!currencies.length) return null;
  const set = (code: string, raw: string) => {
    const next = { ...(value || {}) };
    if (raw === '') delete next[code];
    else next[code] = parseFloat(raw);
    onChange(cleanOwnPrices(next));
  };
  if (compact) {
    return (
      <div className="mt-1 space-y-1">
        {currencies.map(({ code, rate }) => (
          <div key={code} className="flex items-center gap-1" dir="ltr">
            <span className="w-9 shrink-0 text-[10px] text-muted-foreground">{code}</span>
            <Input
              type="number" step="0.01" min="0" inputMode="decimal"
              aria-label={t('products.form.own_prices.field', { code })}
              placeholder={converted(basePrice, rate)}
              value={value?.[code] ?? ''}
              onChange={(e) => set(code, e.target.value)}
              className="h-7 w-24 text-xs"
            />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <p className="text-sm font-medium">{t('products.form.own_prices.title')}</p>
        <p className="text-xs text-muted-foreground">{t('products.form.own_prices.help')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {currencies.map(({ code, rate, markets }) => (
          <div key={code} className="space-y-2">
            <Label htmlFor={`${idPrefix}-${code}`}>
              {t('products.form.own_prices.market_field', { markets: markets.join(' / '), code })}
            </Label>
            <Input
              id={`${idPrefix}-${code}`}
              type="number" step="0.01" min="0" inputMode="decimal"
              placeholder={converted(basePrice, rate)}
              value={value?.[code] ?? ''}
              onChange={(e) => set(code, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
