/**
 * Shipping tab — provider type (mode) selector + zone CRUD against
 * /store-settings/shipping/zones. Mode state lives in settings/index.tsx
 * because it is loaded/saved alongside the general settings document.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { Truck, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';
import { errorMessage, type ShippingType } from './shared';

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

interface ShippingZonesProps {
  shippingType: ShippingType;
  setShippingType: (v: ShippingType) => void;
  flatRate: number;
  setFlatRate: (v: number) => void;
  onSaveMode: () => void;
}

export const ShippingZones: React.FC<ShippingZonesProps> = ({
  shippingType, setShippingType, flatRate, setFlatRate, onSaveMode,
}) => {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.shipping_mode.title')}</CardTitle>
          <CardDescription>{t('settings.section.shipping_mode.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['flat', 'weight', 'zone', 'free'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setShippingType(mode)}
                className={`rounded-lg border p-4 text-start transition ${
                  shippingType === mode
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <p className="font-semibold capitalize">{t(`settings.shipping_mode.${mode}.label`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(`settings.shipping_mode.${mode}.description`)}
                </p>
              </button>
            ))}
          </div>
          {shippingType === 'flat' && (
            <div className="space-y-2 max-w-xs">
              <Label>{t('settings.field.shipping.flat_rate.label')}</Label>
              <Input
                type="number" step="0.01" min="0"
                value={flatRate}
                onChange={e => setFlatRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={onSaveMode}>{t('settings.button.save_shipping_mode')}</Button>
          </div>
        </CardContent>
      </Card>

      <ShippingZonesPanel disabled={shippingType !== 'zone'} />
    </div>
  );
};

// ---------------- Shipping zones panel ----------------

const ShippingZonesPanel: React.FC<{ disabled: boolean }> = ({ disabled }) => {
  const { t } = useTranslation(['settings', 'common']);
  const navigate = useNavigate();
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.settings.listShippingZones() as { data?: ShippingZone[] };
      setZones(res.data || []);
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.shipping_zones_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => navigate('/dashboard/settings/shipping-zones/new');
  const openEdit = (zone: ShippingZone) => navigate(`/dashboard/settings/shipping-zones/${zone._id}/edit`);

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: t('settings.confirm.delete_shipping_zone.title'),
      description: t('settings.confirm.delete_shipping_zone.description'),
      confirmText: t('settings.confirm.delete_shipping_zone.confirm_text'),
      variant: 'destructive',
    }))) return;
    try {
      await api.settings.deleteShippingZone(id);
      toast.success(t('settings.toast.zone_deleted'));
      setZones(prev => prev.filter(z => z._id !== id));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.zone_delete_failed')));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{t('settings.section.shipping_zones.title')}</CardTitle>
          <CardDescription>
            {t('settings.section.shipping_zones.description')}
          </CardDescription>
        </div>
        <Button onClick={openCreate} disabled={disabled}>
          <Plus className="h-4 w-4 me-2" />{t('settings.button.add_zone')}
        </Button>
      </CardHeader>
      <CardContent>
        {disabled && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-800 dark:text-amber-200 mb-4 flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {t('settings.shipping_zone_mode_warning')}
          </div>
        )}
        {loading ? (
          <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20" />)}</div>
        ) : zones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t('settings.empty.no_shipping_zones')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {zones.map(zone => (
              <div key={zone._id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{zone.name}</h4>
                      <Badge variant="secondary" className="text-[10px]">
                        {zone.rates.length === 1
                          ? t('settings.zone_rates_badge', { count: zone.rates.length })
                          : t('settings.zone_rates_badge_plural', { count: zone.rates.length })}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {zone.countries.map(c => (
                        <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                      ))}
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {zone.rates.map((r, i) => (
                        <li key={i}>
                          <span className="font-medium text-foreground">{r.name}</span>
                          {' — '}${r.price.toFixed(2)}
                          {r.minWeight != null && r.maxWeight != null && (
                            <> ({r.minWeight}–{r.maxWeight}kg)</>
                          )}
                          {r.minWeight != null && r.maxWeight == null && (
                            <> ({r.minWeight}kg+)</>
                          )}
                          {r.estimatedDays && <> · {r.estimatedDays} days</>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(zone)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(zone._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
