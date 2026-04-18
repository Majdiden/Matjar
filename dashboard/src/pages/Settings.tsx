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
      toast.error(errorMessage(err, 'Failed to load settings'));
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
      toast.success('Settings saved');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save settings'));
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveShippingMode = async () => {
    try {
      await api.settings.update({
        shipping: { type: shippingType, rate: flatRate },
      });
      toast.success('Shipping mode saved');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save shipping mode'));
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
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your store configuration</p>
      </div>

      <FilterPills<SettingsTab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'general', label: 'General', icon: Store },
          { id: 'regional', label: 'Regional', icon: Globe2 },
          { id: 'shipping', label: 'Shipping', icon: Truck },
          { id: 'tax', label: 'Tax', icon: Receipt },
          { id: 'currencies', label: 'Currencies', icon: Coins },
          { id: 'markets', label: 'Markets', icon: Globe2 },
          { id: 'notifications', label: 'Notifications', icon: BellIcon },
          { id: 'email-templates', label: 'Order emails', icon: Mail },
        ]}
      />

      <div className="mt-6">
        {/* General */}
        {tab === 'general' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Store Information</CardTitle>
              <CardDescription>Basic details about your store</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Store Name</Label>
                <Input
                  placeholder="My Awesome Store"
                  value={general.storeName}
                  onChange={e => setGeneral(g => ({ ...g, storeName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Store Description</Label>
                <Input
                  placeholder="A brief description of your store"
                  value={general.storeDescription}
                  onChange={e => setGeneral(g => ({ ...g, storeDescription: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Branding</CardTitle>
              <CardDescription>Upload your store logo and favicon</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ImageUpload
                value={general.logo}
                onChange={v => setGeneral(g => ({ ...g, logo: v as string }))}
                multiple={false} maxSizeMB={2} label="Store Logo"
                description="Recommended: 500x500px, transparent PNG"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
              />
              <Separator />
              <ImageUpload
                value={general.favicon}
                onChange={v => setGeneral(g => ({ ...g, favicon: v as string }))}
                multiple={false} maxSizeMB={1} label="Favicon"
                description="Recommended: 64x64px, PNG or ICO"
                accept="image/png,image/x-icon"
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveGeneral} disabled={savingGeneral}>
              {savingGeneral
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Save className="mr-2 h-4 w-4" />}
              {savingGeneral ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
        )}

        {/* Regional */}
        {tab === 'regional' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regional Settings</CardTitle>
              <CardDescription>Configure regional preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <CurrencyPicker
                    value={general.currency}
                    onChange={v => setGeneral(g => ({ ...g, currency: v }))}
                  />
                  <p className="text-xs text-muted-foreground">Store's default display currency</p>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <TimezonePicker
                    value={general.timezone}
                    onChange={v => setGeneral(g => ({ ...g, timezone: v }))}
                  />
                  <p className="text-xs text-muted-foreground">Used for order timestamps & reports</p>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <LanguagePicker
                    value={general.language}
                    onChange={v => setGeneral(g => ({ ...g, language: v }))}
                  />
                  <p className="text-xs text-muted-foreground">Default storefront language</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSaveGeneral} disabled={savingGeneral}>
              {savingGeneral ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </div>
        )}

        {/* Shipping */}
        {tab === 'shipping' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipping Mode</CardTitle>
              <CardDescription>How shipping cost is calculated at checkout</CardDescription>
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
                    <p className="font-semibold capitalize">{mode}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {mode === 'flat' && 'One rate for every order'}
                      {mode === 'weight' && 'Rate per kilogram'}
                      {mode === 'zone' && 'Geographic zones with weight bands'}
                      {mode === 'free' && 'Free shipping for everyone'}
                    </p>
                  </button>
                ))}
              </div>
              {shippingType === 'flat' && (
                <div className="space-y-2 max-w-xs">
                  <Label>Flat shipping rate ($)</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={flatRate}
                    onChange={e => setFlatRate(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleSaveShippingMode}>Save shipping mode</Button>
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
      toast.error(errorMessage(err, 'Failed to load shipping zones'));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => navigate('/dashboard/settings/shipping-zones/new');
  const openEdit = (zone: ShippingZone) => navigate(`/dashboard/settings/shipping-zones/${zone._id}/edit`);

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete shipping zone?',
      description: 'Customers in its countries will fall back to your default rate.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.settings.deleteShippingZone(id);
      toast.success('Zone deleted');
      setZones(prev => prev.filter(z => z._id !== id));
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete zone'));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Shipping Zones</CardTitle>
          <CardDescription>
            Per-region rates with optional weight bands. Used when shipping mode is "Zone".
          </CardDescription>
        </div>
        <Button onClick={openCreate} disabled={disabled}>
          <Plus className="h-4 w-4 mr-2" />Add zone
        </Button>
      </CardHeader>
      <CardContent>
        {disabled && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-800 dark:text-amber-200 mb-4 flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            Switch shipping mode to "Zone" above to use these rates at checkout.
          </div>
        )}
        {loading ? (
          <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20" />)}</div>
        ) : zones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No shipping zones configured yet.</p>
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
                        {zone.rates.length} rate{zone.rates.length === 1 ? '' : 's'}
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
      toast.error(errorMessage(err, 'Failed to load tax settings'));
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
      toast.error(errorMessage(err, 'Failed to save tax flags'));
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
    if (!form.country.trim()) return toast.error('Country is required');
    const ratePct = parseFloat(form.rate);
    if (isNaN(ratePct) || ratePct < 0 || ratePct > 100) return toast.error('Rate must be 0–100%');
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
        toast.success('Tax rate updated');
      } else {
        await api.settings.createTaxRate(payload);
        toast.success('Tax rate created');
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save tax rate'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete tax rate?',
      description: 'Orders matching this rate\'s country/state/class will fall through to the next match.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.settings.deleteTaxRate(id);
      toast.success('Tax rate deleted');
      setConfig(c => ({ ...c, rates: c.rates.filter(r => r._id !== id) }));
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete tax rate'));
    }
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax behaviour</CardTitle>
          <CardDescription>How tax is calculated and shown to customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FlagRow
            label="Charge tax on orders"
            description="When off, all orders are tax-free regardless of rates below."
            checked={config.enabled}
            onCheckedChange={v => saveFlags({ enabled: v })}
            disabled={savingFlags}
          />
          <FlagRow
            label="Prices include tax"
            description="Treat product prices as tax-inclusive (back out tax from the displayed price instead of adding it)."
            checked={config.includeInPrice}
            onCheckedChange={v => saveFlags({ includeInPrice: v })}
            disabled={savingFlags || !config.enabled}
          />
          <FlagRow
            label="Charge tax on shipping"
            description="Apply the matching tax rate to the shipping cost as well as the line items."
            checked={config.taxShipping}
            onCheckedChange={v => saveFlags({ taxShipping: v })}
            disabled={savingFlags || !config.enabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Tax Rates</CardTitle>
            <CardDescription>One row per (country, state) — checkout picks the most specific match.</CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Add rate
          </Button>
        </CardHeader>
        <CardContent>
          {config.rates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No tax rates configured.</p>
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
            <DialogTitle>{editingId ? 'Edit tax rate' : 'New tax rate'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <CountryPicker
                  value={form.country}
                  onChange={v => setForm(f => ({ ...f, country: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>State / Region (optional)</Label>
                <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} placeholder="CA" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rate (%)</Label>
              <Input type="number" step="0.001" min="0" max="100" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="8.875" />
            </div>
            <div className="space-y-2">
              <Label>Display Name (optional)</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="NY State Sales Tax" />
            </div>
            <div className="space-y-2">
              <Label>Product Class (optional)</Label>
              <Input value={form.productClass} onChange={e => setForm(f => ({ ...f, productClass: e.target.value }))} placeholder="standard" />
              <p className="text-xs text-muted-foreground">Restrict this rate to products with a matching tax class.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId ? 'Update' : 'Create'}
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
      toast.error(errorMessage(err, 'Failed to load currencies'));
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
      if (!/^[A-Z]{3}$/.test(code)) return toast.error(`Invalid currency code: ${row.code}`);
      if (isNaN(num) || num <= 0) return toast.error(`Rate for ${code} must be positive`);
      rates[code] = num;
    }
    setSaving(true);
    try {
      const res = await api.settings.updateCurrencies({ base: config.base, rates }) as { data?: CurrencyConfig };
      setConfig(res.data || { base: config.base, rates });
      toast.success('Currency rates saved');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save currencies'));
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
        <CardTitle className="text-base">Currency &amp; FX Rates</CardTitle>
        <CardDescription>
          Base currency plus exchange rates used to convert prices when a market or storefront
          requests a different currency. Rate is in the destination currency per 1 base unit
          (e.g. base USD with EUR=0.92 means $1 = €0.92).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2 max-w-xs">
          <Label>Base Currency</Label>
          <CurrencyPicker
            value={config.base}
            onChange={v => setConfig(c => ({ ...c, base: v }))}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Exchange Rates</Label>
            <Button variant="ghost" size="sm" onClick={addRow}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add currency
            </Button>
          </div>
          {draftRates.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4">No additional currencies yet.</p>
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
                    placeholder="0.92"
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
            Last updated {new Date(config.ratesUpdatedAt).toLocaleString()}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save currencies
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
      toast.error(errorMessage(err, 'Failed to load markets'));
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
    if (!/^[a-z0-9-]{2,32}$/.test(code)) return toast.error('Code must be 2–32 chars, a–z 0–9 -');
    if (!form.name.trim()) return toast.error('Name is required');
    if (!/^[A-Z]{3}$/.test(form.currency)) return toast.error('Currency must be a 3-letter ISO code');
    const countries = form.countries.map(c => c.toUpperCase()).filter(Boolean);
    for (const c of countries) {
      if (!/^[A-Z]{2}$/.test(c)) return toast.error(`Invalid country code: ${c}`);
    }
    const pct = parseFloat(form.priceAdjustmentPct || '0');
    if (isNaN(pct) || pct < -95 || pct > 500) {
      return toast.error('Price adjustment must be between -95% and +500%');
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
        toast.success('Market updated');
      } else {
        await api.settings.createMarketSettings(payload);
        toast.success('Market created');
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save market'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: MarketConfig) => {
    if (!(await confirm({
      title: `Delete market "${m.name}"?`,
      description: 'Customers from its countries will fall through to the default market at checkout.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.settings.deleteMarketSettings(m._id);
      toast.success('Market deleted');
      setMarkets(list => list.filter(x => x._id !== m._id));
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete market'));
    }
  };

  // Markets quote in a currency that isn't the base. Checkout uses the FX
  // table to convert — if there's no rate, presentment silently falls back
  // to the base. Surface the gap so the merchant fixes it in Currencies.
  const missingFxWarning = (currency: string): string | null => {
    if (!currency || currency === baseCurrency) return null;
    if (fxRates[currency] > 0) return null;
    return `No FX rate for ${currency} → ${baseCurrency}. Add one on the Currencies tab or presentment will fall back to ${baseCurrency}.`;
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
            <CardTitle className="text-base">Markets</CardTitle>
            <CardDescription>
              Map groups of countries to a currency, language, and price adjustment.
              Checkout resolves the shipping country to a market to compute presentment pricing.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Add market
          </Button>
        </CardHeader>
        <CardContent>
          {markets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No markets configured. All customers pay in the base currency.</p>
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
                        {m.isDefault && <Badge className="text-[10px]">Default</Badge>}
                        {!m.enabled && <Badge variant="outline" className="text-[10px] text-muted-foreground">Disabled</Badge>}
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
            <DialogTitle>{editingId ? 'Edit market' : 'New market'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="eu"
                />
                <p className="text-xs text-muted-foreground">Lowercase, 2–32 chars. Used in analytics + order records.</p>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="European Union"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
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
                <Label>Language</Label>
                <LanguagePicker
                  value={form.language}
                  onChange={v => setForm(f => ({ ...f, language: v }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Countries</Label>
                <Button variant="ghost" size="sm" onClick={addCountryRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add country
                </Button>
              </div>
              {form.countries.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No countries — this market will only be selected when it's the default.
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
              <Label>Price adjustment (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="-95"
                max="500"
                value={form.priceAdjustmentPct}
                onChange={e => setForm(f => ({ ...f, priceAdjustmentPct: e.target.value }))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Applied to the base price before currency conversion. Positive values mark up (e.g. 10 = +10%);
                negative values discount.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Enabled</p>
                  <p className="text-xs text-muted-foreground">Off: skip at resolve time.</p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))}
                />
              </div>
              <div className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Default</p>
                  <p className="text-xs text-muted-foreground">Fallback when no country matches.</p>
                </div>
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={v => setForm(f => ({ ...f, isDefault: v }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ---------------- Notifications panel ----------------

const NotificationsPanel: React.FC = () => {
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
      toast.error(errorMessage(err, 'Failed to load notifications'));
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
      toast.success('Email templates saved');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save notifications'));
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
          <CardTitle className="text-base">Sender</CardTitle>
          <CardDescription>From name and email address used for transactional order emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input value={config.fromName || ''} onChange={e => setConfig(c => ({ ...c, fromName: e.target.value }))} placeholder="Acme Coffee" />
            </div>
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input type="email" value={config.fromEmail || ''} onChange={e => setConfig(c => ({ ...c, fromEmail: e.target.value }))} placeholder="orders@acme.test" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Templates</CardTitle>
          <CardDescription>
            Customize the email sent when an order moves to each status. Leave a template empty
            to fall back to the built-in default. You can use the placeholders{' '}
            <code className="bg-muted px-1 rounded text-[11px]">{'{{orderNumber}}'}</code>,{' '}
            <code className="bg-muted px-1 rounded text-[11px]">{'{{customerName}}'}</code>, and{' '}
            <code className="bg-muted px-1 rounded text-[11px]">{'{{totalAmount}}'}</code>.
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
                  {!isEnabled && <span className="ml-1 text-[10px] opacity-70">(off)</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 border rounded-md p-4">
            <FlagRow
              label="Send this email"
              description={`Sent automatically when an order transitions to "${activeStatus}".`}
              checked={tpl.enabled !== false}
              onCheckedChange={v => updateTemplate(activeStatus, { enabled: v })}
            />
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={tpl.subject || ''}
                onChange={e => updateTemplate(activeStatus, { subject: e.target.value })}
                placeholder={`Your order {{orderNumber}} is ${activeStatus.toLowerCase()}`}
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                rows={10}
                value={tpl.body || ''}
                onChange={e => updateTemplate(activeStatus, { body: e.target.value })}
                placeholder={`Hi {{customerName}},\n\nYour order {{orderNumber}} is now ${activeStatus.toLowerCase()}.\n\nThanks for shopping with us!`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save notifications
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

const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  'order.created': {
    label: 'New orders',
    description: 'Fires when a customer places a new order.',
    icon: PackageIcon,
  },
  'payment.manual_submitted': {
    label: 'Manual payment submitted',
    description: 'A customer submitted proof for a manual / bank transfer payment.',
    icon: CreditCardIcon,
  },
  'payment.failed': {
    label: 'Payment failed',
    description: 'A payment attempt (capture, charge, etc.) failed.',
    icon: AlertTriangleIcon,
  },
  'stock.low': {
    label: 'Low stock',
    description: 'A product dropped below its low-stock threshold.',
    icon: BoxIcon,
  },
  'refund.created': {
    label: 'Refund created',
    description: 'A refund was issued against an order.',
    icon: RotateCcwIcon,
  },
  'return.requested': {
    label: 'Return requested',
    description: 'A customer requested a return on an order.',
    icon: RotateCcwIcon,
  },
  'webhook.failed': {
    label: 'Webhook failed',
    description: 'An outbound webhook to an external service failed repeatedly.',
    icon: WebhookIcon,
  },
  'domain.verification_failed': {
    label: 'Domain verification failed',
    description: 'Custom domain DNS or SSL verification failed.',
    icon: GlobeIcon,
  },
  'staff.invite_accepted': {
    label: 'Staff invite accepted',
    description: 'A staff member accepted their invitation.',
    icon: UsersIcon,
  },
};

const NotificationPreferencesPanel: React.FC = () => {
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
          <CardTitle className="text-base">Notification preferences</CardTitle>
          <CardDescription>
            Choose how you want to be alerted for each type of event. Changes save automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {permission === 'default' && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <div className="flex items-start gap-2">
                <BellIcon className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Browser notifications are not enabled
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                    Grant permission so Matjar can show OS-level alerts when this tab is not focused.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={handleRequestPermission}>
                Request permission
              </Button>
            </div>
          )}
          {permission === 'denied' && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium">Browser notifications are blocked</p>
                <p className="text-xs text-muted-foreground">
                  Enable notifications for this site in your browser settings to receive OS-level alerts.
                </p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_80px_80px_80px] items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Event</div>
              <div className="text-center">Inbox</div>
              <div className="text-center">Toast</div>
              <div className="text-center">Sound</div>
              <div className="text-center">Browser</div>
              <div className="text-center">Email</div>
            </div>
            {NOTIFICATION_TYPES.map((type) => {
              const meta = NOTIFICATION_TYPE_META[type];
              const row =
                prefs[type] ?? {
                  inbox: true,
                  toast: true,
                  sound: true,
                  browser: true,
                  email: false,
                };
              const Icon = meta.icon;
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
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
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
                          ? 'Browser notifications are blocked in your browser settings.'
                          : 'Grant browser permission above to enable this channel.'}
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
            The sound channel plays a short chime when a matching notification arrives. The browser
            channel shows a native OS notification even when the dashboard tab is not focused.
            The email channel delivers a plain-text message to your account email with a deep-link
            back to the relevant record.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
