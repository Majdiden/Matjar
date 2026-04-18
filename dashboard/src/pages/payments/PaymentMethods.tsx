import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  Wallet, Plus, Loader2, Package, CreditCard, Info, Check, CircleAlert, Building2, Trash2, Upload, X,
} from 'lucide-react';

// Soft-launch: merchants can only add manual-transfer providers. The
// automated gateway catalog is parked platform-wide — see STRIPE_ENABLED
// in config/index.js. The chooser UI + catalog fetch have been removed;
// re-add them when gateway integrations ship.
import { api } from '../../lib/api-client';
import { toast } from 'sonner';

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

interface PaymentMethod {
  _id: string;
  code: string;
  type: 'gateway' | 'manual' | 'cod';
  label: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  order: number;
  instructions?: string;
  providers?: ManualProvider[];
}

const SYSTEM_PROVIDER_CODES = new Set(['bankak', 'fawry', 'ocash', 'bravo', 'cashi']);

interface ApiErrorLike {
  message?: string;
  response?: { data?: { message?: string } };
}

// Loose api-client envelopes we narrow locally.
interface PaymentMethodsResponse {
  data?: { methods?: PaymentMethod[] };
  responseObject?: { methods?: PaymentMethod[] };
}

interface UploadResponse {
  data?: { url?: string };
  responseObject?: { url?: string };
  url?: string;
}

function getError(e: unknown): string {
  const err = e as ApiErrorLike | undefined;
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---- Provider edit dialog ----
interface ProviderDialogState {
  open: boolean;
  methodId: string | null;
  provider: ManualProvider | null;
  isNew: boolean;
}

const emptyProvider = (): ManualProvider => ({
  code: '',
  label: '',
  logo: '',
  enabled: true,
  accountNumber: '',
  beneficiaryName: '',
  phone: '',
  instructions: '',
});

export const PaymentMethods: React.FC = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});

  const [instructionDrafts, setInstructionDrafts] = useState<Record<string, string>>({});

  // Add-method chooser
  const [chooserOpen, setChooserOpen] = useState(false);

  // Provider edit dialog
  const [providerDialog, setProviderDialog] = useState<ProviderDialogState>({
    open: false, methodId: null, provider: null, isNew: false,
  });
  const [providerDraft, setProviderDraft] = useState<ManualProvider>(emptyProvider());
  const [providerSaving, setProviderSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  async function handleLogoUpload(file: File) {
    try {
      setLogoUploading(true);
      const res = await api.upload.providerLogo(file) as UploadResponse;
      const url = res?.data?.url || res?.responseObject?.url || res?.url;
      if (!url) throw new Error('Upload did not return a URL');
      setProviderDraft(d => ({ ...d, logo: url }));
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get('/payment-methods') as PaymentMethodsResponse;
      const list = res?.data?.methods || res?.responseObject?.methods || [];
      const arr: PaymentMethod[] = Array.isArray(list) ? list : [];
      setMethods(arr);
      const ins: Record<string, string> = {};
      arr.forEach(m => { ins[m._id] = m.instructions || ''; });
      setInstructionDrafts(ins);
    } catch (e) {
      toast.error(getError(e));
    } finally {
      setLoading(false);
    }
  }

  async function toggleMethodEnabled(m: PaymentMethod) {
    try {
      setSavingMap(s => ({ ...s, [m._id]: true }));
      await api.patch(`/payment-methods/${m._id}`, { enabled: !m.enabled });
      toast.success(`${m.label} ${!m.enabled ? 'enabled' : 'disabled'}`);
      setMethods(ms => ms.map(x => x._id === m._id ? { ...x, enabled: !m.enabled } : x));
    } catch (e) {
      toast.error(getError(e));
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
      toast.error(`${target.label}: add account number or phone before enabling.`);
      return;
    }
    try {
      setSavingMap(s => ({ ...s, [m._id]: true }));
      await api.patch(`/payment-methods/${m._id}`, { providers });
      setMethods(ms => ms.map(x => x._id === m._id ? { ...x, providers } : x));
    } catch (e) {
      toast.error(getError(e));
    } finally {
      setSavingMap(s => ({ ...s, [m._id]: false }));
    }
  }

  async function saveInstructions(m: PaymentMethod) {
    try {
      setSavingMap(s => ({ ...s, [m._id]: true }));
      await api.patch(`/payment-methods/${m._id}`, {
        instructions: instructionDrafts[m._id] ?? '',
      });
      toast.success('Saved');
      setMethods(ms => ms.map(x => x._id === m._id ? { ...x, instructions: instructionDrafts[m._id] ?? '' } : x));
    } catch (e) {
      toast.error(getError(e));
    } finally {
      setSavingMap(s => ({ ...s, [m._id]: false }));
    }
  }

  function openProvider(m: PaymentMethod, p: ManualProvider) {
    setProviderDialog({ open: true, methodId: m._id, provider: p, isNew: false });
    setProviderDraft({ ...p });
  }

  function openNewProvider(m: PaymentMethod) {
    setProviderDialog({ open: true, methodId: m._id, provider: null, isNew: true });
    setProviderDraft(emptyProvider());
  }

  function closeProvider() {
    setProviderDialog({ open: false, methodId: null, provider: null, isNew: false });
  }

  async function saveProvider() {
    const m = methods.find(x => x._id === providerDialog.methodId);
    if (!m) return;
    const d = providerDraft;
    if (!d.label?.trim()) { toast.error('Label is required'); return; }
    if (providerDialog.isNew) {
      const code = slugify(d.code || d.label);
      if (!code) { toast.error('Invalid name'); return; }
      if ((m.providers || []).some(p => p.code === code)) {
        toast.error('A provider with that name already exists.');
        return;
      }
      d.code = code;
    }
    if (d.enabled && !d.accountNumber?.trim() && !d.phone?.trim()) {
      toast.error('Add account number or phone before enabling.');
      return;
    }

    const next: ManualProvider[] = providerDialog.isNew
      ? [...(m.providers || []), d]
      : (m.providers || []).map(p => p.code === d.code ? d : p);

    try {
      setProviderSaving(true);
      await api.patch(`/payment-methods/${m._id}`, { providers: next });
      toast.success(providerDialog.isNew ? 'Provider added' : 'Provider updated');
      closeProvider();
      await load();
    } catch (e) {
      toast.error(getError(e));
    } finally {
      setProviderSaving(false);
    }
  }

  async function removeProvider() {
    const m = methods.find(x => x._id === providerDialog.methodId);
    if (!m || !providerDialog.provider) return;
    const code = providerDialog.provider.code;
    if (SYSTEM_PROVIDER_CODES.has(code)) {
      toast.error('System providers cannot be removed — disable instead.');
      return;
    }
    const next = (m.providers || []).filter(p => p.code !== code);
    try {
      setProviderSaving(true);
      await api.patch(`/payment-methods/${m._id}`, { providers: next });
      toast.success('Provider removed');
      closeProvider();
      await load();
    } catch (e) {
      toast.error(getError(e));
    } finally {
      setProviderSaving(false);
    }
  }

  function openChooser() {
    // Gateway integrations are parked for soft launch — skip the
    // chooser dialog (which would show a single "Manual transfer"
    // tile) and go straight to the manual-provider flow.
    chooseManual();
  }

  function chooseManual() {
    setChooserOpen(false);
    const manualMethod = methods.find(m => m.type === 'manual');
    if (!manualMethod) {
      toast.error('Manual Transfer is not installed.');
      return;
    }
    openNewProvider(manualMethod);
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Methods</h1>
          <p className="text-muted-foreground">
            Enable how customers pay at checkout.
          </p>
        </div>
        <Button onClick={openChooser}>
          <Plus className="h-4 w-4 mr-2" /> Add payment method
        </Button>
      </div>

      {methods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No payment methods configured.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {methods.map(m => (
            <Card key={m._id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                    {m.type === 'manual' ? <Wallet className="h-5 w-5" /> : m.type === 'cod' ? <Package className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {m.label}
                      <Badge variant="outline" className="font-mono text-[10px]">{m.code}</Badge>
                    </CardTitle>
                    {m.description && (
                      <CardDescription className="mt-1">{m.description}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {m.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Switch
                    checked={!!m.enabled}
                    onCheckedChange={() => toggleMethodEnabled(m)}
                    disabled={savingMap[m._id]}
                  />
                </div>
              </CardHeader>

              {m.type === 'manual' && (
                <CardContent className="space-y-4 border-t pt-4">
                  <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Tap a provider to fill your receiving account. Enabled providers are shown to customers at checkout.
                    </span>
                  </div>

                  <div>
                    <Label>Instructions for customer</Label>
                    <div className="flex gap-2 mt-1">
                      <Textarea
                        rows={2}
                        className="flex-1"
                        value={instructionDrafts[m._id] ?? ''}
                        onChange={e => setInstructionDrafts(s => ({ ...s, [m._id]: e.target.value }))}
                        placeholder="Shown under the provider details on checkout."
                      />
                      <Button
                        variant="outline"
                        onClick={() => saveInstructions(m)}
                        disabled={savingMap[m._id] || (instructionDrafts[m._id] ?? '') === (m.instructions ?? '')}
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Providers</Label>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {(m.providers || []).map(p => {
                        const configured = !!(p.accountNumber || p.phone);
                        const isSystem = SYSTEM_PROVIDER_CODES.has(p.code);
                        return (
                          <button
                            type="button"
                            key={p.code}
                            onClick={() => openProvider(m, p)}
                            className="group relative text-left rounded-lg border p-3 bg-background cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-primary hover:bg-muted/40"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-md border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                                    {(p.label || p.code || '?').slice(0, 1)}
                                  </span>
                                  {p.logo && /^(https?:|\/)/.test(p.logo) && (
                                    <img
                                      src={p.logo}
                                      alt=""
                                      className="absolute inset-0 w-full h-full object-contain p-0.5 bg-background"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  )}
                                </div>
                                <div className="font-medium text-sm truncate">{p.label}</div>
                              </div>
                              <Switch
                                checked={!!p.enabled}
                                onClick={(e) => e.stopPropagation()}
                                onCheckedChange={() => toggleProviderEnabled(m, p.code)}
                              />
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {p.enabled ? (
                                configured ? (
                                  <Badge variant="secondary" className="gap-1 text-[10px]">
                                    <Check className="h-3 w-3" /> Configured
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="gap-1 text-[10px]">
                                    <CircleAlert className="h-3 w-3" /> Missing info
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="text-[10px]">Off</Badge>
                              )}
                              {!isSystem && (
                                <Badge variant="outline" className="text-[10px]">Custom</Badge>
                              )}
                            </div>
                            {configured && (
                              <div className="mt-2 text-[11px] font-mono text-muted-foreground truncate">
                                {p.accountNumber || p.phone}
                              </div>
                            )}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => openNewProvider(m)}
                        className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-muted-foreground hover:bg-muted/40 transition"
                      >
                        <Plus className="h-5 w-5" />
                        <span className="text-xs font-medium">Add provider</span>
                      </button>
                    </div>
                  </div>
                </CardContent>
              )}

              {m.type === 'cod' && (
                <CardContent className="border-t pt-4">
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Customers pay when the order is delivered. No further configuration required.</span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add-method chooser */}
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add payment method</DialogTitle>
            <DialogDescription>
              Choose how your customer will pay.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <button
              onClick={chooseManual}
              className="flex items-start gap-3 rounded-lg border p-4 text-left hover:bg-muted/40 transition"
            >
              <Building2 className="h-6 w-6 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Manual transfer provider</div>
                <div className="text-xs text-muted-foreground">
                  Add a bank or mobile-money option — customers see your account details at checkout and upload a receipt.
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Provider edit dialog */}
      <Dialog open={providerDialog.open} onOpenChange={(o) => !o && closeProvider()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {providerDialog.isNew ? 'Add provider' : `Edit ${providerDialog.provider?.label || 'provider'}`}
            </DialogTitle>
            <DialogDescription>
              {providerDialog.isNew
                ? 'Add a manual-transfer option customers can pay through.'
                : 'Update your receiving account details for this provider.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {providerDialog.isNew && (
              <div>
                <Label>Provider name *</Label>
                <Input
                  value={providerDraft.label}
                  onChange={e => setProviderDraft(d => ({ ...d, label: e.target.value }))}
                  placeholder="e.g. Bank of Khartoum"
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Icon</Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-16 h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                  {providerDraft.logo && /^(https?:|\/)/.test(providerDraft.logo) ? (
                    <img
                      src={providerDraft.logo}
                      alt=""
                      className="w-full h-full object-contain p-1"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (providerDraft.label || providerDraft.code) ? (
                    <span className="text-2xl font-semibold text-muted-foreground uppercase">
                      {(providerDraft.label || providerDraft.code || '?').slice(0, 1)}
                    </span>
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLogoUpload(f);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                  >
                    {logoUploading ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Uploading…</>
                    ) : (
                      <><Upload className="h-3.5 w-3.5 mr-2" />{providerDraft.logo ? 'Replace' : 'Upload'}</>
                    )}
                  </Button>
                  {providerDraft.logo && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setProviderDraft(d => ({ ...d, logo: '' }))}
                      disabled={logoUploading}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />Remove
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Shown to customers at checkout and in product trust badges. PNG/SVG with transparent background recommended.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Beneficiary name</Label>
                <Input
                  value={providerDraft.beneficiaryName || ''}
                  onChange={e => setProviderDraft(d => ({ ...d, beneficiaryName: e.target.value }))}
                  placeholder="Account holder"
                />
              </div>
              <div>
                <Label className="text-xs">Account number</Label>
                <Input
                  value={providerDraft.accountNumber || ''}
                  onChange={e => setProviderDraft(d => ({ ...d, accountNumber: e.target.value }))}
                  placeholder="e.g. 1234-5678"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={providerDraft.phone || ''}
                onChange={e => setProviderDraft(d => ({ ...d, phone: e.target.value }))}
                placeholder="e.g. +249..."
              />
            </div>
            <div>
              <Label className="text-xs">Notes for customer (optional)</Label>
              <Input
                value={providerDraft.instructions || ''}
                onChange={e => setProviderDraft(d => ({ ...d, instructions: e.target.value }))}
                placeholder="e.g. Reference the order number in the transfer note."
              />
            </div>
            <label className="flex items-center gap-2 pt-1">
              <Switch
                checked={!!providerDraft.enabled}
                onCheckedChange={v => setProviderDraft(d => ({ ...d, enabled: !!v }))}
              />
              <span className="text-sm">Enabled — show to customers at checkout</span>
            </label>
          </div>
          <DialogFooter className="sm:justify-between">
            <div>
              {!providerDialog.isNew && providerDialog.provider && !SYSTEM_PROVIDER_CODES.has(providerDialog.provider.code) && (
                <Button variant="ghost" className="text-destructive" onClick={removeProvider} disabled={providerSaving}>
                  <Trash2 className="h-4 w-4 mr-2" /> Remove
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeProvider} disabled={providerSaving}>Cancel</Button>
              <Button onClick={saveProvider} disabled={providerSaving}>
                {providerSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethods;
