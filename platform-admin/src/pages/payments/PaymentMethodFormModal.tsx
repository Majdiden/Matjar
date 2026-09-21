import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Label, Select, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { useToast } from '../../components/ui/toast-context';
import {
  paymentsApi,
  slugify,
  CUSTOMER_FIELD_TYPES,
  type CatalogEntry,
  type CatalogEntryInput,
  type CatalogEntryPatch,
  type CustomerField,
  type PaymentIntegration,
  type ProviderTemplate,
} from '../../lib/api-payments';

interface Props {
  open: boolean;
  onClose: () => void;
  integrations: PaymentIntegration[];
  /** Editing an existing entry; omitted = create. */
  entry?: CatalogEntry | null;
  onSaved: (entry: CatalogEntry) => void;
}

interface FormState {
  integrationKey: string;
  code: string;
  codeTouched: boolean;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  instructions: string;
  instructionsAr: string;
  logo: string;
  icon: string;
  enabled: boolean;
  enabledByDefault: boolean;
  order: string;
  customerFields: CustomerField[];
  providers: ProviderTemplate[];
}

const CODE_RE = /^[a-z0-9][a-z0-9-_]{0,39}$/;
const FIELD_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;

function initialState(entry: CatalogEntry | null | undefined, integrations: PaymentIntegration[]): FormState {
  return {
    integrationKey: entry?.integrationKey ?? integrations[0]?.key ?? '',
    code: entry?.code ?? '',
    codeTouched: !!entry,
    label: entry?.label ?? '',
    labelAr: entry?.labelAr ?? '',
    description: entry?.description ?? '',
    descriptionAr: entry?.descriptionAr ?? '',
    instructions: entry?.instructions ?? '',
    instructionsAr: entry?.instructionsAr ?? '',
    logo: entry?.logo ?? '',
    icon: entry?.icon ?? '',
    enabled: entry?.enabled ?? false,
    enabledByDefault: entry?.enabledByDefault ?? false,
    order: String(entry?.order ?? 0),
    customerFields: entry?.customerFields?.map((f) => ({ ...f })) ?? [],
    providers: entry?.providers?.map((p) => ({ ...p })) ?? [],
  };
}

const emptyField = (): CustomerField => ({ name: '', label: '', labelAr: '', type: 'text', required: false, placeholder: '' });
const emptyProvider = (): ProviderTemplate => ({ code: '', label: '', logo: '' });

export function PaymentMethodFormModal({ open, onClose, integrations, entry, onSaved }: Props) {
  const toast = useToast();
  const isEdit = !!entry;
  const [form, setForm] = useState<FormState>(() => initialState(entry, integrations));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(initialState(entry, integrations));
      setPendingLogo(null);
      setSaving(false);
      setUploading(false);
    }
  }, [open, entry, integrations]);

  const integration = integrations.find((i) => i.key === form.integrationKey) ?? null;
  const showProviders = !!integration?.supportsProviders;
  const showCustomerFields = integration?.type !== 'cod';

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validation = (() => {
    if (!form.integrationKey) return 'Pick an integration.';
    if (!CODE_RE.test(form.code)) return 'Code must be lowercase letters, digits, - or _ (max 40).';
    if (!form.label.trim()) return 'Label is required.';
    if (form.logo && !/^https?:\/\//.test(form.logo)) return 'Logo must be an http(s) URL.';
    const n = Number(form.order);
    if (!Number.isInteger(n) || n < 0 || n > 1000) return 'Order must be a whole number between 0 and 1000.';
    if (showCustomerFields) {
      const names = new Set<string>();
      for (const f of form.customerFields) {
        if (!FIELD_NAME_RE.test(f.name)) return `Customer field name "${f.name || '?'}" must start with a letter (letters, digits, _ only).`;
        if (!f.label.trim()) return `Customer field "${f.name}" needs a label.`;
        if (names.has(f.name)) return `Customer field "${f.name}" is duplicated.`;
        names.add(f.name);
      }
    }
    if (showProviders) {
      const codes = new Set<string>();
      for (const p of form.providers) {
        if (!CODE_RE.test(p.code)) return `Provider code "${p.code || '?'}" must be lowercase letters, digits, - or _.`;
        if (!p.label.trim()) return `Provider "${p.code}" needs a label.`;
        if (codes.has(p.code)) return `Provider "${p.code}" is duplicated.`;
        codes.add(p.code);
      }
    }
    return null;
  })();

  const payload = (): CatalogEntryInput => ({
    code: form.code,
    integrationKey: form.integrationKey,
    label: form.label.trim(),
    labelAr: form.labelAr.trim(),
    description: form.description.trim(),
    descriptionAr: form.descriptionAr.trim(),
    instructions: form.instructions.trim(),
    instructionsAr: form.instructionsAr.trim(),
    logo: form.logo.trim(),
    icon: form.icon.trim(),
    enabled: form.enabled,
    enabledByDefault: form.enabledByDefault,
    order: Number(form.order),
    customerFields: showCustomerFields
      ? form.customerFields.map((f) => ({
          name: f.name,
          label: f.label.trim(),
          labelAr: f.labelAr?.trim() || undefined,
          type: f.type,
          required: !!f.required,
          placeholder: f.placeholder?.trim() || undefined,
          accept: f.accept || undefined,
          maxSize: f.maxSize || undefined,
        }))
      : [],
    providers: showProviders ? form.providers.map((p) => ({ code: p.code, label: p.label.trim(), logo: p.logo?.trim() || undefined })) : [],
  });

  const save = async () => {
    if (validation) {
      toast.error(validation);
      return;
    }
    setSaving(true);
    try {
      let saved: CatalogEntry;
      if (isEdit && entry) {
        const full = payload();
        const patch: CatalogEntryPatch = { ...full };
        delete (patch as Partial<CatalogEntryInput>).code;
        delete (patch as Partial<CatalogEntryInput>).integrationKey;
        saved = await paymentsApi.update(entry._id, patch);
      } else {
        saved = await paymentsApi.create(payload());
      }
      if (pendingLogo) {
        try {
          saved = await paymentsApi.uploadLogo(saved._id, pendingLogo);
        } catch (err) {
          toast.error(`Saved, but the logo upload failed: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }
      toast.success(isEdit ? 'Payment method updated' : 'Payment method created');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onPickLogo = async (file: File | null) => {
    if (!file) return;
    if (!isEdit || !entry) {
      // Upload happens after the entry exists.
      setPendingLogo(file);
      set('logo', '');
      return;
    }
    setUploading(true);
    try {
      const updated = await paymentsApi.uploadLogo(entry._id, file);
      set('logo', updated.logo);
      onSaved(updated);
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updateField = (i: number, patch: Partial<CustomerField>) =>
    set('customerFields', form.customerFields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const updateProvider = (i: number, patch: Partial<ProviderTemplate>) =>
    set('providers', form.providers.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? `Edit — ${entry?.label ?? ''}` : 'New payment method'}
      description={
        isEdit
          ? 'Presentation and availability. Merchants see these texts; changes sync to every store on its next visit to Payments.'
          : 'Pick a code integration, then describe it for merchants and customers. Merchants enable it for their store and add their own details.'
      }
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!!validation && form.label.trim() !== ''} title={validation ?? undefined}>
            {isEdit ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Integration + code */}
        <section className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pm-integration">Integration</Label>
            <Select
              id="pm-integration"
              value={form.integrationKey}
              disabled={isEdit}
              onChange={(e) => {
                const next = integrations.find((i) => i.key === e.target.value);
                setForm((f) => ({
                  ...f,
                  integrationKey: e.target.value,
                  providers: next?.supportsProviders ? f.providers : [],
                  customerFields: next?.type === 'cod' ? [] : f.customerFields,
                }));
              }}
            >
              {integrations.map((i) => (
                <option key={i.key} value={i.key}>{i.label}</option>
              ))}
            </Select>
            {integration && <p className="text-xs text-muted-foreground">{integration.description}</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pm-label">Label</Label>
              <Input
                id="pm-label"
                value={form.label}
                placeholder="e.g. Mobile money"
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, label: v, code: f.codeTouched ? f.code : slugify(v) }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pm-code">Code {isEdit && <span className="text-muted-foreground">(fixed)</span>}</Label>
              <Input
                id="pm-code"
                value={form.code}
                disabled={isEdit}
                dir="ltr"
                className="font-mono"
                placeholder="mobile-money"
                onChange={(e) => setForm((f) => ({ ...f, code: slugify(e.target.value), codeTouched: true }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pm-label-ar">Label (Arabic)</Label>
            <Input id="pm-label-ar" value={form.labelAr} dir="rtl" placeholder="محفظة إلكترونية" onChange={(e) => set('labelAr', e.target.value)} />
          </div>
        </section>

        {/* Texts */}
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pm-desc">Description</Label>
              <Textarea id="pm-desc" rows={3} value={form.description} placeholder="Shown to customers when choosing how to pay." onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pm-desc-ar">Description (Arabic)</Label>
              <Textarea id="pm-desc-ar" rows={3} dir="rtl" value={form.descriptionAr} onChange={(e) => set('descriptionAr', e.target.value)} />
            </div>
          </div>
          {integration?.type !== 'cod' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pm-instr">Checkout instructions</Label>
                <Textarea id="pm-instr" rows={3} value={form.instructions} placeholder="What the customer must do after placing the order." onChange={(e) => set('instructions', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pm-instr-ar">Checkout instructions (Arabic)</Label>
                <Textarea id="pm-instr-ar" rows={3} dir="rtl" value={form.instructionsAr} onChange={(e) => set('instructionsAr', e.target.value)} />
              </div>
            </div>
          )}
        </section>

        {/* Logo + icon + order */}
        <section className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pm-logo">Logo</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {form.logo && <img src={form.logo} alt="" className="h-10 w-10 shrink-0 rounded-md border object-contain bg-white" />}
              <Input id="pm-logo" value={form.logo} dir="ltr" placeholder="https://…/logo.png" onChange={(e) => { set('logo', e.target.value); setPendingLogo(null); }} />
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            </div>
            {pendingLogo && <p className="text-xs text-muted-foreground">“{pendingLogo.name}” will be uploaded after the method is created.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pm-icon">Icon key</Label>
              <Input id="pm-icon" value={form.icon} dir="ltr" placeholder="bank" onChange={(e) => set('icon', e.target.value)} />
              <p className="text-xs text-muted-foreground">Storefront fallback when there is no logo (e.g. cod, bank).</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pm-order">Order</Label>
              <Input id="pm-order" type="number" min={0} max={1000} value={form.order} onChange={(e) => set('order', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span>
                <span className="block font-medium">Offered on the platform</span>
                <span className="block text-xs text-muted-foreground">Off hides it from every storefront.</span>
              </span>
              <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Offered on the platform" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span>
                <span className="block font-medium">On by default for new stores</span>
                <span className="block text-xs text-muted-foreground">Merchants can still switch it off.</span>
              </span>
              <Toggle checked={form.enabledByDefault} onChange={(v) => set('enabledByDefault', v)} label="On by default for new stores" />
            </label>
          </div>
        </section>

        {/* Providers */}
        {showProviders && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Providers</h3>
                <p className="text-xs text-muted-foreground">Banks / wallets the customer can pick. Merchants fill in their own account per provider.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => set('providers', [...form.providers, emptyProvider()])}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {form.providers.length === 0 && <p className="text-xs text-muted-foreground">No providers yet.</p>}
            <div className="space-y-2">
              {form.providers.map((p, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Code</Label>
                    <Input value={p.code} dir="ltr" className="font-mono" placeholder="bankak" onChange={(e) => updateProvider(i, { code: slugify(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input value={p.label} placeholder="Bankak" onChange={(e) => updateProvider(i, { label: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Logo URL or key</Label>
                    <Input value={p.logo ?? ''} dir="ltr" placeholder="https://… or bankak" onChange={(e) => updateProvider(i, { logo: e.target.value })} />
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" title="Remove provider" onClick={() => set('providers', form.providers.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Customer fields */}
        {showCustomerFields && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Customer fields</h3>
                <p className="text-xs text-muted-foreground">What the customer must provide at checkout (transaction number, receipt…).</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => set('customerFields', [...form.customerFields, emptyField()])}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {form.customerFields.length === 0 && <p className="text-xs text-muted-foreground">No customer fields — the customer just picks the method.</p>}
            <div className="space-y-2">
              {form.customerFields.map((f, i) => (
                <div key={i} className="space-y-2 rounded-md border p-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr]">
                    <div className="space-y-1">
                      <Label className="text-xs">Name (key)</Label>
                      <Input value={f.name} dir="ltr" className="font-mono" placeholder="transactionNumber" onChange={(e) => updateField(i, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input value={f.label} placeholder="Transaction number" onChange={(e) => updateField(i, { label: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label (Arabic)</Label>
                      <Input value={f.labelAr ?? ''} dir="rtl" onChange={(e) => updateField(i, { labelAr: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as CustomerField['type'] })}>
                        {CUSTOMER_FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Placeholder</Label>
                      <Input value={f.placeholder ?? ''} placeholder="e.g. TXN-8827463" onChange={(e) => updateField(i, { placeholder: e.target.value })} />
                    </div>
                    <label className="flex h-9 items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={!!f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                      Required
                    </label>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" title="Remove field" onClick={() => set('customerFields', form.customerFields.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {validation && form.label.trim() !== '' && (
          <p className="text-xs text-destructive">{validation}</p>
        )}
      </div>
    </Modal>
  );
}
