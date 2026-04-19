import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { CountryPicker } from '../components/ui/pickers';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../lib/api-client';
import { toast } from 'sonner';

interface ShippingZone {
  _id: string;
  name: string;
  countries: string[];
  rates: Array<{
    _id?: string;
    name: string;
    price: number;
    minWeight?: number;
    maxWeight?: number | null;
    estimatedDays?: string;
  }>;
}

const EMPTY_RATE = { name: '', price: 0, minWeight: 0, maxWeight: null as number | null, estimatedDays: '' };

const ShippingZoneForm: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const sz = (key: string, opts?: Record<string, unknown>) => t(`settings.shipping_zone.${key}`, opts);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    countries: string[];
    rates: Array<typeof EMPTY_RATE>;
  }>({
    name: '',
    countries: [],
    rates: [{ ...EMPTY_RATE }],
  });

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setLoading(true);
        const res = (await api.settings.listShippingZones()) as { data?: ShippingZone[] };
        const list: ShippingZone[] = res.data || [];
        const zone = list.find((z) => z._id === id);
        if (!zone) {
          toast.error(sz('toast.not_found'));
          navigate('/dashboard/settings');
          return;
        }
        setForm({
          name: zone.name,
          countries: zone.countries,
          rates: zone.rates.map((r) => ({
            name: r.name,
            price: r.price,
            minWeight: r.minWeight ?? 0,
            maxWeight: r.maxWeight ?? null,
            estimatedDays: r.estimatedDays ?? '',
          })),
        });
      } catch (err) {
        const e = err as { message?: string };
        toast.error(e?.message || sz('toast.load_failed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, navigate]);

  const addCountry = (code: string) => {
    const upper = code.toUpperCase();
    if (!upper || form.countries.includes(upper)) return;
    setForm((f) => ({ ...f, countries: [...f.countries, upper] }));
  };
  const removeCountry = (code: string) =>
    setForm((f) => ({ ...f, countries: f.countries.filter((c) => c !== code) }));

  const addRate = () => setForm((f) => ({ ...f, rates: [...f.rates, { ...EMPTY_RATE }] }));
  const removeRate = (i: number) => setForm((f) => ({ ...f, rates: f.rates.filter((_, j) => j !== i) }));
  const updateRate = (i: number, patch: Partial<typeof EMPTY_RATE>) =>
    setForm((f) => ({ ...f, rates: f.rates.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error(sz('validation.name_required'));
    if (form.countries.length === 0) return toast.error(sz('validation.country_required'));
    if (form.rates.length === 0) return toast.error(sz('validation.rate_required'));
    for (const r of form.rates) {
      if (!r.name.trim()) return toast.error(sz('validation.rate_name_required'));
      if (r.price < 0) return toast.error(sz('validation.rate_price_negative'));
    }
    const payload = {
      name: form.name.trim(),
      countries: form.countries,
      rates: form.rates.map((r) => ({
        name: r.name.trim(),
        price: Number(r.price),
        minWeight: r.minWeight === null || r.minWeight === undefined ? undefined : Number(r.minWeight),
        maxWeight: r.maxWeight === null || (r.maxWeight as unknown as string) === '' ? null : Number(r.maxWeight),
        estimatedDays: r.estimatedDays || undefined,
      })),
    };
    setSaving(true);
    try {
      if (isEdit && id) {
        await api.settings.updateShippingZone(id, payload);
        toast.success(sz('toast.updated'));
      } else {
        await api.settings.createShippingZone(payload);
        toast.success(sz('toast.created'));
      }
      navigate('/dashboard/settings?tab=shipping');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || sz('toast.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/settings?tab=shipping')}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isEdit ? sz('page_title_edit') : sz('page_title_new')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {sz('subtitle')}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
          {isEdit ? sz('button.update') : sz('button.create')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{sz('section.details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{sz('field.zone_name')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={sz('field.zone_name_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{sz('field.countries')}</Label>
                <CountryPicker value="" onChange={addCountry} placeholder={sz('field.countries_placeholder')} />
                {form.countries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.countries.map((code) => (
                      <Badge key={code} variant="secondary" className="gap-1 pe-1">
                        {code}
                        <button
                          type="button"
                          onClick={() => removeCountry(code)}
                          className="ms-0.5 rounded-sm hover:bg-background/60 p-0.5"
                          aria-label={`Remove ${code}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {sz('field.countries_hint')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{sz('section.rates')}</CardTitle>
              <Button variant="outline" size="sm" onClick={addRate}>
                <Plus className="h-3.5 w-3.5 me-1" />{sz('add_rate')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.rates.map((rate, i) => (
                <div key={i} className="border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {sz('rate_n', { n: i + 1 })}
                    </span>
                    {form.rates.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRate(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{sz('field.rate_name')}</Label>
                      <Input value={rate.name} onChange={(e) => updateRate(i, { name: e.target.value })} placeholder={sz('field.rate_name_placeholder')} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{sz('field.rate_price')}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rate.price}
                        onChange={(e) => updateRate(i, { price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{sz('field.rate_min_weight')}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={rate.minWeight}
                        onChange={(e) => updateRate(i, { minWeight: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{sz('field.rate_max_weight')}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={rate.maxWeight ?? ''}
                        onChange={(e) => updateRate(i, { maxWeight: e.target.value === '' ? null : parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">{sz('field.estimated_days')}</Label>
                      <Input
                        value={rate.estimatedDays}
                        onChange={(e) => updateRate(i, { estimatedDays: e.target.value })}
                        placeholder={sz('field.estimated_days_placeholder')}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base">{sz('section.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">{sz('summary.name')}</div>
                <div className="font-medium">{form.name || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{sz('summary.countries')}</div>
                <div className="font-medium">{form.countries.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{sz('summary.rates')}</div>
                <div className="font-medium">{form.rates.length}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ShippingZoneForm;
