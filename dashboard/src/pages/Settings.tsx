/**
 * Store settings — tabbed configuration page covering everything that lives
 * on the tenant `settings` document and that the merchant edits at the
 * store level (rather than per-product or per-order).
 *
 * Tabs:
 *   General        — store name + description, branding (logo, favicon)
 *   Regional       — currency, timezone, language
 *   Shipping       — provider type + zone CRUD against /store-settings/shipping/zones
 *   Tax            — flags + per-rate CRUD against /store-settings/tax/rates
 *   Currencies     — base + FX rates table against /store-settings/currencies
 *   Notifications  — per-status email templates against /store-settings/notifications
 *
 * Granular tab CRUD targets the per-row endpoints so two admins editing
 * different tabs at the same time don't clobber each other. The "General"
 * and "Regional" tabs still go through the bulk PUT because they're a
 * single round-trip.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import {
  useNotificationPreferences,
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationType,
} from '../hooks/useNotificationPreferences';
import {
  Bell as BellIcon, Package as PackageIcon, CreditCard as CreditCardIcon,
  RotateCcw as RotateCcwIcon, Users as UsersIcon, Globe as GlobeIcon,
  Webhook as WebhookIcon, Box as BoxIcon, AlertTriangle as AlertTriangleIcon,
} from 'lucide-react';
import { setTenantCurrency, setTenantLocale } from '../lib/format';
import { useLanguage } from '../i18n/LanguageProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { ImageUpload } from '../components/ui/image-upload';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { FilterPills } from '../components/ui/filter-pills';
import { CurrencyPicker, TimezonePicker, LanguagePicker, CountryPicker } from '../components/ui/pickers';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Save, Loader2, Store, Globe2, Truck, Receipt, Plus, Pencil, Trash2,
  Coins, Mail, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../components/ui/use-confirm';

// ---------------- Shared types ----------------

// Thrown errors from api-client are opaque (could be the server's JSON
// error body, a plain string message, or anything else). Narrow through
// a tiny helper so we don't have to spray `any` across catch blocks.
const errorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

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

interface NotificationTemplate {
  enabled?: boolean;
  subject?: string | null;
  body?: string | null;
}

interface NotificationConfig {
  fromName?: string | null;
  fromEmail?: string | null;
  templates: Record<string, NotificationTemplate>;
}

interface CurrencyConfig {
  base: string;
  rates: Record<string, number>;
  ratesUpdatedAt?: string;
}

const NOTIFICATION_STATUSES = [
  'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded',
] as const;

// ---------------- Main page ----------------

type SettingsTab = 'general' | 'regional' | 'shipping' | 'tax' | 'currencies' | 'markets' | 'notifications' | 'email-templates';

const VALID_TABS: SettingsTab[] = ['general', 'regional', 'shipping', 'tax', 'currencies', 'markets', 'notifications', 'email-templates'];

export const Settings: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const { setLang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as SettingsTab | null;
  const initialTab: SettingsTab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'general';
  const [tab, setTabState] = useState<SettingsTab>(initialTab);
  const setTab = (next: SettingsTab) => {
    setTabState(next);
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };
  useEffect(() => {
    if (urlTab && VALID_TABS.includes(urlTab) && urlTab !== tab) {
      setTabState(urlTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);
  const [general, setGeneral] = useState({
    storeName: '', storeDescription: '', logo: '', favicon: '',
    currency: 'SDG', timezone: 'Africa/Khartoum', language: 'en',
  });
  const [shippingType, setShippingType] = useState<'flat' | 'weight' | 'zone' | 'free'>('zone');
  const [flatRate, setFlatRate] = useState(0);

  // loadGeneral is stable (reads from setters only, no captured props/state)
  // — running once on mount is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadGeneral(); }, []);

  const loadGeneral = async () => {
    try {
      setLoading(true);
      const res = await api.domains.getInfo() as {
        data?: { settings?: Record<string, unknown> & { shipping?: { type?: typeof shippingType; rate?: number } } };
        responseObject?: { data?: { settings?: Record<string, unknown> & { shipping?: { type?: typeof shippingType; rate?: number } } } };
      };
      const data = res?.data || res?.responseObject?.data;
      const s = data?.settings;
      if (s) {
        setGeneral({
          storeName: (s.storeName as string) || '',
          storeDescription: (s.storeDescription as string) || '',
          logo: (s.logo as string) || '',
          favicon: (s.favicon as string) || '',
          currency: (s.currency as string) || 'SDG',
          timezone: (s.timezone as string) || 'Africa/Khartoum',
          language: (s.language as string) || 'en',
        });
        setShippingType(s.shipping?.type || 'zone');
        setFlatRate(s.shipping?.rate || 0);
        if (s.currency) setTenantCurrency(s.currency as string);
        if (s.language) setTenantLocale(s.language === 'ar' ? 'ar-SD' : 'en-US');
      }
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.settings_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await api.settings.update(general);
      setTenantCurrency(general.currency);
      setTenantLocale(general.language === 'ar' ? 'ar-SD' : 'en-US');
      setLang(general.language === 'ar' ? 'ar' : 'en');
      toast.success(t('settings.toast.settings_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.settings_save_failed')));
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveShippingMode = async () => {
    try {
      await api.settings.update({
        shipping: { type: shippingType, rate: flatRate },
      });
      toast.success(t('settings.toast.shipping_mode_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.shipping_mode_save_failed')));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <FilterPills<SettingsTab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'general', label: t('settings.tab.general.label'), icon: Store },
          { id: 'regional', label: t('settings.tab.regional.label'), icon: Globe2 },
          { id: 'shipping', label: t('settings.tab.shipping.label'), icon: Truck },
          { id: 'tax', label: t('settings.tab.tax.label'), icon: Receipt },
          { id: 'currencies', label: t('settings.tab.currencies.label'), icon: Coins },
          { id: 'markets', label: t('settings.tab.markets.label'), icon: Globe2 },
          { id: 'notifications', label: t('settings.tab.notifications.label'), icon: BellIcon },
          { id: 'email-templates', label: t('settings.tab.email_templates.label'), icon: Mail },
        ]}
      />

      <div className="mt-6">
        {/* General */}
        {tab === 'general' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings.section.store_info.title')}</CardTitle>
              <CardDescription>{t('settings.section.store_info.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.field.store.name.label')}</Label>
                <Input
                  placeholder={t('settings.field.store.name.placeholder')}
                  value={general.storeName}
                  onChange={e => setGeneral(g => ({ ...g, storeName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.field.store.description.label')}</Label>
                <Input
                  placeholder={t('settings.field.store.description.placeholder')}
                  value={general.storeDescription}
                  onChange={e => setGeneral(g => ({ ...g, storeDescription: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings.section.branding.title')}</CardTitle>
              <CardDescription>{t('settings.section.branding.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ImageUpload
                value={general.logo}
                onChange={v => setGeneral(g => ({ ...g, logo: v as string }))}
                multiple={false} maxSizeMB={2} label={t('settings.field.branding.logo.label')}
                description={t('settings.field.branding.logo.description')}
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
              />
              <Separator />
              <ImageUpload
                value={general.favicon}
                onChange={v => setGeneral(g => ({ ...g, favicon: v as string }))}
                multiple={false} maxSizeMB={1} label={t('settings.field.branding.favicon.label')}
                description={t('settings.field.branding.favicon.description')}
                accept="image/png,image/x-icon"
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveGeneral} disabled={savingGeneral}>
              {savingGeneral
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Save className="mr-2 h-4 w-4" />}
              {savingGeneral ? t('settings.button.saving') : t('settings.button.save_changes')}
            </Button>
          </div>
        </div>
        )}

        {/* Regional */}
        {tab === 'regional' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings.section.regional.title')}</CardTitle>
              <CardDescription>{t('settings.section.regional.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t('settings.field.regional.currency.label')}</Label>
                  <CurrencyPicker
                    value={general.currency}
                    onChange={v => setGeneral(g => ({ ...g, currency: v }))}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.field.regional.currency.help')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.field.regional.timezone.label')}</Label>
                  <TimezonePicker
                    value={general.timezone}
                    onChange={v => setGeneral(g => ({ ...g, timezone: v }))}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.field.regional.timezone.help')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.field.regional.language.label')}</Label>
                  <LanguagePicker
                    value={general.language}
                    onChange={v => setGeneral(g => ({ ...g, language: v }))}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.field.regional.language.help')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSaveGeneral} disabled={savingGeneral}>
              {savingGeneral ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {savingGeneral ? t('settings.button.saving') : t('settings.button.save_changes')}
            </Button>
          </div>
        </div>
        )}

        {/* Shipping */}
        {tab === 'shipping' && (
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
                    className={`rounded-lg border p-4 text-left transition ${
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
                <Button onClick={handleSaveShippingMode}>{t('settings.button.save_shipping_mode')}</Button>
              </div>
            </CardContent>
          </Card>

          <ShippingZonesPanel disabled={shippingType !== 'zone'} />
        </div>
        )}

        {/* Tax */}
        {tab === 'tax' && (
        <div className="space-y-6">
          <TaxPanel />
        </div>
        )}

        {/* Currencies */}
        {tab === 'currencies' && (
        <div className="space-y-6">
          <CurrenciesPanel />
        </div>
        )}

        {/* Markets (geographic price targeting — source of truth for checkout presentment) */}
        {tab === 'markets' && (
        <div className="space-y-6">
          <MarketsPanel />
        </div>
        )}

        {/* Notifications (in-app/sound/browser/email prefs) */}
        {tab === 'notifications' && (
        <div className="space-y-6">
          <NotificationPreferencesPanel />
        </div>
        )}

        {/* Order status email templates */}
        {tab === 'email-templates' && (
        <div className="space-y-6">
          <NotificationsPanel />
        </div>
        )}
      </div>
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
          <Plus className="h-4 w-4 mr-2" />{t('settings.button.add_zone')}
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

// ---------------- Tax panel ----------------

const TaxPanel: React.FC = () => {
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
            <Plus className="h-4 w-4 mr-2" />{t('settings.button.add_rate')}
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
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId ? t('common:action.update') : t('common:action.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const FlagRow: React.FC<{
  label: string; description: string; checked: boolean;
  onCheckedChange: (v: boolean) => void; disabled?: boolean;
}> = ({ label, description, checked, onCheckedChange, disabled }) => (
  <div className="flex items-start justify-between gap-4 border rounded-md p-3">
    <div className="min-w-0">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

// ---------------- Currencies panel ----------------

const CurrenciesPanel: React.FC = () => {
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
              <Plus className="h-3.5 w-3.5 mr-1" />{t('settings.button.add_currency')}
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
                      placeholder="Currency"
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
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t('settings.button.save_currencies')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------- Markets panel ----------------
//
// Source of truth for geographic price targeting at checkout. Persisted
// under `tenant.settings.markets` and consumed by services/markets.js
// and services/checkout.js::priceCheckout. Currency per market must be
// present in the Currencies FX table for presentment conversion to
// succeed — the form flags a missing rate inline.

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

const MarketsPanel: React.FC = () => {
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('settings.section.markets.title')}</CardTitle>
            <CardDescription>
              {t('settings.section.markets.description')}
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />{t('settings.button.add_market')}
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
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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
                  <Plus className="h-3.5 w-3.5 mr-1" />{t('settings.button.add_country')}
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

            <div className="grid grid-cols-2 gap-4 pt-2">
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
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId ? t('common:action.update') : t('common:action.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ---------------- Notifications panel ----------------

const NotificationsPanel: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const [config, setConfig] = useState<NotificationConfig>({ fromName: '', fromEmail: '', templates: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStatus, setActiveStatus] = useState<typeof NOTIFICATION_STATUSES[number]>('Pending');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.settings.getNotifications() as { data?: Partial<NotificationConfig> };
      const data = res.data || { fromName: '', fromEmail: '', templates: {} };
      setConfig({ fromName: data.fromName || '', fromEmail: data.fromEmail || '', templates: data.templates || {} });
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.notifications_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: {
        fromName: string | null;
        fromEmail: string | null;
        templates: Record<string, NotificationTemplate>;
      } = {
        fromName: config.fromName || null,
        fromEmail: config.fromEmail || null,
        templates: config.templates,
      };
      await api.settings.updateNotifications(payload);
      toast.success(t('settings.toast.email_templates_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.notifications_save_failed')));
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (status: string, patch: Partial<NotificationTemplate>) => {
    setConfig(c => ({
      ...c,
      templates: {
        ...c.templates,
        [status]: { ...(c.templates[status] || { enabled: true }), ...patch },
      },
    }));
  };

  if (loading) return <Skeleton className="h-96" />;

  const tpl = config.templates[activeStatus] || { enabled: true, subject: '', body: '' };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.sender.title')}</CardTitle>
          <CardDescription>{t('settings.section.sender.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.field.notifications.from_name.label')}</Label>
              <Input value={config.fromName || ''} onChange={e => setConfig(c => ({ ...c, fromName: e.target.value }))} placeholder={t('settings.field.notifications.from_name.placeholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.notifications.from_email.label')}</Label>
              <Input type="email" value={config.fromEmail || ''} onChange={e => setConfig(c => ({ ...c, fromEmail: e.target.value }))} placeholder={t('settings.field.notifications.from_email.placeholder')} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.status_templates.title')}</CardTitle>
          <CardDescription>
            {t('settings.section.status_templates.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {NOTIFICATION_STATUSES.map(s => {
              const isActive = activeStatus === s;
              const isEnabled = config.templates[s]?.enabled !== false;
              return (
                <button
                  key={s}
                  onClick={() => setActiveStatus(s)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {s}
                  {!isEnabled && <span className="ml-1 text-[10px] opacity-70">{t('settings.email_template.off_badge')}</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 border rounded-md p-4">
            <FlagRow
              label={t('settings.email_template.send_this_email.label')}
              description={t('settings.email_template.send_this_email.description', { status: activeStatus })}
              checked={tpl.enabled !== false}
              onCheckedChange={v => updateTemplate(activeStatus, { enabled: v })}
            />
            <div className="space-y-2">
              <Label>{t('settings.field.notifications.subject.label')}</Label>
              <Input
                value={tpl.subject || ''}
                onChange={e => updateTemplate(activeStatus, { subject: e.target.value })}
                placeholder={t('settings.email_template.subject_placeholder', { orderNumber: '{{orderNumber}}', status: activeStatus.toLowerCase() })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.notifications.body.label')}</Label>
              <Textarea
                rows={10}
                value={tpl.body || ''}
                onChange={e => updateTemplate(activeStatus, { body: e.target.value })}
                placeholder={t('settings.email_template.body_placeholder', { customerName: '{{customerName}}', orderNumber: '{{orderNumber}}', status: activeStatus.toLowerCase() })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {t('settings.button.save_notifications')}
        </Button>
      </div>
    </>
  );
};

// ---------------- Notification preferences panel ----------------

interface NotificationTypeMeta {
  label: string;
  description: string;
  icon: React.ElementType;
}

const NOTIFICATION_TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  'order.created': PackageIcon,
  'payment.manual_submitted': CreditCardIcon,
  'payment.failed': AlertTriangleIcon,
  'stock.low': BoxIcon,
  'refund.created': RotateCcwIcon,
  'return.requested': RotateCcwIcon,
  'webhook.failed': WebhookIcon,
  'domain.verification_failed': GlobeIcon,
  'staff.invite_accepted': UsersIcon,
};

const NOTIFICATION_TYPE_KEYS: Record<NotificationType, string> = {
  'order.created': 'order_created',
  'payment.manual_submitted': 'payment_manual_submitted',
  'payment.failed': 'payment_failed',
  'stock.low': 'stock_low',
  'refund.created': 'refund_created',
  'return.requested': 'return_requested',
  'webhook.failed': 'webhook_failed',
  'domain.verification_failed': 'domain_verification_failed',
  'staff.invite_accepted': 'staff_invite_accepted',
};

const NotificationPreferencesPanel: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const { prefs, loading, updatePref } = useNotificationPreferences();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const handleRequestPermission = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission()
      .then((result) => {
        setPermission(result);
      })
      .catch(() => {
        /* ignore */
      });
  };

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.notifications.title')}</CardTitle>
          <CardDescription>
            {t('settings.section.notifications.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {permission === 'default' && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <div className="flex items-start gap-2">
                <BellIcon className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    {t('settings.browser_permission.not_enabled_title')}
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                    {t('settings.browser_permission.not_enabled_body')}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={handleRequestPermission}>
                {t('settings.browser_permission.request_button')}
              </Button>
            </div>
          )}
          {permission === 'denied' && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium">{t('settings.browser_permission.blocked_title')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('settings.browser_permission.blocked_body')}
                </p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_80px_80px_80px] items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <div>{t('settings.notification_channel.event')}</div>
              <div className="text-center">{t('settings.notification_channel.inbox')}</div>
              <div className="text-center">{t('settings.notification_channel.toast')}</div>
              <div className="text-center">{t('settings.notification_channel.sound')}</div>
              <div className="text-center">{t('settings.notification_channel.browser')}</div>
              <div className="text-center">{t('settings.notification_channel.email')}</div>
            </div>
            {NOTIFICATION_TYPES.map((type) => {
              const Icon = NOTIFICATION_TYPE_ICONS[type];
              const typeKey = NOTIFICATION_TYPE_KEYS[type];
              const row =
                prefs[type] ?? {
                  inbox: true,
                  toast: true,
                  sound: true,
                  browser: true,
                  email: false,
                };
              const browserDisabled = permission !== 'granted';
              const renderChannel = (channel: NotificationChannel, disabled: boolean) => (
                <div className="flex items-center justify-center">
                  <Switch
                    checked={!!row[channel]}
                    disabled={disabled}
                    onCheckedChange={(v) => updatePref(type, channel, v)}
                  />
                </div>
              );
              return (
                <div
                  key={type}
                  className="grid grid-cols-[minmax(0,1fr)_80px_80px_80px_80px_80px] items-center gap-2 border-b px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t(`settings.notification_type.${typeKey}.label`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`settings.notification_type.${typeKey}.description`)}</p>
                    </div>
                  </div>
                  {renderChannel('inbox', false)}
                  {renderChannel('toast', false)}
                  {renderChannel('sound', false)}
                  {browserDisabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>{renderChannel('browser', true)}</div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {permission === 'denied'
                          ? t('settings.browser_permission.tooltip_blocked')
                          : t('settings.browser_permission.tooltip_grant')}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    renderChannel('browser', false)
                  )}
                  {renderChannel('email', false)}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.notification_channel_hint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
