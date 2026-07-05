/**
 * Markets tab — geographic price targeting. Source of truth for checkout
 * presentment (audit 3.5: the standalone pages/markets/Markets.tsx orphan
 * was deleted; this tab is the canonical surface).
 *
 * Persisted under `tenant.settings.markets` and consumed by
 * services/markets.js and services/checkout.js::priceCheckout. Currency
 * per market must be present in the Currencies FX table for presentment
 * conversion to succeed — the form flags a missing rate inline.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { CurrencyPicker, LanguagePicker, CountryPicker } from '../../components/ui/pickers';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { Globe2, Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';
import { errorMessage, type CurrencyConfig } from './shared';

interface MarketConfig {
  _id: string;
  code: string;
  name: string;
  countries: string[];
  currency: string;
  language: string;
  priceAdjustmentPct: number;
  enabled: boolean;
  isDefault: boolean;
}

const MARKETS_EMPTY_FORM = {
  code: '',
  name: '',
  countries: [] as string[],
  currency: '',
  language: 'en',
  priceAdjustmentPct: '0',
  enabled: true,
  isDefault: false,
};

export const MarketsSettings: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<string>('SDG');
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(MARKETS_EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.settings.listMarketsSettings() as {
        data?: { markets?: MarketConfig[]; currencies?: CurrencyConfig };
      };
      setMarkets(res.data?.markets || []);
      setBaseCurrency(res.data?.currencies?.base || 'SDG');
      setFxRates(res.data?.currencies?.rates || {});
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.markets_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...MARKETS_EMPTY_FORM, currency: baseCurrency });
    setDialogOpen(true);
  };

  const openEdit = (m: MarketConfig) => {
    setEditingId(m._id);
    setForm({
      code: m.code,
      name: m.name,
      countries: [...(m.countries || [])],
      currency: m.currency,
      language: m.language || 'en',
      // Stored as a decimal fraction (0.1 = +10%); edit in percent for UX.
      priceAdjustmentPct: String(((m.priceAdjustmentPct || 0) * 100).toFixed(2)).replace(/\.?0+$/, ''),
      enabled: m.enabled !== false,
      isDefault: !!m.isDefault,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const code = form.code.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,32}$/.test(code)) return toast.error(t('settings.validation.market_code_invalid'));
    if (!form.name.trim()) return toast.error(t('settings.validation.market_name_required'));
    if (!/^[A-Z]{3}$/.test(form.currency)) return toast.error(t('settings.validation.market_currency_invalid'));
    const countries = form.countries.map(c => c.toUpperCase()).filter(Boolean);
    for (const c of countries) {
      if (!/^[A-Z]{2}$/.test(c)) return toast.error(t('settings.validation.market_country_invalid', { code: c }));
    }
    const pct = parseFloat(form.priceAdjustmentPct || '0');
    if (isNaN(pct) || pct < -95 || pct > 500) {
      return toast.error(t('settings.validation.market_price_adjustment_range'));
    }
    const payload = {
      code,
      name: form.name.trim(),
      countries,
      currency: form.currency,
      language: form.language.trim().toLowerCase() || 'en',
      priceAdjustmentPct: pct / 100,
      enabled: form.enabled,
      isDefault: form.isDefault,
    };
    setSaving(true);
    try {
      if (editingId) {
        await api.settings.updateMarketSettings(editingId, payload);
        toast.success(t('settings.toast.market_updated'));
      } else {
        await api.settings.createMarketSettings(payload);
        toast.success(t('settings.toast.market_created'));
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.market_save_failed')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: MarketConfig) => {
    if (!(await confirm({
      title: t('settings.confirm.delete_market.title', { name: m.name }),
      description: t('settings.confirm.delete_market.description'),
      confirmText: t('settings.confirm.delete_market.confirm_text'),
      variant: 'destructive',
    }))) return;
    try {
      await api.settings.deleteMarketSettings(m._id);
      toast.success(t('settings.toast.market_deleted'));
      setMarkets(list => list.filter(x => x._id !== m._id));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.market_delete_failed')));
    }
  };

  // Markets quote in a currency that isn't the base. Checkout uses the FX
  // table to convert — if there's no rate, presentment silently falls back
  // to the base. Surface the gap so the merchant fixes it in Currencies.
  const missingFxWarning = (currency: string): string | null => {
    if (!currency || currency === baseCurrency) return null;
    if (fxRates[currency] > 0) return null;
    return t('settings.fx_missing_warning', { currency, base: baseCurrency });
  };

  const addCountryRow = () => setForm(f => ({ ...f, countries: [...f.countries, ''] }));
  const updateCountryRow = (i: number, v: string) =>
    setForm(f => ({ ...f, countries: f.countries.map((c, j) => j === i ? v : c) }));
  const removeCountryRow = (i: number) =>
    setForm(f => ({ ...f, countries: f.countries.filter((_, j) => j !== i) }));

  if (loading) return <Skeleton className="h-96" />;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{t('settings.section.markets.title')}</CardTitle>
            <CardDescription>
              {t('settings.section.markets.description')}
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 me-2" />{t('settings.button.add_market')}
          </Button>
        </CardHeader>
        <CardContent>
          {markets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('settings.empty.no_markets')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {markets.map(m => {
                const warn = missingFxWarning(m.currency);
                return (
                  <div key={m._id} className="flex items-start justify-between border rounded-md px-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold">{m.code}</span>
                        <span className="text-sm">{m.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{m.currency}</Badge>
                        {m.priceAdjustmentPct !== 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {m.priceAdjustmentPct > 0 ? '+' : ''}{(m.priceAdjustmentPct * 100).toFixed(1)}%
                          </Badge>
                        )}
                        {m.isDefault && <Badge className="text-[10px]">{t('settings.market_badge_default')}</Badge>}
                        {!m.enabled && <Badge variant="outline" className="text-[10px] text-muted-foreground">{t('settings.market_badge_disabled')}</Badge>}
                      </div>
                      {m.countries.length > 0 && (
                        <p className="text-xs text-muted-foreground">{m.countries.join(', ')}</p>
                      )}
                      {warn && (
                        <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{warn}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(m)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t('settings.dialog.edit_market') : t('settings.dialog.new_market')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.field.markets.code.label')}</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder={t('settings.field.markets.code.placeholder')}
                />
                <p className="text-xs text-muted-foreground">{t('settings.field.markets.code.help')}</p>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.field.markets.name.label')}</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('settings.field.markets.name.placeholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.field.markets.currency.label')}</Label>
                <CurrencyPicker
                  value={form.currency}
                  onChange={v => setForm(f => ({ ...f, currency: v }))}
                />
                {missingFxWarning(form.currency) && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />{missingFxWarning(form.currency)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('settings.field.markets.language.label')}</Label>
                <LanguagePicker
                  value={form.language}
                  onChange={v => setForm(f => ({ ...f, language: v }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('settings.field.markets.countries.label')}</Label>
                <Button variant="ghost" size="sm" onClick={addCountryRow}>
                  <Plus className="h-3.5 w-3.5 me-1" />{t('settings.button.add_country')}
                </Button>
              </div>
              {form.countries.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  {t('settings.empty.no_countries')}
                </p>
              ) : (
                <div className="space-y-2">
                  {form.countries.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <CountryPicker
                          value={c}
                          onChange={v => updateCountryRow(i, v)}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeCountryRow(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('settings.field.markets.price_adjustment.label')}</Label>
              <Input
                type="number"
                step="0.1"
                min="-95"
                max="500"
                value={form.priceAdjustmentPct}
                onChange={e => setForm(f => ({ ...f, priceAdjustmentPct: e.target.value }))}
                placeholder={t('settings.field.markets.price_adjustment.placeholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.field.markets.price_adjustment.help')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{t('settings.field.markets.enabled.label')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.field.markets.enabled.description')}</p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))}
                />
              </div>
              <div className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{t('settings.field.markets.default.label')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.field.markets.default.description')}</p>
                </div>
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={v => setForm(f => ({ ...f, isDefault: v }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              {editingId ? t('common:action.update') : t('common:action.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
