/**
 * Currencies tab — base currency + FX rates table against
 * /store-settings/currencies.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { CurrencyPicker } from '../../components/ui/pickers';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { errorMessage, type CurrencyConfig } from './shared';

export const CurrencySettings: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const [config, setConfig] = useState<CurrencyConfig>({ base: 'SDG', rates: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftRates, setDraftRates] = useState<Array<{ code: string; rate: string }>>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.settings.listMarketsSettings() as { data?: { currencies?: CurrencyConfig } };
      const cfg: CurrencyConfig = res.data?.currencies || { base: 'SDG', rates: {} };
      setConfig(cfg);
      setDraftRates(Object.entries(cfg.rates || {}).map(([code, rate]) => ({ code, rate: String(rate) })));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.currencies_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const rates: Record<string, number> = {};
    for (const row of draftRates) {
      const code = row.code.trim().toUpperCase();
      const num = parseFloat(row.rate);
      if (!code) continue;
      if (!/^[A-Z]{3}$/.test(code)) return toast.error(t('settings.validation.invalid_currency_code', { code: row.code }));
      if (isNaN(num) || num <= 0) return toast.error(t('settings.validation.rate_must_be_positive', { code }));
      rates[code] = num;
    }
    setSaving(true);
    try {
      const res = await api.settings.updateCurrencies({ base: config.base, rates }) as { data?: CurrencyConfig };
      setConfig(res.data || { base: config.base, rates });
      toast.success(t('settings.toast.currencies_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.currencies_save_failed')));
    } finally {
      setSaving(false);
    }
  };

  const addRow = () => setDraftRates(rs => [...rs, { code: '', rate: '1' }]);
  const removeRow = (i: number) => setDraftRates(rs => rs.filter((_, j) => j !== i));
  const updateRow = (i: number, patch: Partial<{ code: string; rate: string }>) =>
    setDraftRates(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));

  if (loading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.section.currencies.title')}</CardTitle>
        <CardDescription>
          {t('settings.section.currencies.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2 max-w-xs">
          <Label>{t('settings.field.currencies.base.label')}</Label>
          <CurrencyPicker
            value={config.base}
            onChange={v => setConfig(c => ({ ...c, base: v }))}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('settings.field.currencies.exchange_rates.label')}</Label>
            <Button variant="ghost" size="sm" onClick={addRow}>
              <Plus className="h-3.5 w-3.5 me-1" />{t('settings.button.add_currency')}
            </Button>
          </div>
          {draftRates.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4">{t('settings.empty.no_currencies')}</p>
          ) : (
            <div className="space-y-2">
              {draftRates.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="w-40">
                    <CurrencyPicker
                      value={row.code}
                      onChange={v => updateRow(i, { code: v })}
                      placeholder={t('settings.field.currencies.currency_placeholder')}
                    />
                  </div>
                  <Input
                    type="number" step="0.0001" min="0"
                    placeholder={t('settings.field.currencies.rate_placeholder')}
                    className="flex-1"
                    value={row.rate}
                    onChange={e => updateRow(i, { rate: e.target.value })}
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeRow(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {config.ratesUpdatedAt && (
          <p className="text-xs text-muted-foreground">
            {t('settings.fx_rates_updated_at', { datetime: new Date(config.ratesUpdatedAt).toLocaleString() })}
          </p>
        )}

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
