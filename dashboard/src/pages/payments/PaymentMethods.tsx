import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Skeleton } from '../../components/ui/skeleton';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import { Wallet, Loader2, Package, CreditCard, Info, CircleAlert, Ban } from 'lucide-react';

// Payment methods are PLATFORM-OWNED. The platform defines which methods
// exist and how they look (label, description, instructions, logo,
// providers); the merchant only switches a method on, fills in their own
// receiving details per provider, and — for gateway methods — the
// integration credentials the platform asks for (`merchantFields`).
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useSetBreadcrumbs } from '../../contexts/breadcrumb-context';

interface ManualProvider {
  code: string;
  label: string;
  logo?: string;
  enabled: boolean;
  accountNumber?: string;
  beneficiaryName?: string;
  phone?: string;
  instructions?: string;
}

interface MerchantField {
  name: string;
  label: string;
  type?: string;
  secret?: boolean;
  required?: boolean;
}

interface PaymentMethod {
  _id: string;
  code: string;
  type: 'gateway' | 'manual' | 'cod';
  label: string;
  description?: string;
  instructions?: string;
  icon?: string;
  logo?: string;
  enabled: boolean;
  platformEnabled?: boolean;
  order: number;
  providers?: ManualProvider[];
  merchantFields?: MerchantField[];
  config?: Record<string, unknown>;
}

interface ApiErrorLike {
  message?: string;
  response?: { data?: { message?: string; code?: string } };
}

// Loose api-client envelopes we narrow locally.
interface PaymentMethodsResponse {
  data?: { methods?: PaymentMethod[] };
  responseObject?: { methods?: PaymentMethod[] };
}

function getError(e: unknown, t: (key: string) => string): string {
  const err = e as ApiErrorLike | undefined;
  if (err?.response?.data?.code === 'PLATFORM_DISABLED') return t('payments:method.platform.not_offered');
  return err?.response?.data?.message || err?.message || t('common:toast.generic_error');
}

const isUrl = (s?: string) => !!s && /^(https?:|\/)/.test(s);

// ---- Provider details dialog ----
interface ProviderDialogState {
  open: boolean;
  methodId: string | null;
  provider: ManualProvider | null;
}

export const PaymentMethods: React.FC = () => {
  const { t } = useTranslation(['payments', 'common', 'nav']);

  // The layout's path-based breadcrumb fallback would render the raw
  // "#methods..." fragment for this route (audit 3.9.3) — override it
  // with the localized trail.
  useSetBreadcrumbs([
    { label: t('nav:sidebar.payments.payments'), href: '/dashboard/payments' },
    { label: t('nav:sidebar.payments.payment_methods') },
  ]);

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});

  // Merchant credential drafts per method (gateway integrations).
  const [configDrafts, setConfigDrafts] = useState<Record<string, Record<string, string>>>({});

  // Provider details dialog
  const [providerDialog, setProviderDialog] = useState<ProviderDialogState>({
    open: false, methodId: null, provider: null,
  });
  const [providerDraft, setProviderDraft] = useState<ManualProvider | null>(null);
  const [providerSaving, setProviderSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get('/payment-methods') as PaymentMethodsResponse;
      const list = res?.data?.methods || res?.responseObject?.methods || [];
      const arr: PaymentMethod[] = Array.isArray(list) ? list : [];
      setMethods(arr);
      const drafts: Record<string, Record<string, string>> = {};
      arr.forEach(m => {
        if (m.merchantFields?.length) {
          const d: Record<string, string> = {};
          m.merchantFields.forEach(f => { d[f.name] = String(m.config?.[f.name] ?? ''); });
          drafts[m._id] = d;
        }
      });
      setConfigDrafts(drafts);
    } catch (e) {
      toast.error(getError(e, t));
    } finally {
      setLoading(false);
    }
  }

  async function toggleMethodEnabled(m: PaymentMethod) {
    try {
      setSavingMap(s => ({ ...s, [m._id]: true }));
      await api.patch(`/payment-methods/${m._id}`, { enabled: !m.enabled });
      toast.success(
        !m.enabled
          ? t('payments:method.toast.enabled', { label: m.label })
          : t('payments:method.toast.disabled', { label: m.label })
      );
      setMethods(ms => ms.map(x => x._id === m._id ? { ...x, enabled: !m.enabled } : x));
    } catch (e) {
      toast.error(getError(e, t));
    } finally {
      setSavingMap(s => ({ ...s, [m._id]: false }));
    }
  }

  async function toggleProviderEnabled(m: PaymentMethod, code: string) {
    const providers = (m.providers || []).map(p =>
      p.code === code ? { ...p, enabled: !p.enabled } : p
    );
    const target = providers.find(p => p.code === code);
    if (target?.enabled && !target.accountNumber?.trim() && !target.phone?.trim()) {
      toast.error(t('payments:method.toast.missing_account_error', { label: target.label }));
      return;
    }
    try {
      setSavingMap(s => ({ ...s, [m._id]: true }));
      await api.patch(`/payment-methods/${m._id}`, { providers });
      setMethods(ms => ms.map(x => x._id === m._id ? { ...x, providers } : x));
    } catch (e) {
      toast.error(getError(e, t));
    } finally {
      setSavingMap(s => ({ ...s, [m._id]: false }));
    }
  }

  async function saveConfig(m: PaymentMethod) {
    const draft = configDrafts[m._id] || {};
    const missing = (m.merchantFields || []).find(f => f.required && !String(draft[f.name] ?? '').trim());
    if (missing) {
      toast.error(t('payments:method.details.required_error', { label: missing.label }));
      return;
    }
    try {
      setSavingMap(s => ({ ...s, [m._id]: true }));
      await api.patch(`/payment-methods/${m._id}`, { config: draft });
      toast.success(t('payments:method.toast.saved'));
      await load();
    } catch (e) {
      toast.error(getError(e, t));
    } finally {
      setSavingMap(s => ({ ...s, [m._id]: false }));
    }
  }

  function openProvider(m: PaymentMethod, p: ManualProvider) {
    setProviderDialog({ open: true, methodId: m._id, provider: p });
    setProviderDraft({ ...p });
  }

  function closeProvider() {
    setProviderDialog({ open: false, methodId: null, provider: null });
    setProviderDraft(null);
  }

  async function saveProvider() {
    const m = methods.find(x => x._id === providerDialog.methodId);
    const d = providerDraft;
    if (!m || !d) return;
    if (d.enabled && !d.accountNumber?.trim() && !d.phone?.trim()) {
      toast.error(t('payments:method.toast.enable_before_save'));
      return;
    }
    // Only merchant-owned fields travel; the provider set is the platform's.
    const next = (m.providers || []).map(p => p.code === d.code
      ? { code: d.code, enabled: d.enabled, accountNumber: d.accountNumber, beneficiaryName: d.beneficiaryName, phone: d.phone, instructions: d.instructions }
      : { code: p.code, enabled: p.enabled, accountNumber: p.accountNumber, beneficiaryName: p.beneficiaryName, phone: p.phone, instructions: p.instructions });
    try {
      setProviderSaving(true);
      await api.patch(`/payment-methods/${m._id}`, { providers: next });
      toast.success(t('payments:method.toast.provider_updated'));
      closeProvider();
      await load();
    } catch (e) {
      toast.error(getError(e, t));
    } finally {
      setProviderSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const renderIcon = (m: PaymentMethod) => {
    if (isUrl(m.logo)) {
      return (
        <img
          src={m.logo}
          alt=""
          className="h-full w-full object-contain p-1"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }
    if (m.type === 'manual') return <Wallet className="h-5 w-5" />;
    if (m.type === 'cod') return <Package className="h-5 w-5" />;
    return <CreditCard className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('payments:method.list.title')}</h1>
        <p className="text-muted-foreground">{t('payments:method.list.description')}</p>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t('payments:method.platform.intro')}</span>
      </div>

      {methods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t('payments:method.list.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {methods.map(m => {
            const withdrawn = m.platformEnabled === false;
            const fields = m.merchantFields || [];
            return (
              <Card key={m._id} className={withdrawn ? 'opacity-80' : undefined}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {renderIcon(m)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{m.label}</CardTitle>
                        {withdrawn && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Ban className="h-3 w-3" /> {t('payments:method.platform.not_offered_badge')}
                          </Badge>
                        )}
                      </div>
                      {m.description && (
                        <CardDescription className="mt-1">{m.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={!!m.enabled && !withdrawn}
                    onCheckedChange={() => toggleMethodEnabled(m)}
                    disabled={savingMap[m._id] || withdrawn}
                    aria-label={m.enabled ? t('payments:method.status.enabled') : t('payments:method.status.disabled')}
                  />
                </CardHeader>

                {withdrawn && (
                  <CardContent className="border-t pt-4">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{t('payments:method.platform.not_offered')}</span>
                    </div>
                  </CardContent>
                )}

                {!withdrawn && m.type === 'manual' && (
                  <CardContent className="space-y-4 border-t pt-4">
                    <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{t('payments:method.type.manual_info')}</span>
                    </div>

                    {m.instructions && (
                      <div>
                        <Label>{t('payments:method.instructions.label')}</Label>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{m.instructions}</p>
                      </div>
                    )}

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label>{t('payments:method.provider.label')}</Label>
                      </div>
                      {(m.providers || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('payments:method.provider.none')}</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                          {(m.providers || []).map(p => {
                            const configured = !!(p.accountNumber || p.phone);
                            return (
                              <button
                                type="button"
                                key={p.code}
                                onClick={() => openProvider(m, p)}
                                className="group relative cursor-pointer rounded-lg border bg-background p-3 text-start transition-all duration-150 hover:-translate-y-0.5 hover:border-primary hover:bg-muted/40 hover:shadow-md"
                              >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                                        {(p.label || p.code || '?').slice(0, 1)}
                                      </span>
                                      {isUrl(p.logo) && (
                                        <img
                                          src={p.logo}
                                          alt=""
                                          className="absolute inset-0 h-full w-full bg-background object-contain p-0.5"
                                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      )}
                                    </div>
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      {/* green = live, red = enabled but unconfigured, muted = off */}
                                      <span
                                        aria-hidden="true"
                                        className={`h-2 w-2 shrink-0 rounded-full ${
                                          p.enabled
                                            ? configured ? 'bg-emerald-500' : 'bg-red-500'
                                            : 'bg-muted-foreground/30'
                                        }`}
                                      />
                                      <span className="sr-only">
                                        {p.enabled
                                          ? configured
                                            ? t('payments:method.provider.configured_badge')
                                            : t('payments:method.provider.missing_badge')
                                          : t('payments:method.status.disabled')}
                                      </span>
                                      <div className="truncate text-sm font-medium">{p.label}</div>
                                    </div>
                                  </div>
                                  <Switch
                                    checked={!!p.enabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleProviderEnabled(m, p.code)}
                                  />
                                </div>
                                {p.enabled && !configured && (
                                  <Badge variant="destructive" className="gap-1 text-[10px]">
                                    <CircleAlert className="h-3 w-3" /> {t('payments:method.provider.missing_badge')}
                                  </Badge>
                                )}
                                {configured && (
                                  <div className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                                    {p.accountNumber || p.phone}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}

                {!withdrawn && m.type === 'cod' && (
                  <CardContent className="border-t pt-4">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{t('payments:method.type.cod_info')}</span>
                    </div>
                  </CardContent>
                )}

                {!withdrawn && fields.length > 0 && (
                  <CardContent className="space-y-3 border-t pt-4">
                    <div>
                      <Label>{t('payments:method.details.title')}</Label>
                      <p className="text-xs text-muted-foreground">{t('payments:method.details.help')}</p>
                    </div>
                    {m.instructions && m.type !== 'manual' && (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{m.instructions}</p>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {fields.map(f => {
                        const value = configDrafts[m._id]?.[f.name] ?? '';
                        const secret = f.secret || f.type === 'password';
                        const saved = secret && value === '__set__';
                        return (
                          <div key={f.name}>
                            <Label className="text-xs">
                              {f.label}{f.required ? ' *' : ''}
                            </Label>
                            <Input
                              type={secret ? 'password' : f.type === 'number' ? 'number' : 'text'}
                              value={saved ? '' : value}
                              placeholder={saved ? t('payments:method.details.secret_saved') : ''}
                              autoComplete="off"
                              onChange={e => setConfigDrafts(s => ({ ...s, [m._id]: { ...(s[m._id] || {}), [f.name]: e.target.value } }))}
                              onFocus={() => {
                                // Typing replaces the stored secret; leaving it blank keeps it.
                                if (saved) setConfigDrafts(s => ({ ...s, [m._id]: { ...(s[m._id] || {}), [f.name]: '__set__' } }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => saveConfig(m)} disabled={savingMap[m._id]}>
                        {savingMap[m._id] ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{t('common:state.saving')}</> : t('common:action.save')}
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Provider details dialog */}
      <Dialog open={providerDialog.open} onOpenChange={(o) => !o && closeProvider()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('payments:method.form.title_edit', { name: providerDialog.provider?.label || '' })}
            </DialogTitle>
            <DialogDescription>{t('payments:method.form.desc_edit')}</DialogDescription>
          </DialogHeader>
          {providerDraft && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {isUrl(providerDraft.logo) ? (
                    <img
                      src={providerDraft.logo}
                      alt=""
                      className="h-full w-full object-contain p-1"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-xl font-semibold uppercase text-muted-foreground">
                      {(providerDraft.label || providerDraft.code || '?').slice(0, 1)}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{providerDraft.label}</div>
                  <div className="text-xs text-muted-foreground">{t('payments:method.form.platform_provider')}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">{t('payments:method.form.field.beneficiary_name.label')}</Label>
                  <Input
                    value={providerDraft.beneficiaryName || ''}
                    onChange={e => setProviderDraft(d => d && ({ ...d, beneficiaryName: e.target.value }))}
                    placeholder={t('payments:method.form.field.beneficiary_name.placeholder')}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('payments:method.form.field.account_number.label')}</Label>
                  <Input
                    value={providerDraft.accountNumber || ''}
                    onChange={e => setProviderDraft(d => d && ({ ...d, accountNumber: e.target.value }))}
                    placeholder={t('payments:method.form.field.account_number.placeholder')}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('payments:method.form.field.phone.label')}</Label>
                <Input
                  value={providerDraft.phone || ''}
                  onChange={e => setProviderDraft(d => d && ({ ...d, phone: e.target.value }))}
                  placeholder={t('payments:method.form.field.phone.placeholder')}
                />
              </div>
              <div>
                <Label className="text-xs">{t('payments:method.form.field.notes.label')}</Label>
                <Input
                  value={providerDraft.instructions || ''}
                  onChange={e => setProviderDraft(d => d && ({ ...d, instructions: e.target.value }))}
                  placeholder={t('payments:method.form.field.notes.placeholder')}
                />
              </div>
              <label className="flex items-center gap-2 pt-1">
                <Switch
                  checked={!!providerDraft.enabled}
                  onCheckedChange={v => setProviderDraft(d => d && ({ ...d, enabled: !!v }))}
                />
                <span className="text-sm">{t('payments:method.form.field.enabled.label')}</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeProvider} disabled={providerSaving}>{t('common:action.cancel')}</Button>
            <Button onClick={saveProvider} disabled={providerSaving}>
              {providerSaving ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{t('common:state.saving')}</> : t('common:action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethods;
