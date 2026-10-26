/**
 * Currencies tab, against /store-settings/currencies:
 *   - the pricing currency: product prices (and every amount the merchant
 *     enters) are in it, and the dashboard shows it;
 *   - exchange rates to other currencies;
 *   - the website currency: what visitors see and pay in, converted from the
 *     pricing currency (e.g. price in USD, sell in SDG);
 *   - whether visitors may switch currency on the website.
 *
 * A rate row reads "1 USD = 600 SDG" either way round (⇄ flips it), so the
 * merchant always types the number they quote. The API stores the multiplier
 * from the pricing currency (1 pricing unit = rate units, services/markets.js).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { CurrencyPicker } from '../../components/ui/pickers';
import { Save, Loader2, Plus, Trash2, ArrowLeftRight } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { focusFieldById } from '../../lib/focusFirstInvalid';
import { errorMessage, type CurrencyConfig } from './shared';
import { getTenantLocale } from '../../lib/format';

/**
 * One rate row. `flipped` false: "1 {base} = value {code}" (value is the
 * stored rate); true: "1 {code} = value {base}" (stored rate is 1 / value).
 */
interface RateRow {
  code: string;
  value: string;
  flipped: boolean;
}

/** A number without float noise (600, 0.00166667). */
const tidy = (n: number) => String(Number(n.toPrecision(6)));

/** Show each stored rate the way round that reads as a number ≥ 1. */
const rowFromRate = (code: string, rate: number): RateRow =>
  rate >= 1 ? { code, value: tidy(rate), flipped: false } : { code, value: tidy(1 / rate), flipped: true };

const rateFromRow = (row: RateRow, value: number) => (row.flipped ? 1 / value : value);

export const CurrencySettings: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const [config, setConfig] = useState<CurrencyConfig>({ base: 'SDG', rates: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<RateRow[]>([]);
  const [display, setDisplay] = useState<string>('');
  const [showSwitcher, setShowSwitcher] = useState(false);

  const apply = (cfg: CurrencyConfig) => {
    setConfig(cfg);
    setRows(
      Object.entries(cfg.rates || {})
        .filter(([code, rate]) => code !== cfg.base && Number(rate) > 0)
        .map(([code, rate]) => rowFromRate(code, Number(rate))),
    );
    setDisplay(cfg.display || '');
    setShowSwitcher(!!cfg.showSwitcher);
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.settings.listMarketsSettings() as { data?: { currencies?: CurrencyConfig } };
      apply(res.data?.currencies || { base: 'SDG', rates: {} });
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.currencies_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  // Currencies with a usable rate: the website can be shown in these.
  const ratedCodes = rows
    .map((r) => r.code.trim().toUpperCase())
    .filter((code, i) => /^[A-Z]{3}$/.test(code) && code !== config.base && Number(rows[i].value) > 0);

  const handleSave = async () => {
    const rates: Record<string, number> = {};
    for (const [i, row] of rows.entries()) {
      const code = row.code.trim().toUpperCase();
      const num = parseFloat(row.value);
      if (!code) continue;
      if (!/^[A-Z]{3}$/.test(code)) {
        focusFieldById(`currency-code-${i}`);
        return toast.error(t('settings.validation.invalid_currency_code', { code: row.code }));
      }
      if (isNaN(num) || num <= 0) {
        focusFieldById(`currency-rate-${i}`);
        return toast.error(t('settings.validation.rate_must_be_positive', { code }));
      }
      if (code === config.base) continue; // the pricing currency needs no rate
      rates[code] = rateFromRow(row, num);
    }
    const websiteCurrency = display && display !== config.base && rates[display] ? display : null;
    setSaving(true);
    try {
      const res = await api.settings.updateCurrencies({
        base: config.base,
        rates,
        display: websiteCurrency,
        showSwitcher,
      }) as { data?: CurrencyConfig };
      apply(res.data || { base: config.base, rates, display: websiteCurrency, showSwitcher });
      toast.success(t('settings.toast.currencies_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.currencies_save_failed')));
    } finally {
      setSaving(false);
    }
  };

  const addRow = () => setRows(rs => [...rs, { code: '', value: '', flipped: false }]);
  const removeRow = (i: number) => setRows(rs => rs.filter((_, j) => j !== i));
  const updateRow = (i: number, patch: Partial<RateRow>) =>
    setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));

  if (loading) return <Skeleton className="h-96" />;

  const websiteOptions = [config.base, ...ratedCodes];
  const website = websiteOptions.includes(display) ? display : config.base;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.section.currencies.title')}</CardTitle>
        <CardDescription>{t('settings.section.currencies.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pricing currency */}
        <div className="space-y-2 max-w-xs">
          <Label>{t('settings.field.currencies.base.label')}</Label>
          <CurrencyPicker value={config.base} onChange={v => setConfig(c => ({ ...c, base: v }))} />
          <p className="text-xs text-muted-foreground">{t('settings.field.currencies.base.help')}</p>
        </div>

        {/* Exchange rates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('settings.field.currencies.exchange_rates.label')}</Label>
            <Button variant="ghost" size="sm" onClick={addRow}>
              <Plus className="h-3.5 w-3.5 me-1" />{t('settings.button.add_currency')}
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4">{t('settings.empty.no_currencies')}</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row, i) => {
                const code = row.code || '…';
                const [left, right] = row.flipped ? [code, config.base] : [config.base, code];
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <div id={`currency-code-${i}`} className="w-32 shrink-0 sm:w-40">
                      <CurrencyPicker
                        value={row.code}
                        onChange={v => updateRow(i, { code: v })}
                        placeholder={t('settings.field.currencies.currency_placeholder')}
                      />
                    </div>
                    {/* 1 USD = [600] SDG */}
                    <div className="flex min-w-0 flex-1 items-center gap-2" dir="ltr">
                      <span className="shrink-0 text-sm text-muted-foreground">1 {left} =</span>
                      <Input
                        id={`currency-rate-${i}`}
                        type="number" step="any" min="0" inputMode="decimal"
                        placeholder={t('settings.field.currencies.rate_placeholder')}
                        className="min-w-0 flex-1"
                        value={row.value}
                        onChange={e => updateRow(i, { value: e.target.value })}
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">{right}</span>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-9 w-9"
                      title={t('settings.field.currencies.flip')}
                      aria-label={t('settings.field.currencies.flip')}
                      onClick={() => {
                        const n = Number(row.value);
                        updateRow(i, { flipped: !row.flipped, value: n > 0 ? tidy(1 / n) : row.value });
                      }}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeRow(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {config.ratesUpdatedAt && (
            <p className="text-xs text-muted-foreground">
              {t('settings.fx_rates_updated_at', { datetime: new Date(config.ratesUpdatedAt).toLocaleString(getTenantLocale()) })}
            </p>
          )}
        </div>

        {/* Website currency */}
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="website-currency">{t('settings.field.currencies.display.label')}</Label>
          <select
            id="website-currency"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={website}
            onChange={e => setDisplay(e.target.value === config.base ? '' : e.target.value)}
          >
            {websiteOptions.map((code) => (
              <option key={code} value={code}>
                {code === config.base ? t('settings.field.currencies.display.same', { code }) : code}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {website === config.base
              ? t('settings.field.currencies.display.help_same')
              : t('settings.field.currencies.display.help_other', { base: config.base, code: website })}
          </p>
        </div>

        {/* Switcher */}
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="currency-switcher">{t('settings.field.currencies.switcher.label')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.field.currencies.switcher.help')}</p>
          </div>
          <Switch
            id="currency-switcher"
            checked={showSwitcher}
            disabled={ratedCodes.length === 0}
            onCheckedChange={setShowSwitcher}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
            {t('settings.button.save_currencies')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
