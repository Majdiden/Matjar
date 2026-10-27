/**
 * Add / edit a market (Settings → Markets) on one screen:
 *   1. countries (the currency and name fill in from the first one),
 *   2. how prices are set: converted with an exchange rate, or the merchant's
 *      own fixed prices (converted until written), with rounding,
 *   3. payment methods,
 * with a live preview of real products as customers there will see them.
 * Less common options (price adjustment, language, default, on/off) sit
 * under "More options".
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { CountryPicker, CurrencyPicker, LanguagePicker } from '../../components/ui/pickers';
import { ArrowLeftRight, ChevronDown, Loader2, X } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { focusFieldById } from '../../lib/focusFirstInvalid';
import { uiLanguage } from '../../lib/format';
import { cn } from '../../lib/utils';
import { errorMessage, ROUNDING_OPTIONS } from './shared';
import {
  applyRounding, countryName, currencyForCountry, currencyName, customerPrice, defaultRounding, flag, formatAmount, marketCode,
} from './marketPricing';

export interface MarketConfig {
  _id: string;
  code: string;
  name: string;
  countries: string[];
  currency: string;
  language: string;
  priceAdjustmentPct: number;
  pricing?: 'convert' | 'fixed';
  rounding?: string;
  paymentMethods?: string[];
  enabled: boolean;
  isDefault: boolean;
}

export interface PricedProduct {
  _id: string;
  name: string;
  price: number;
  prices?: Record<string, number> | null;
}

export interface MarketsContext {
  base: string;
  rates: Record<string, number>;
  auto: { code: string; margin: number }[];
  platformRates: Record<string, number>;
  paymentOptions: { code: string; label?: string }[];
  products: PricedProduct[];
  markets: MarketConfig[];
}

/** A number without float noise (2600, 0.000384615). */
const tidy = (n: number) => String(Number(n.toPrecision(6)));

interface Props {
  market: MarketConfig | null;
  ctx: MarketsContext;
  onClose: () => void;
  /** `openPrices`: a new fixed-price market, so the price table opens next. */
  onSaved: (market: MarketConfig, openPrices: boolean) => void;
}

export const MarketDialog: React.FC<Props> = ({ market, ctx, onClose, onSaved }) => {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const listSeparator = i18n.language?.startsWith('ar') ? '، ' : ', ';
  const { base } = ctx;
  const initialCurrency = market?.currency || '';
  const storedRate = initialCurrency ? Number(ctx.rates[initialCurrency]) || 0 : 0;
  const storedAuto = ctx.auto.find((a) => a.code === initialCurrency);

  const [name, setName] = useState(market?.name || '');
  const [nameTouched, setNameTouched] = useState(!!market);
  const [countries, setCountries] = useState<string[]>(market?.countries || []);
  const [currency, setCurrency] = useState(initialCurrency);
  const [currencyTouched, setCurrencyTouched] = useState(!!market);
  const [pricing, setPricing] = useState<'convert' | 'fixed'>(market?.pricing || 'convert');
  // Rate as typed: "1 {base} = value {currency}", or flipped "1 {currency} = value {base}".
  const [rateValue, setRateValue] = useState(storedRate ? tidy(storedRate >= 1 ? storedRate : 1 / storedRate) : '');
  const [flipped, setFlipped] = useState(storedRate > 0 && storedRate < 1);
  const [auto, setAuto] = useState(!!storedAuto);
  const [margin, setMargin] = useState(storedAuto ? tidy(storedAuto.margin * 100) : '0');
  const [rounding, setRounding] = useState(market?.rounding || 'none');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(market?.paymentMethods || []);
  const [adjustment, setAdjustment] = useState(market ? tidy((market.priceAdjustmentPct || 0) * 100) : '0');
  const [language, setLanguage] = useState(market?.language || uiLanguage());
  const [isDefault, setIsDefault] = useState(market ? market.isDefault : !ctx.markets.some((m) => m.isDefault));
  const [enabled, setEnabled] = useState(market ? market.enabled !== false : true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsRate = !!currency && currency !== base;
  const platformRate = currency ? ctx.platformRates[currency] : undefined;
  // The rate as stored (1 base = rate currency).
  const typedRate = (() => {
    const n = parseFloat(rateValue);
    return n > 0 ? (flipped ? 1 / n : n) : 0;
  })();
  const effectiveRate = !needsRate
    ? 1
    : auto && platformRate ? platformRate * (1 + (parseFloat(margin) || 0) / 100) : typedRate;
  const adjustmentPct = parseFloat(adjustment) || 0;
  const sharedWith = ctx.markets.filter((m) => m._id !== market?._id && m.currency === currency && needsRate);

  const addCountry = (code: string) => {
    if (!code || countries.includes(code)) return;
    const next = [...countries, code];
    setCountries(next);
    if (!nameTouched && next.length === 1) setName(countryName(code));
    if (!currencyTouched && next.length === 1) chooseCurrency(currencyForCountry(code) || base, false);
  };

  const chooseCurrency = (code: string, touched = true) => {
    setCurrency(code);
    if (touched) setCurrencyTouched(true);
    setRounding(defaultRounding(code));
    const stored = Number(ctx.rates[code]) || 0;
    const reference = stored || ctx.platformRates[code] || 0;
    setFlipped(reference > 0 && reference < 1);
    setRateValue(stored ? tidy(stored >= 1 ? stored : 1 / stored) : '');
    setAuto(ctx.auto.some((a) => a.code === code));
  };

  // Customers' view: up to three real products (or a 100 example).
  const preview = useMemo(() => {
    const sample = ctx.products.length ? ctx.products.slice(0, 3) : [{ _id: 'x', name: t('settings.mk.preview.sample'), price: 100, prices: null }];
    return sample.map((p) => ({
      ...p,
      shown: customerPrice(p.price, pricing === 'fixed' && needsRate ? p.prices?.[currency] : null, {
        rate: effectiveRate || 1, adjustment: adjustmentPct / 100, rounding: needsRate ? rounding : 'none',
      }),
    }));
  }, [ctx.products, pricing, needsRate, currency, effectiveRate, adjustmentPct, rounding, t]);
  const formulaProduct = preview.find((p) => !p.shown.own);

  const togglePayment = (code: string, on: boolean) => {
    const all = ctx.paymentOptions.map((o) => o.code);
    const current = paymentMethods.length ? paymentMethods : all;
    const next = on ? [...current, code] : current.filter((c) => c !== code);
    // Every method ticked is the same as "all" (stored empty).
    setPaymentMethods(next.length === all.length ? [] : next);
  };

  const handleSave = async () => {
    if (!countries.length && !isDefault) {
      focusFieldById('market-countries');
      return toast.error(t('settings.mk.error.countries'));
    }
    if (!name.trim()) {
      focusFieldById('market-name');
      return toast.error(t('settings.validation.market_name_required'));
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      focusFieldById('market-currency');
      return toast.error(t('settings.validation.market_currency_invalid'));
    }
    if (needsRate && !(auto && platformRate) && !(typedRate > 0)) {
      focusFieldById('market-rate');
      return toast.error(t('settings.mk.error.rate', { currency, base }));
    }
    if (isNaN(adjustmentPct) || adjustmentPct < -95 || adjustmentPct > 500) {
      setMoreOpen(true);
      focusFieldById('market-adjustment');
      return toast.error(t('settings.validation.market_price_adjustment_range'));
    }
    const marginPct = parseFloat(margin) || 0;
    const payload = {
      code: market?.code || marketCode(countries[0] || name, ctx.markets.map((m) => m.code)),
      name: name.trim(),
      countries,
      currency,
      language,
      priceAdjustmentPct: adjustmentPct / 100,
      pricing: needsRate ? pricing : 'convert',
      rounding: needsRate ? rounding : 'none',
      paymentMethods,
      enabled,
      isDefault,
      ...(needsRate ? (auto && platformRate ? { autoRate: { margin: marginPct / 100 } } : { rate: typedRate }) : {}),
    };
    setSaving(true);
    try {
      const res = market
        ? await api.settings.updateMarketSettings(market._id, payload)
        : await api.settings.createMarketSettings(payload);
      const saved = ((res as { data?: MarketConfig })?.data || { ...payload, _id: market?._id || '' }) as MarketConfig;
      toast.success(t(market ? 'settings.toast.market_updated' : 'settings.toast.market_created'));
      onSaved(saved, !market && payload.pricing === 'fixed');
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.market_save_failed')));
    } finally {
      setSaving(false);
    }
  };

  const optionCard = (value: 'convert' | 'fixed', title: string, help: string) => (
    <button
      type="button"
      onClick={() => setPricing(value)}
      aria-pressed={pricing === value}
      className={cn(
        'w-full rounded-lg border p-3 text-start transition-colors',
        pricing === value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{help}</span>
    </button>
  );

  const [left, right] = flipped ? [currency || '…', base] : [base, currency || '…'];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{market ? t('settings.mk.dialog.edit') : t('settings.mk.dialog.new')}</DialogTitle>
          <DialogDescription>{t('settings.mk.dialog.help', { base })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. Where */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t('settings.mk.step.where')}</h3>
            <div id="market-countries" className="space-y-2">
              {countries.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {countries.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm">
                      <span aria-hidden="true">{flag(c)}</span>{countryName(c)}
                      <button
                        type="button"
                        className="ms-1 rounded-full p-0.5 hover:bg-muted"
                        aria-label={t('common:action.remove')}
                        onClick={() => setCountries((cs) => cs.filter((x) => x !== c))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="max-w-sm">
                <CountryPicker value="" onChange={addCountry} placeholder={t('settings.mk.add_country')} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="market-name">{t('settings.mk.field.name')}</Label>
                <Input id="market-name" value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true); }} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.mk.field.currency')}</Label>
                <div id="market-currency">
                  <CurrencyPicker value={currency} onChange={(v) => chooseCurrency(v)} />
                </div>
                {currency && <p className="text-xs text-muted-foreground">{currencyName(currency)}</p>}
              </div>
            </div>
          </section>

          {/* 2. Prices */}
          {currency && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t('settings.mk.step.prices')}</h3>
              {!needsRate ? (
                <p className="text-sm text-muted-foreground">{t('settings.mk.same_currency', { base })}</p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {optionCard('convert', t('settings.mk.pricing.convert.title'), t('settings.mk.pricing.convert.help', { base, currency }))}
                    {optionCard('fixed', t('settings.mk.pricing.fixed.title'), t('settings.mk.pricing.fixed.help', { currency }))}
                  </div>

                  <div className="space-y-2 rounded-lg border p-3">
                    <Label htmlFor="market-rate">
                      {pricing === 'fixed' ? t('settings.mk.rate.label_fixed') : t('settings.mk.rate.label')}
                    </Label>
                    <div className="flex items-center gap-2" dir="ltr">
                      <span className="shrink-0 text-sm text-muted-foreground">1 {left} =</span>
                      <Input
                        id="market-rate"
                        type="number" step="any" min="0" inputMode="decimal"
                        className="min-w-0 flex-1"
                        disabled={auto && !!platformRate}
                        value={auto && platformRate ? tidy(flipped ? 1 / effectiveRate : effectiveRate) : rateValue}
                        placeholder={platformRate ? tidy(flipped ? 1 / platformRate : platformRate) : ''}
                        onChange={(e) => setRateValue(e.target.value)}
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">{right}</span>
                      <Button
                        type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                        title={t('settings.field.currencies.flip')} aria-label={t('settings.field.currencies.flip')}
                        onClick={() => {
                          const n = parseFloat(rateValue);
                          setFlipped((f) => !f);
                          if (n > 0) setRateValue(tidy(1 / n));
                        }}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {platformRate ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Switch id="market-auto" checked={auto} onCheckedChange={setAuto} />
                        <Label htmlFor="market-auto" className="font-normal">{t('settings.mk.rate.auto')}</Label>
                        {auto && (
                          <span className="flex items-center gap-1">
                            <span className="text-muted-foreground">{t('settings.field.currencies.auto.margin')}</span>
                            <Input
                              type="number" step="0.1" inputMode="decimal" className="h-8 w-20"
                              value={margin} onChange={(e) => setMargin(e.target.value)}
                            />
                            <span className="text-muted-foreground">%</span>
                          </span>
                        )}
                      </div>
                    ) : null}
                    {sharedWith.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t('settings.mk.rate.shared', { currency, markets: sharedWith.map((m) => m.name).join(listSeparator) })}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="market-rounding">{t('settings.field.rounding.label')}</Label>
                    <select
                      id="market-rounding"
                      className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
                      value={rounding}
                      onChange={(e) => setRounding(e.target.value)}
                    >
                      {ROUNDING_OPTIONS.map((r) => (
                        <option key={r} value={r}>{t(`settings.field.rounding.option.${r === '0.99' ? '099' : r}`)}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">{t('settings.field.rounding.help')}</p>
                  </div>
                </>
              )}

              {/* Live preview */}
              <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.mk.preview.title')}</p>
                <ul className="space-y-1.5">
                  {preview.map((p) => (
                    <li key={p._id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{p.name}</span>
                      <span className="shrink-0 font-semibold">
                        <bdi dir="ltr">{effectiveRate > 0 ? formatAmount(p.shown.amount, currency) : '—'}</bdi>
                        {p.shown.own && <span className="ms-1 text-xs font-normal text-muted-foreground">({t('settings.mk.preview.own')})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {needsRate && formulaProduct && effectiveRate > 0 && (
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {formatAmount(formulaProduct.price, base)}
                    {adjustmentPct ? ` × ${tidy(1 + adjustmentPct / 100)}` : ''} × {tidy(effectiveRate)} = {formatAmount(formulaProduct.price * (1 + adjustmentPct / 100) * effectiveRate, currency)}
                    {rounding !== 'none' && formulaProduct.shown.amount !== Math.round(formulaProduct.price * (1 + adjustmentPct / 100) * effectiveRate * 100) / 100
                      && ` → ${formatAmount(applyRounding(formulaProduct.price * (1 + adjustmentPct / 100) * effectiveRate, rounding), currency)}`}
                  </p>
                )}
                {needsRate && pricing === 'fixed' && (
                  <p className="text-xs text-muted-foreground">{t('settings.mk.preview.fixed_note', { currency })}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('settings.mk.preview.checkout', { currency: needsRate && effectiveRate > 0 ? currency : base })}</p>
              </div>
            </section>
          )}

          {/* 3. Payment */}
          {ctx.paymentOptions.length > 1 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t('settings.mk.step.payment')}</h3>
              <div className="space-y-2 rounded-md border px-3 py-2">
                {ctx.paymentOptions.map((pm) => (
                  <label key={pm.code} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={!paymentMethods.length || paymentMethods.includes(pm.code)}
                      onChange={(e) => togglePayment(pm.code, e.target.checked)}
                    />
                    {pm.label || pm.code}
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* More options */}
          <section className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
            >
              {t('settings.mk.more')}
              <ChevronDown className={cn('h-4 w-4 transition-transform', moreOpen && 'rotate-180')} />
            </button>
            {moreOpen && (
              <div className="space-y-4 border-t p-3">
                <div className="space-y-2">
                  <Label htmlFor="market-adjustment">{t('settings.field.markets.price_adjustment.label')}</Label>
                  <Input
                    id="market-adjustment" type="number" step="0.1" min="-95" max="500" className="max-w-[10rem]"
                    value={adjustment} onChange={(e) => setAdjustment(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.mk.adjustment_help')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.field.markets.language.label')}</Label>
                  <div className="max-w-xs"><LanguagePicker value={language} onChange={setLanguage} /></div>
                  <p className="text-xs text-muted-foreground">{t('settings.mk.language_help')}</p>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{t('settings.mk.default.label')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.mk.default.help')}</p>
                  </div>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{t('settings.field.markets.enabled.label')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.mk.enabled_help')}</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common:action.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {market ? t('common:action.save') : t('settings.mk.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
