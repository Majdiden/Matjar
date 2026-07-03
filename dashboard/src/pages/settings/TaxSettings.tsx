/**
 * Tax tab — behaviour flags + per-rate CRUD against /store-settings/tax/rates.
 * Granular per-row endpoints so two admins editing different tabs at the
 * same time don't clobber each other.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { CountryPicker } from '../../components/ui/pickers';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { Receipt, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';
import { errorMessage, FlagRow } from './shared';

interface TaxRate {
  _id: string;
  country: string;
  state?: string;
  rate: number;
  name?: string | null;
  productClass?: string | null;
}

interface TaxConfig {
  enabled: boolean;
  includeInPrice: boolean;
  taxShipping: boolean;
  rates: TaxRate[];
}

export const TaxSettings: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const [config, setConfig] = useState<TaxConfig>({ enabled: false, includeInPrice: false, taxShipping: false, rates: [] });
  const [loading, setLoading] = useState(true);
  const [savingFlags, setSavingFlags] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ country: '', state: '', rate: '', name: '', productClass: '' });
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.settings.listTaxRates() as { data?: TaxConfig };
      setConfig(res.data || { enabled: false, includeInPrice: false, taxShipping: false, rates: [] });
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.tax_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const saveFlags = async (patch: Partial<TaxConfig>) => {
    setSavingFlags(true);
    try {
      const next = { ...config, ...patch };
      await api.settings.update({ tax: { enabled: next.enabled, includeInPrice: next.includeInPrice, taxShipping: next.taxShipping } });
      setConfig(next);
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.tax_flag_save_failed')));
    } finally {
      setSavingFlags(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ country: '', state: '', rate: '', name: '', productClass: '' });
    setDialogOpen(true);
  };

  const openEdit = (rate: TaxRate) => {
    setEditingId(rate._id);
    setForm({
      country: rate.country,
      state: rate.state || '',
      rate: String(rate.rate * 100),
      name: rate.name || '',
      productClass: rate.productClass || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.country.trim()) return toast.error(t('settings.validation.country_required'));
    const ratePct = parseFloat(form.rate);
    if (isNaN(ratePct) || ratePct < 0 || ratePct > 100) return toast.error(t('settings.validation.rate_range'));
    const payload: {
      country: string;
      state?: string;
      rate: number;
      name?: string;
      productClass?: string;
    } = {
      country: form.country.trim(),
      state: form.state.trim() || undefined,
      rate: ratePct / 100,
      name: form.name.trim() || undefined,
      productClass: form.productClass.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editingId) {
        await api.settings.updateTaxRate(editingId, payload);
        toast.success(t('settings.toast.tax_rate_updated'));
      } else {
        await api.settings.createTaxRate(payload);
        toast.success(t('settings.toast.tax_rate_created'));
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.tax_rate_save_failed')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: t('settings.confirm.delete_tax_rate.title'),
      description: t('settings.confirm.delete_tax_rate.description'),
      confirmText: t('settings.confirm.delete_tax_rate.confirm_text'),
      variant: 'destructive',
    }))) return;
    try {
      await api.settings.deleteTaxRate(id);
      toast.success(t('settings.toast.tax_rate_deleted'));
      setConfig(c => ({ ...c, rates: c.rates.filter(r => r._id !== id) }));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.tax_rate_delete_failed')));
    }
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.tax_behaviour.title')}</CardTitle>
          <CardDescription>{t('settings.section.tax_behaviour.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FlagRow
            label={t('settings.tax_flag.charge_tax.label')}
            description={t('settings.tax_flag.charge_tax.description')}
            checked={config.enabled}
            onCheckedChange={v => saveFlags({ enabled: v })}
            disabled={savingFlags}
          />
          <FlagRow
            label={t('settings.tax_flag.include_in_price.label')}
            description={t('settings.tax_flag.include_in_price.description')}
            checked={config.includeInPrice}
            onCheckedChange={v => saveFlags({ includeInPrice: v })}
            disabled={savingFlags || !config.enabled}
          />
          <FlagRow
            label={t('settings.tax_flag.tax_shipping.label')}
            description={t('settings.tax_flag.tax_shipping.description')}
            checked={config.taxShipping}
            onCheckedChange={v => saveFlags({ taxShipping: v })}
            disabled={savingFlags || !config.enabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('settings.section.tax_rates.title')}</CardTitle>
            <CardDescription>{t('settings.section.tax_rates.description')}</CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 me-2" />{t('settings.button.add_rate')}
          </Button>
        </CardHeader>
        <CardContent>
          {config.rates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('settings.empty.no_tax_rates')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {config.rates.map(r => (
                <div key={r._id} className="flex items-center justify-between border rounded-md px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{r.country}</span>
                      {r.state && r.state !== '*' && <span className="text-muted-foreground text-sm">/ {r.state}</span>}
                      <Badge variant="secondary" className="text-[10px]">{(r.rate * 100).toFixed(2)}%</Badge>
                      {r.productClass && <Badge variant="outline" className="text-[10px]">{r.productClass}</Badge>}
                    </div>
                    {r.name && <p className="text-xs text-muted-foreground mt-0.5">{r.name}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t('settings.dialog.edit_tax_rate') : t('settings.dialog.new_tax_rate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.field.tax.country.label')}</Label>
                <CountryPicker
                  value={form.country}
                  onChange={v => setForm(f => ({ ...f, country: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.field.tax.state.label')}</Label>
                <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} placeholder={t('settings.field.tax.state.placeholder')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.tax.rate.label')}</Label>
              <Input type="number" step="0.001" min="0" max="100" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder={t('settings.field.tax.rate.placeholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.tax.display_name.label')}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('settings.field.tax.display_name.placeholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.tax.product_class.label')}</Label>
              <Input value={form.productClass} onChange={e => setForm(f => ({ ...f, productClass: e.target.value }))} placeholder={t('settings.field.tax.product_class.placeholder')} />
              <p className="text-xs text-muted-foreground">{t('settings.field.tax.product_class.help')}</p>
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
