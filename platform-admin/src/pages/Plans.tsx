import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, hasScope, PLATFORM_SCOPES, type FeatureFlagDef } from '../lib/api';
import {
  billingApi,
  formatAmount,
  planPriceSummary,
  FAMILY_LABEL,
  type CommissionPolicy,
  type Plan,
  type PlanFamily,
  type PlanInput,
  type PlanLimits,
} from '../lib/api-billing';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/Button';
import { Input, Label, Textarea, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Toggle } from '../components/ui/Toggle';
import { DataList, type DataListColumn } from '../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../components/ui/Spinner';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ui/toast-context';
import { Field, TierTable } from './billing/shared';
import { RefreshCw, Plus, Pencil, Trash2, Percent, CreditCard, Layers } from 'lucide-react';

const FAMILIES: PlanFamily[] = ['commission', 'subscription', 'hybrid'];
const FAMILY_ICON: Record<PlanFamily, React.ElementType> = { commission: Percent, subscription: CreditCard, hybrid: Layers };
const LIMIT_FIELDS: { key: keyof PlanLimits; label: string }[] = [
  { key: 'maxProducts', label: 'Products' },
  { key: 'maxStaff', label: 'Staff' },
  { key: 'maxOrdersPerMonth', label: 'Orders / month' },
  { key: 'maxStorageMB', label: 'Storage (MB)' },
  { key: 'maxApiRequestsPerDay', label: 'API req / day' },
];

const fmtLimit = (v?: number | null) => (v == null ? '∞' : v.toLocaleString());

export default function Plans() {
  const toast = useToast();
  const { user } = useAuth();
  // Plan writes are still gated on tenant.lifecycle server-side (routes/platformAdmin.js);
  // policies live under billing.write. Mirror both — the server enforces.
  const canWrite = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);
  const canReadBilling = hasScope(user, PLATFORM_SCOPES.BILLING_READ);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [policies, setPolicies] = useState<CommissionPolicy[]>([]);
  const [registry, setRegistry] = useState<FeatureFlagDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, pol, feat] = await Promise.all([
        billingApi.plans.list(),
        billingApi.policies.list(),
        api.features.get().then((r) => r.registry).catch(() => []),
      ]);
      setPlans(p);
      setPolicies(pol);
      setRegistry(feat);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (canReadBilling) load(); else setLoading(false); }, [load, canReadBilling]);

  const grouped = useMemo(
    () => FAMILIES.map((f) => ({ family: f, plans: plans.filter((p) => (p.family ?? 'subscription') === f) })).filter((g) => g.plans.length > 0),
    [plans]
  );

  const toggleActive = async (p: Plan, next: boolean) => {
    setToggling(p._id);
    try {
      await billingApi.plans.update(p._id, { isActive: next });
      setPlans((list) => list.map((x) => (x._id === p._id ? { ...x, isActive: next } : x)));
      toast.success(next ? 'Plan activated' : 'Plan deactivated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setToggling(null);
    }
  };

  const columns: DataListColumn<Plan>[] = [
    {
      id: 'plan', header: 'Plan', primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{p.name}</span>
            <code className="text-xs text-muted-foreground">{p.key}</code>
          </div>
          {p.description && <div className="max-w-xs truncate text-xs font-normal text-muted-foreground">{p.description}</div>}
        </div>
      ),
    },
    { id: 'price', header: 'Pricing', className: 'text-sm', cell: (p) => <span>{planPriceSummary(p, policies)}</span> },
    {
      id: 'trial', header: 'Trial', className: 'text-xs',
      cell: (p) => (p.family === 'commission' ? '—' : p.pricing?.trialDays ? `${p.pricing.trialDays} days (once)` : 'none'),
    },
    {
      id: 'limits', header: 'Limits', className: 'text-xs text-muted-foreground', fullWidthOnMobile: true,
      cell: (p) => (
        <span className="text-xs text-muted-foreground">
          {fmtLimit(p.limits?.maxProducts)} products · {fmtLimit(p.limits?.maxStaff)} staff · {fmtLimit(p.limits?.maxOrdersPerMonth)} orders/mo
        </span>
      ),
    },
    {
      id: 'tenants', header: 'Stores', className: 'text-xs tabular-nums',
      cell: (p) => (p.tenantCount == null ? '—' : p.tenantCount.toLocaleString()),
    },
    {
      id: 'entitlements', header: 'Entitlements', className: 'text-xs',
      cell: (p) => <span className="text-xs text-muted-foreground">{p.entitlements?.length ? `${p.entitlements.length} feature(s)` : '—'}</span>,
    },
    {
      id: 'switching', header: 'Switching', className: 'text-xs',
      cell: (p) => (
        <span className="text-xs text-muted-foreground">
          {p.switching?.allowSelfService === false ? 'Operator only' : 'Self-service'}
          {p.switching?.minimumTermDays ? ` · min ${p.switching.minimumTermDays}d` : ''}
        </span>
      ),
    },
    {
      id: 'status', header: 'Active',
      cell: (p) => canWrite
        ? <Toggle checked={p.isActive} disabled={toggling === p._id} onChange={(v) => toggleActive(p, v)} label={`${p.name} active`} />
        : (p.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>),
    },
    ...(canWrite
      ? [{
          id: 'actions', align: 'end' as const,
          cell: (p: Plan) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          ),
        } satisfies DataListColumn<Plan>]
      : []),
  ];

  if (!canReadBilling) {
    return <ErrorState error="You need the billing.read scope to view plans." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Two families merchants choose between: <strong>Commission</strong> (a percentage of delivered sales, no fee) and{' '}
            <strong>Subscription</strong> (a fixed fee, no percentage). Tenants are assigned by key.
            {canReadBilling && <> Commission rate cards live under <Link to="/billing?tab=policies" className="underline">Billing → Policies</Link>.</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
          {canWrite && <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New plan</Button>}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && plans.length === 0 ? (
        <PageSpinner />
      ) : plans.length === 0 ? (
        <EmptyState title="No plans yet" description="Create a commission plan and a subscription plan so merchants can choose."
          action={canWrite ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New plan</Button> : undefined} />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ family, plans: list }) => {
            const Icon = FAMILY_ICON[family];
            return (
              <section key={family} className="space-y-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-4 w-4" /> {FAMILY_LABEL[family]} <Badge variant="outline">{list.length}</Badge>
                  {family === 'hybrid' && <span className="text-xs font-normal normal-case">(fee + percentage — not offered at launch)</span>}
                </h2>
                <DataList columns={columns} rows={list} rowKey={(p) => p._id} />
              </section>
            );
          })}
        </div>
      )}

      <PlanFormModal open={creating} policies={policies} registry={registry} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); }} />
      <PlanFormModal open={!!editing} plan={editing} policies={policies} registry={registry} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete plan "${deleting?.name ?? ''}"`}
        description="Removes the plan from the catalog. Blocked while any tenant or scheduled plan change references it."
        confirmLabel="Delete plan"
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await billingApi.plans.remove(deleting._id);
            toast.success('Plan deleted');
            setDeleting(null);
            await load();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Delete failed');
            throw err;
          }
        }}
      />
    </div>
  );
}

// --- Create / edit form ------------------------------------------------

const PlanFormModal: React.FC<{
  open: boolean;
  plan?: Plan | null;
  policies: CommissionPolicy[];
  registry: FeatureFlagDef[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}> = ({ open, plan, policies, registry, onClose, onSaved }) => {
  const toast = useToast();
  const isEdit = !!plan;

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [family, setFamily] = useState<PlanFamily>('subscription');
  const [amount, setAmount] = useState('0');
  const [currency, setCurrency] = useState('SDG');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [trialDays, setTrialDays] = useState('0');
  const [policyKey, setPolicyKey] = useState('');
  const [limits, setLimits] = useState<Record<keyof PlanLimits, string>>({ maxProducts: '', maxStaff: '', maxOrdersPerMonth: '', maxStorageMB: '', maxApiRequestsPerDay: '' });
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [allowSelfService, setAllowSelfService] = useState(true);
  const [minTerm, setMinTerm] = useState('0');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const fee = plan?.pricing?.baseFee;
    setKey(plan?.key ?? '');
    setName(plan?.name ?? '');
    setDescription(plan?.description ?? '');
    setFamily(plan?.family ?? 'subscription');
    setAmount(String(fee?.amount ?? plan?.price ?? 0));
    setCurrency(fee?.currency ?? plan?.currency ?? 'SDG');
    setInterval(fee?.interval ?? plan?.interval ?? 'month');
    setTrialDays(String(plan?.pricing?.trialDays ?? 0));
    setPolicyKey(plan?.pricing?.commissionPolicyKey ?? '');
    setLimits({
      maxProducts: plan?.limits?.maxProducts != null ? String(plan.limits.maxProducts) : '',
      maxStaff: plan?.limits?.maxStaff != null ? String(plan.limits.maxStaff) : '',
      maxOrdersPerMonth: plan?.limits?.maxOrdersPerMonth != null ? String(plan.limits.maxOrdersPerMonth) : '',
      maxStorageMB: plan?.limits?.maxStorageMB != null ? String(plan.limits.maxStorageMB) : '',
      maxApiRequestsPerDay: plan?.limits?.maxApiRequestsPerDay != null ? String(plan.limits.maxApiRequestsPerDay) : '',
    });
    setEntitlements(plan?.entitlements ?? []);
    setAllowSelfService(plan?.switching?.allowSelfService ?? true);
    setMinTerm(String(plan?.switching?.minimumTermDays ?? 0));
    setSortOrder(String(plan?.sortOrder ?? 0));
    setIsActive(plan?.isActive ?? true);
    setError(null);
    setSaving(false);
  }, [open, plan]);

  const activePolicies = policies.filter((p) => p.isActive || p.key === policyKey);
  const selectedPolicy = policies.find((p) => p.key === policyKey) || null;

  // Mirror the server's family rules so the operator sees the problem before submit.
  const validation = useMemo(() => {
    const fee = Number(amount) || 0;
    // Commission plans never carry a fee or a trial — the form resets both on
    // family switch and the payload sends 0, so there is nothing to validate.
    if (family === 'commission') {
      if (!policyKey) return 'A commission plan needs a commission policy.';
    }
    if (family === 'subscription' && policyKey) return 'A subscription plan cannot reference a commission policy.';
    if (family === 'hybrid') {
      if (!policyKey) return 'A hybrid plan needs a commission policy.';
      if (fee <= 0) return 'A hybrid plan needs a base fee greater than 0.';
    }
    if (!/^[A-Z]{3}$/.test(currency.trim().toUpperCase())) return 'Currency must be a 3-letter code.';
    return null;
  }, [family, policyKey, amount, currency]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const num = (v: string) => (v === '' ? null : Number(v));
      const payload: PlanInput = {
        name: name.trim(),
        description: description.trim(),
        family,
        pricing: {
          baseFee: { amount: family === 'commission' ? 0 : Number(amount) || 0, currency: currency.trim().toUpperCase(), interval },
          trialDays: family === 'commission' ? 0 : Number(trialDays) || 0,
          commissionPolicyKey: family === 'subscription' ? null : policyKey || null,
        },
        limits: Object.fromEntries(LIMIT_FIELDS.map(({ key: k }) => [k, num(limits[k])])) as PlanLimits,
        entitlements,
        switching: { allowSelfService, minimumTermDays: Number(minTerm) || 0 },
        sortOrder: Number(sortOrder) || 0,
        isActive,
      };
      if (isEdit && plan) { await billingApi.plans.update(plan._id, payload); toast.success('Plan updated'); }
      else { await billingApi.plans.create({ ...payload, key: key.trim().toLowerCase() }); toast.success('Plan created'); }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const groupedRegistry = useMemo(() => {
    const byGroup: Record<string, FeatureFlagDef[]> = {};
    for (const def of registry) { if (def.type !== 'boolean') continue; (byGroup[def.group] ||= []).push(def); }
    return Object.entries(byGroup);
  }, [registry]);

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? 'Edit plan' : 'New plan'}
      description={isEdit ? `Editing "${plan?.name}" (key is immutable).` : 'Pick the family first; the form shows only the relevant pricing fields.'}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim() || (!isEdit && !key.trim()) || !!validation}>
            {isEdit ? 'Save changes' : 'Create plan'}
          </Button>
        </>
      }
    >
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pe-1">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Key" required><Input value={key} disabled={isEdit} onChange={(e) => setKey(e.target.value)} placeholder="pay-as-you-sell" /></Field>
          <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pay as you sell" /></Field>
        </div>
        <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown to merchants on the plan chooser." /></Field>

        <Field label="Family" required>
          <div className="grid grid-cols-3 gap-2">
            {FAMILIES.map((f) => {
              const Icon = FAMILY_ICON[f];
              const on = family === f;
              return (
                <button key={f} type="button" onClick={() => { setFamily(f); if (f === 'commission') { setAmount('0'); setTrialDays('0'); } }}
                  className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition ${on ? 'border-primary bg-primary/5 font-medium' : 'text-muted-foreground hover:bg-accent'}`}>
                  <Icon className="h-4 w-4" /> {FAMILY_LABEL[f]}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {family === 'commission' && 'No monthly fee. The merchant pays a percentage of delivered sales set by the policy.'}
            {family === 'subscription' && 'A fixed fee per month or year. No percentage.'}
            {family === 'hybrid' && 'Fee plus percentage. Representable but not offered to merchants at launch.'}
          </p>
        </Field>

        {family !== 'commission' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Base fee" required><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Currency"><Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></Field>
            <Field label="Interval">
              <Select value={interval} onChange={(e) => setInterval(e.target.value as 'month' | 'year')}>
                <option value="month">Monthly</option><option value="year">Yearly</option>
              </Select>
            </Field>
            <Field label="Trial days" help="Once per store, subscription plans only"><Input type="number" min={0} max={365} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} /></Field>
          </div>
        )}

        {family !== 'subscription' && (
          <Field label="Commission policy" required help={activePolicies.length === 0 ? 'No active policies yet — create one under Billing → Policies.' : undefined}>
            <Select value={policyKey} onChange={(e) => setPolicyKey(e.target.value)}>
              <option value="">Select a policy…</option>
              {activePolicies.map((p) => <option key={p._id} value={p.key}>{p.name} ({p.key}){p.isActive ? '' : ' [inactive]'}</option>)}
            </Select>
            {selectedPolicy && (
              <div className="mt-2">
                <TierTable tiers={selectedPolicy.tiers} currency={selectedPolicy.currency} basis={selectedPolicy.basis} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {selectedPolicy.tierMode} · {selectedPolicy.period.replace('_', ' ')}
                  {selectedPolicy.perOrder?.minFee != null && ` · min ${formatAmount(selectedPolicy.perOrder.minFee, selectedPolicy.currency)}/order`}
                  {selectedPolicy.periodCap != null && ` · cap ${formatAmount(selectedPolicy.periodCap, selectedPolicy.currency)}`}
                </p>
              </div>
            )}
          </Field>
        )}

        <div>
          <Label>Limits <span className="font-normal text-muted-foreground">(blank = unlimited)</span></Label>
          <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {LIMIT_FIELDS.map(({ key: k, label }) => (
              <Field key={k} label={label}>
                <Input type="number" min={0} value={limits[k]} placeholder="∞" onChange={(e) => setLimits((l) => ({ ...l, [k]: e.target.value }))} />
              </Field>
            ))}
          </div>
        </div>

        {groupedRegistry.length > 0 && (
          <div>
            <Label>Entitlements <span className="font-normal text-muted-foreground">(features this plan unlocks)</span></Label>
            <div className="mt-1 space-y-2">
              {groupedRegistry.map(([group, defs]) => (
                <div key={group}>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{group}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {defs.map((def) => {
                      const on = entitlements.includes(def.key);
                      return (
                        <button key={def.key} type="button" title={def.description}
                          onClick={() => setEntitlements((e) => (on ? e.filter((k) => k !== def.key) : [...e, def.key]))}
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? 'border-primary bg-primary/10 font-medium' : 'border-border text-muted-foreground hover:border-foreground/40'}`}>
                          {def.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Switching</Label>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowSelfService} onChange={(e) => setAllowSelfService(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Merchants may self-select (switch takes effect next period)
            </label>
            <Field label="Minimum term (days)"><Input type="number" min={0} value={minTerm} onChange={(e) => setMinTerm(e.target.value)} /></Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sort order"><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Active (offered to merchants)
          </label>
        </div>

        {validation && <p className="text-xs text-destructive">{validation}</p>}
      </div>
    </Modal>
  );
};
