/**
 * Settings → Markets: the one place a merchant sets what customers pay.
 *
 *   - The pricing currency: the currency product prices are written in.
 *   - Markets: each has its countries and the currency customers there pay
 *     in, priced either by converting the merchant's prices with an exchange
 *     rate (rounded up to tidy amounts) or by the merchant's own fixed price
 *     per product (the converted price until one is written). Each market can
 *     limit payment methods. The default market serves visitors from every
 *     other country.
 *
 * Every card and the add/edit dialog show real products as the customer will
 * see them (marketPricing.ts mirrors services/regionalPricing.js). A market's
 * exchange rate is saved with it (controllers/settings.js marketRateUpdate).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { CurrencyPicker } from '../../components/ui/pickers';
import { Globe2, Plus, Pencil, Trash2, AlertCircle, Tags, Loader2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';
import { errorMessage, type CurrencyConfig } from './shared';
import { flag, countryName, currencyName, customerPrice, formatAmount } from './marketPricing';
import { MarketDialog, type MarketConfig, type MarketsContext, type PricedProduct } from './MarketDialog';
import { MarketPricesDialog } from './MarketPricesDialog';

interface PaymentMethodOption {
  code: string;
  label?: string;
  enabled?: boolean;
}

export const MarketsSettings: React.FC = () => {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const listSeparator = i18n.language?.startsWith('ar') ? '، ' : ', ';
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyConfig>({ base: 'SDG', rates: {} });
  const [platformRates, setPlatformRates] = useState<Record<string, number>>({});
  const [paymentOptions, setPaymentOptions] = useState<PaymentMethodOption[]>([]);
  const [products, setProducts] = useState<PricedProduct[]>([]);
  const [editing, setEditing] = useState<MarketConfig | 'new' | null>(null);
  const [pricesFor, setPricesFor] = useState<MarketConfig | null>(null);
  const [baseEditing, setBaseEditing] = useState<string | null>(null);
  const [savingBase, setSavingBase] = useState(false);

  const load = async () => {
    try {
      const res = await api.settings.listMarketsSettings() as {
        data?: { markets?: MarketConfig[]; currencies?: CurrencyConfig; platformRates?: Record<string, number> };
      };
      setMarkets(res.data?.markets || []);
      setCurrencies(res.data?.currencies || { base: 'SDG', rates: {} });
      setPlatformRates(res.data?.platformRates || {});
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.markets_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    const res = await api.products.getAll({ page: 1, limit: 1000 }).catch(() => null) as {
      responseObject?: { data?: PricedProduct[] };
    } | null;
    setProducts((res?.responseObject?.data || []).filter((p) => typeof p.price === 'number'));
  };

  useEffect(() => {
    load();
    loadProducts();
    (api.paymentMethods.list() as Promise<{ data?: { methods?: PaymentMethodOption[] } }>)
      .then((pm) => setPaymentOptions((pm?.data?.methods || []).filter((m) => m.enabled !== false)))
      .catch(() => setPaymentOptions([]));
    // load/loadProducts only read setters; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base = currencies.base;
  const rateOf = (code: string) => (code === base ? 1 : Number(currencies.rates?.[code]) || 0);
  const example = products[0] || null;

  const ctx: MarketsContext = useMemo(() => ({
    base,
    rates: currencies.rates || {},
    auto: currencies.auto || [],
    platformRates,
    paymentOptions,
    products,
    markets,
  }), [base, currencies, platformRates, paymentOptions, products, markets]);

  const saveBase = async () => {
    if (!baseEditing || baseEditing === base) return setBaseEditing(null);
    setSavingBase(true);
    try {
      await api.settings.updateCurrencies({ base: baseEditing });
      toast.success(t('settings.mk.base.saved'));
      setBaseEditing(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.currencies_save_failed')));
    } finally {
      setSavingBase(false);
    }
  };

  const handleDelete = async (m: MarketConfig) => {
    if (!(await confirm({
      title: t('settings.confirm.delete_market.title', { name: m.name }),
      description: t('settings.mk.delete_description'),
      confirmText: t('settings.confirm.delete_market.confirm_text'),
      variant: 'destructive',
    }))) return;
    try {
      await api.settings.deleteMarketSettings(m._id);
      toast.success(t('settings.toast.market_deleted'));
      await load();
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.market_delete_failed')));
    }
  };

  if (loading) return <Skeleton className="h-96" />;

  // Formulas and amounts keep their own left-to-right order inside Arabic text.
  const ltr = (text: string) => <bdi dir="ltr" className="whitespace-nowrap">{text}</bdi>;
  const rateFormula = (m: MarketConfig) =>
    ltr(`1 ${base} = ${Number(rateOf(m.currency).toPrecision(6)).toLocaleString('en-US')} ${m.currency}`);

  const pricingLine = (m: MarketConfig): React.ReactNode => {
    const rate = rateOf(m.currency);
    if (m.currency === base) return t('settings.mk.card.same_currency', { base });
    if (!rate) return t('settings.mk.card.no_rate', { currency: m.currency, base });
    const auto = (currencies.auto || []).some((a) => a.code === m.currency);
    const tail = (
      <>
        {' '}{rateFormula(m)}
        {m.rounding && m.rounding !== 'none' && ` · ${t(`settings.field.rounding.option.${m.rounding === '0.99' ? '099' : m.rounding}`)}`}
        {auto && ` · ${t('settings.mk.card.auto')}`}
      </>
    );
    if (m.pricing !== 'fixed') return <>{t('settings.mk.card.convert')}{tail}</>;
    const own = products.filter((p) => typeof p.prices?.[m.currency] === 'number').length;
    return <>{t('settings.mk.card.fixed', { count: own, total: products.length })}{tail}</>;
  };

  const exampleLine = (m: MarketConfig): React.ReactNode => {
    if (!example) return null;
    const rate = rateOf(m.currency) || 1;
    const shownCurrency = rateOf(m.currency) ? m.currency : base;
    const price = customerPrice(example.price, example.prices?.[m.currency], {
      rate, adjustment: m.priceAdjustmentPct || 0, rounding: m.rounding || 'none',
    });
    return (
      <>
        {example.name}: {ltr(formatAmount(example.price, base))} {i18n.dir() === 'rtl' ? '←' : '→'}{' '}
        {t('settings.mk.card.customer_sees')}{' '}
        <span className="font-semibold">{ltr(formatAmount(price.amount, shownCurrency))}</span>
      </>
    );
  };

  return (
    <>
      {/* Pricing currency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.mk.base.title')}</CardTitle>
          <CardDescription>{t('settings.mk.base.help')}</CardDescription>
        </CardHeader>
        <CardContent>
          {baseEditing === null ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                {t('settings.mk.base.line')}{' '}
                <span className="font-semibold">{currencyName(base)}</span>{' '}
                <span className="text-muted-foreground" dir="ltr">({base})</span>
              </p>
              <Button variant="outline" size="sm" onClick={() => setBaseEditing(base)}>
                {t('settings.mk.base.change')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-w-xs">
                <CurrencyPicker value={baseEditing} onChange={setBaseEditing} />
              </div>
              <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-500">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{t('settings.mk.base.warning')}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveBase} disabled={savingBase}>
                  {savingBase && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('common:action.save')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBaseEditing(null)}>{t('common:action.cancel')}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Markets */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{t('settings.mk.title')}</CardTitle>
            <CardDescription>{t('settings.mk.description')}</CardDescription>
          </div>
          <Button onClick={() => setEditing('new')} className="w-full sm:w-auto">
            <Plus className="me-2 h-4 w-4" />{t('settings.mk.add')}
          </Button>
        </CardHeader>
        <CardContent>
          {markets.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Globe2 className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p className="text-sm">{t('settings.mk.empty', { base })}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {markets.map((m) => {
                const noRate = m.currency !== base && !rateOf(m.currency);
                const methods = (m.paymentMethods || []).map((c) => paymentOptions.find((o) => o.code === c)?.label || c);
                const line = exampleLine(m);
                return (
                  <div key={m._id} className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg leading-none" aria-hidden="true">
                            {(m.countries || []).slice(0, 4).map(flag).join(' ') || '🌍'}
                          </span>
                          <span className="font-semibold">{m.name}</span>
                          {m.isDefault && <Badge className="text-[10px]">{t('settings.mk.badge.default')}</Badge>}
                          {!m.enabled && <Badge variant="outline" className="text-[10px] text-muted-foreground">{t('settings.market_badge_disabled')}</Badge>}
                          {noRate && (
                            <Badge variant="outline" className="border-amber-500 text-[10px] text-amber-600">
                              {t('settings.market_badge_no_rate')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {(m.countries || []).length
                            ? m.countries.map(countryName).join(listSeparator)
                            : t('settings.mk.card.all_countries')}
                          {m.isDefault && (m.countries || []).length > 0 && ` · ${t('settings.mk.card.and_others')}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('common:action.edit')} onClick={() => setEditing(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={t('common:action.delete')} onClick={() => handleDelete(m)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm">
                      <span className="font-medium">{currencyName(m.currency)}</span>{' '}
                      <span className="text-muted-foreground" dir="ltr">({m.currency})</span>
                    </p>
                    <p className="text-sm text-muted-foreground">{pricingLine(m)}</p>
                    {line && <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">{line}</p>}
                    <p className="text-xs text-muted-foreground">
                      {methods.length ? t('settings.field.markets.payment_methods.summary', { methods: methods.join(listSeparator) }) : t('settings.mk.card.all_payments')}
                    </p>
                    {m.pricing === 'fixed' && m.currency !== base && !noRate && (
                      <Button variant="outline" size="sm" onClick={() => setPricesFor(m)}>
                        <Tags className="me-2 h-4 w-4" />{t('settings.mk.prices.open', { currency: m.currency })}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <MarketDialog
          market={editing === 'new' ? null : editing}
          ctx={ctx}
          onClose={() => setEditing(null)}
          onSaved={async (saved, openPrices) => {
            setEditing(null);
            await load();
            if (openPrices) setPricesFor(saved);
          }}
        />
      )}
      {pricesFor && (
        <MarketPricesDialog
          market={pricesFor}
          base={base}
          rate={rateOf(pricesFor.currency)}
          products={products}
          onClose={() => setPricesFor(null)}
          onSaved={async () => {
            setPricesFor(null);
            await loadProducts();
          }}
        />
      )}
    </>
  );
};
