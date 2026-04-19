import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import { MapPin, Plus, Pencil, Trash2, Globe2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface Market {
  _id: string;
  name: string;
  countries: string[];
  currency: string;
  priceAdjustment?: number;
  taxBehavior?: string;
  catalogMode?: string;
  isActive?: boolean;
  createdAt: string;
}

export const Markets: React.FC = () => {
  const { t } = useTranslation(['marketing', 'common']);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [form, setForm] = useState({ name: '', countries: '', currency: 'SDG', priceAdjustment: 0 });
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  useEffect(() => { loadMarkets(); }, []);

  const loadMarkets = async () => {
    try {
      setLoading(true);
      const res = (await api.markets.getAll()) as {
        responseObject?: { markets?: Market[] } | Market[];
        data?: { markets?: Market[] };
      };
      const ro = res.responseObject;
      const list: Market[] = Array.isArray(ro)
        ? ro
        : ro?.markets || res.data?.markets || [];
      setMarkets(list);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('marketing.market.toast.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingMarket(null);
    setForm({ name: '', countries: '', currency: 'SDG', priceAdjustment: 0 });
    setDialogOpen(true);
  };

  const openEdit = (market: Market) => {
    setEditingMarket(market);
    setForm({
      name: market.name,
      countries: market.countries.join(', '),
      currency: market.currency,
      priceAdjustment: market.priceAdjustment || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.countries) {
      toast.error(t('marketing.market.form.validation.name_countries_required'));
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name,
        countries: form.countries.split(',').map(c => c.trim()).filter(Boolean),
        currency: form.currency,
        priceAdjustment: Number(form.priceAdjustment) || 0,
      };
      if (editingMarket) {
        await api.markets.update(editingMarket._id, data);
        toast.success(t('marketing.market.toast.updated'));
      } else {
        await api.markets.create(data);
        toast.success(t('marketing.market.toast.created'));
      }
      setDialogOpen(false);
      loadMarkets();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('marketing.market.toast.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: t('marketing.market.delete_dialog.title'),
      description: t('marketing.market.delete_dialog.description'),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await api.markets.delete(id);
      toast.success(t('marketing.market.toast.deleted'));
      setMarkets(prev => prev.filter(m => m._id !== id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('marketing.market.toast.delete_failed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('marketing.market.list.title')}</h1>
          <p className="text-muted-foreground">{t('marketing.market.list.subtitle')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('marketing.market.list.add_button')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMarket ? t('marketing.market.form.edit_title') : t('marketing.market.form.create_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('marketing.market.form.field.name.label')}</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('marketing.market.form.field.name.placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('marketing.market.form.field.countries.label')}</Label>
                <Input value={form.countries} onChange={e => setForm(f => ({ ...f, countries: e.target.value }))} placeholder={t('marketing.market.form.field.countries.placeholder')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('marketing.market.form.field.currency.label')}</Label>
                  <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder={t('marketing.market.form.field.currency.placeholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('marketing.market.form.field.price_adjustment.label')}</Label>
                  <Input type="number" value={form.priceAdjustment} onChange={e => setForm(f => ({ ...f, priceAdjustment: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common:action.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? t('marketing.market.form.saving_button')
                  : editingMarket
                    ? t('marketing.market.form.update_button')
                    : t('marketing.market.form.create_button')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : markets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t('marketing.market.list.empty_title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('marketing.market.list.empty_subtitle')}</p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('marketing.market.list.create_first_button')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {markets.map(market => (
            <Card key={market._id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{market.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(market)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(market._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {market.countries.map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('marketing.market.list.card.currency_label')}</span>
                  <span className="font-medium">{market.currency}</span>
                </div>
                {market.priceAdjustment !== 0 && market.priceAdjustment != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('marketing.market.list.card.price_adjustment_label')}</span>
                    <span className="font-medium">{market.priceAdjustment > 0 ? '+' : ''}{market.priceAdjustment}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
