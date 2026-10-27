/**
 * Fixed prices for a market's currency: every product in one table with its
 * price, the converted price as a hint, and a box for the merchant's own
 * price (product.prices[currency]). Only changed rows are saved. Variants
 * with their own price are priced from the product page.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { errorMessage } from './shared';
import { customerPrice, formatAmount } from './marketPricing';
import type { MarketConfig, PricedProduct } from './MarketDialog';

interface Props {
  market: MarketConfig;
  base: string;
  rate: number;
  products: PricedProduct[];
  onClose: () => void;
  onSaved: () => void;
}

export const MarketPricesDialog: React.FC<Props> = ({ market, base, rate, products, onClose, onSaved }) => {
  const { t } = useTranslation(['settings', 'common']);
  const currency = market.currency;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((p) => [p._id, typeof p.prices?.[currency] === 'number' ? String(p.prices[currency]) : ''])),
  );
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const original = (p: PricedProduct) => (typeof p.prices?.[currency] === 'number' ? String(p.prices[currency]) : '');
  const changed = products.filter((p) => (values[p._id] ?? '') !== original(p));
  const shown = useMemo(
    () => products.filter((p) => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [products, query],
  );
  const converted = (p: PricedProduct) =>
    customerPrice(p.price, null, { rate, adjustment: market.priceAdjustmentPct || 0, rounding: market.rounding || 'none' }).amount;

  const handleSave = async () => {
    for (const p of changed) {
      const v = values[p._id];
      if (v !== '' && !(parseFloat(v) >= 0)) {
        return toast.error(t('settings.mk.prices.invalid', { product: p.name }));
      }
    }
    setSaving(true);
    try {
      for (const p of changed) {
        const v = values[p._id];
        const prices = { ...(p.prices || {}) };
        if (v === '') delete prices[currency];
        else prices[currency] = parseFloat(v);
        await api.products.update(p._id, { prices: Object.keys(prices).length ? prices : null });
      }
      toast.success(t('settings.mk.prices.saved', { count: changed.length }));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('settings.mk.prices.save_failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('settings.mk.prices.title', { name: market.name, currency })}</DialogTitle>
          <DialogDescription>{t('settings.mk.prices.help', { currency })}</DialogDescription>
        </DialogHeader>
        {products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('settings.mk.prices.empty')}</p>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="ps-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common:action.search')} />
            </div>
            <div className="divide-y rounded-md border">
              {shown.map((p) => (
                <div key={p._id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatAmount(p.price, base)} · {t('settings.mk.prices.converted', { price: formatAmount(converted(p), currency) })}
                    </p>
                  </div>
                  <Input
                    type="number" step="0.01" min="0" inputMode="decimal"
                    aria-label={t('products:products.form.own_prices.field', { code: currency })}
                    className="w-28 shrink-0"
                    placeholder={String(converted(p))}
                    value={values[p._id] ?? ''}
                    onChange={(e) => setValues((vs) => ({ ...vs, [p._id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('settings.mk.prices.variants_note')}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common:action.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving || changed.length === 0}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('settings.mk.prices.save', { count: changed.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
