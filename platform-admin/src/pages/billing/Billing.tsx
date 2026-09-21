/**
 * Billing (platform): cross-tenant statements, commission policies (rate
 * cards) and billing settings. Reads need billing.read; every write control
 * is gated on billing.write (mirror — the server enforces).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import {
  billingApi,
  formatAmount,
  statementTenant,
  tierSummary,
  currentPeriodKey,
  STATUS_LABEL,
  type BillingSettings,
  type Plan,
  type CommissionPolicy,
  type Statement,
  type StatementStatus,
} from '../../lib/api-billing';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Input, Label, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/Toggle';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../../components/ui/Spinner';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ui/toast-context';
import { formatDate } from '../../lib/utils';
import { StatementStatusBadge, StatementModal, PolicyFormModal, Field } from './shared';
import { Receipt, RefreshCw, Plus, Pencil, Trash2, Play, ChevronLeft, ChevronRight, Save } from 'lucide-react';

type Tab = 'statements' | 'policies' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'statements', label: 'Statements' },
  { id: 'policies', label: 'Commission policies' },
  { id: 'settings', label: 'Settings' },
];
const TAB_IDS: Tab[] = TABS.map((t) => t.id);
const STATUSES: StatementStatus[] = ['draft', 'issued', 'partially_paid', 'overdue', 'paid', 'waived', 'void'];
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Query params are user input: validate against allow-lists before use.
const parseTab = (v: string | null): Tab => (TAB_IDS.includes(v as Tab) ? (v as Tab) : 'statements');
const parseStatus = (v: string | null): string => (STATUSES.includes(v as StatementStatus) ? (v as string) : '');
const parsePage = (v: string | null): number => { const n = parseInt(v || '1', 10); return Number.isFinite(n) && n >= 1 && n <= 10000 ? n : 1; };
const parsePeriod = (v: string | null): string => (v && PERIOD_RE.test(v) ? v : '');

export default function Billing() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get('tab'));
  const canRead = hasScope(user, PLATFORM_SCOPES.BILLING_READ);
  const canWrite = hasScope(user, PLATFORM_SCOPES.BILLING_WRITE);

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === 'statements') next.delete('tab'); else next.set('tab', t);
    setParams(next, { replace: true });
  };

  if (!canRead) {
    return <ErrorState error="You need the billing.read scope to view billing." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Receipt className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
            <p className="text-sm text-muted-foreground">
              Monthly statements per store, commission rate cards, and billing settings. Collection is manual at launch — record payments as they arrive.
              {!canWrite && ' (read-only — you lack billing.write)'}
            </p>
          </div>
        </div>
      </div>

      <div className="border-b">
        <div className="scrollbar-hide -mb-px flex gap-1 overflow-x-auto whitespace-nowrap">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm transition-colors ${tab === t.id ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'statements' && <StatementsTab canWrite={canWrite} />}
      {tab === 'policies' && <PoliciesTab canWrite={canWrite} />}
      {tab === 'settings' && <SettingsTab canWrite={canWrite} />}
    </div>
  );
}

// ------------------------------------------------------------ statements

function StatementsTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = parseStatus(params.get('status'));
  const period = parsePeriod(params.get('period'));
  const rawTenant = params.get('tenantId') || '';
  const tenantId = /^[a-f0-9]{24}$/i.test(rawTenant) ? rawTenant : '';
  const page = parsePage(params.get('page'));
  const [periodInput, setPeriodInput] = useState(period);

  const [rows, setRows] = useState<Statement[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Statement | null>(null);
  const [runOpen, setRunOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await billingApi.statements.list({ status: status || undefined, tenantId: tenantId || undefined, periodKey: period || undefined, page, limit: 50 });
      setRows(res.rows);
      setPages(res.pages); setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statements');
    } finally { setLoading(false); }
  }, [status, tenantId, page, period]);

  useEffect(() => { load(); }, [load]);

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete(k); else next.set(k, v);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const onChanged = (s: Statement) => {
    setSelected(s);
    setRows((list) => list.map((r) => (r._id === s._id ? { ...r, ...s, tenantId: r.tenantId } : r)));
  };

  const columns: DataListColumn<Statement>[] = [
    {
      id: 'tenant', header: 'Store', primary: true,
      cell: (s) => { const t = statementTenant(s); return (
        <div className="min-w-0">
          <Link to={`/tenants/${t.id}?tab=billing`} className="font-medium hover:underline">{t.name ?? t.id}</Link>
          {t.slug && <div className="text-xs text-muted-foreground"><code>{t.slug}</code> · {s.periodKey}</div>}
        </div>
      ); },
    },
    { id: 'period', header: 'Period', className: 'text-xs', cell: (s) => s.periodKey },
    { id: 'family', header: 'Family', cell: (s) => s.planFamily ? <Badge variant="outline" className="capitalize">{s.planFamily}</Badge> : '—' },
    { id: 'due', header: 'Amount due', align: 'end', className: 'tabular-nums', cell: (s) => formatAmount(s.amountDue, s.currency) },
    { id: 'paid', header: 'Paid', align: 'end', className: 'tabular-nums', cell: (s) => formatAmount(s.amountPaid, s.currency) },
    { id: 'balance', header: 'Balance', align: 'end', className: 'tabular-nums font-medium', cell: (s) => formatAmount(s.balance, s.currency) },
    { id: 'status', header: 'Status', cell: (s) => <StatementStatusBadge status={s.status} /> },
    { id: 'dueAt', header: 'Due', className: 'text-xs text-muted-foreground', cell: (s) => (s.dueAt ? formatDate(s.dueAt).split(',')[0] : '—') },
    { id: 'open', align: 'end', cell: (s) => <Button variant="ghost" size="sm" onClick={() => setSelected(s)}>Open</Button> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="scrollbar-hide -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {['', ...STATUSES].map((s) => (
            <button key={s || 'all'} onClick={() => setParam('status', s || null)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs capitalize transition-colors ${(s || '') === status ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
              {s ? STATUS_LABEL[s as StatementStatus] : 'All'}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          <Input
            placeholder="Period YYYY-MM"
            value={periodInput}
            onChange={(e) => {
              const v = e.target.value.trim();
              setPeriodInput(v);
              if (!v || PERIOD_RE.test(v)) setParam('period', v || null);
            }}
            className="w-36"
          />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
          {canWrite && <Button size="sm" variant="outline" onClick={() => setRunOpen(true)}><Play className="h-3.5 w-3.5" /> Run period</Button>}
        </div>
      </div>
      {tenantId && (
        <div className="text-xs text-muted-foreground">Filtered to one store. <button className="underline" onClick={() => setParam('tenantId', null)}>Clear</button></div>
      )}

      {error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="No statements" description="Statements are generated on the 1st of each month for the previous period, or on demand from a tenant's Billing tab." />
        : <DataList columns={columns} rows={rows} rowKey={(s) => s._id} />}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">Page {page} of {pages} · {total} total</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setParam('page', String(page - 1))}><ChevronLeft className="h-3.5 w-3.5" /> Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setParam('page', String(page + 1))}>Next <ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}

      <StatementModal statement={selected} onClose={() => setSelected(null)} onChanged={onChanged} canWrite={canWrite} />

      <ConfirmModal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        title="Run billing period"
        description="Applies due plan changes, generates and issues statements for every tenant for the given period, and marks overdue statements. Idempotent; the same routine runs automatically on the 1st."
        fields={[{ name: 'periodKey', label: 'Period (YYYY-MM)', placeholder: 'blank = previous month', help: `Current period is ${currentPeriodKey()}.` }]}
        confirmLabel="Run"
        onConfirm={async (v) => {
          try {
            const r = await billingApi.statements.runPeriod(v.periodKey?.trim() || undefined);
            toast.success(`Period ${r.periodKey}: ${r.generated} generated, ${r.issued} issued${r.skippedEmpty ? `, ${r.skippedEmpty} empty` : ''}, ${r.overdue} overdue, ${r.planChangesApplied} plan change(s) applied${r.errors?.length ? `, ${r.errors.length} error(s)` : ''}`);
            await load();
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Run failed'); throw err; }
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------ policies

function PoliciesTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<CommissionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CommissionPolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CommissionPolicy | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await billingApi.policies.list()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load policies'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (p: CommissionPolicy, next: boolean) => {
    setToggling(p._id);
    try { await billingApi.policies.update(p._id, { isActive: next }); setRows((l) => l.map((x) => (x._id === p._id ? { ...x, isActive: next } : x))); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Update failed'); }
    finally { setToggling(null); }
  };

  const columns: DataListColumn<CommissionPolicy>[] = [
    { id: 'policy', header: 'Policy', primary: true, cell: (p) => (
      <div className="min-w-0"><div className="font-medium">{p.name}</div><code className="text-xs text-muted-foreground">{p.key}</code></div>
    ) },
    { id: 'tiers', header: 'Tiers', fullWidthOnMobile: true, cell: (p) => <span className="text-sm">{tierSummary(p.tiers)} <span className="text-xs text-muted-foreground">({p.tierMode}, {p.basis === 'order_count' ? 'orders' : 'GMV'})</span></span> },
    { id: 'period', header: 'Period', className: 'text-xs', cell: (p) => p.period.replace('_', ' ') },
    { id: 'limits', header: 'Per order / cap', className: 'text-xs text-muted-foreground', cell: (p) => (
      <span className="text-xs text-muted-foreground">
        {p.perOrder?.minFee != null ? `min ${formatAmount(p.perOrder.minFee, p.currency)}` : 'no min'} · {p.perOrder?.maxFee != null ? `max ${formatAmount(p.perOrder.maxFee, p.currency)}` : 'no max'} · {p.periodCap != null ? `cap ${formatAmount(p.periodCap, p.currency)}` : 'no cap'}
      </span>
    ) },
    { id: 'ccy', header: 'Currency', className: 'text-xs', cell: (p) => p.currency },
    { id: 'active', header: 'Active', cell: (p) => canWrite
      ? <Toggle checked={p.isActive} disabled={toggling === p._id} onChange={(v) => toggleActive(p, v)} label={`${p.name} active`} />
      : (p.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>) },
    ...(canWrite ? [{
      id: 'actions', align: 'end' as const,
      cell: (p: CommissionPolicy) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    } satisfies DataListColumn<CommissionPolicy>] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Rate cards referenced by commission plans and per-store overrides. Thresholds are in the policy currency; fees are charged in each store's currency.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
          {canWrite && <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New policy</Button>}
        </div>
      </div>
      {error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="No commission policies" description="Create a rate card, then reference it from a commission plan."
            action={canWrite ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New policy</Button> : undefined} />
        : <DataList columns={columns} rows={rows} rowKey={(p) => p._id} />}

      <PolicyFormModal open={creating} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); }} />
      <PolicyFormModal open={!!editing} policy={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete policy "${deleting?.name ?? ''}"`}
        description="Blocked while a plan, an active override or the platform default references it."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          try { await billingApi.policies.remove(deleting._id); toast.success('Policy deleted'); setDeleting(null); await load(); }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed'); throw err; }
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------ settings

function SettingsTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [policies, setPolicies] = useState<CommissionPolicy[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, p, pl] = await Promise.all([billingApi.settings.get(), billingApi.policies.list().catch(() => []), billingApi.plans.list().catch(() => [])]);
      setSettings(s); setForm(s); setPolicies(p); setPlans(pl);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load settings'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (loading || !form || !settings) return <PageSpinner />;
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);

  const save = async () => {
    setSaving(true);
    try {
      const next = await billingApi.settings.update({
        defaultPlanKey: form.defaultPlanKey,
        defaultCommissionPolicyKey: form.defaultCommissionPolicyKey || null,
        statementDay: form.statementDay, dueDays: form.dueDays, graceDays: form.graceDays,
        enforcement: form.enforcement,
      });
      setSettings(next); setForm(next); toast.success('Billing settings saved');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <Field label="Default plan for new stores" help="Every new signup lands on this plan (unless the merchant picked another active plan). Access programs grant features, not plans.">
          <Select value={form.defaultPlanKey ?? ''} disabled={!canWrite} onChange={(e) => setForm({ ...form, defaultPlanKey: e.target.value })}>
            {!plans.some((p) => p.key === form.defaultPlanKey) && <option value={form.defaultPlanKey}>{form.defaultPlanKey} (missing or inactive)</option>}
            {plans.filter((p) => p.isActive).map((p) => <option key={p._id} value={p.key}>{p.name} ({p.key}) — {p.family === 'commission' ? 'commission' : 'subscription'}</option>)}
          </Select>
        </Field>
        <Field label="Default commission policy" help="Applied to non-subscription plans that do not name a policy.">
          <Select value={form.defaultCommissionPolicyKey ?? ''} disabled={!canWrite} onChange={(e) => setForm({ ...form, defaultCommissionPolicyKey: e.target.value || null })}>
            <option value="">None</option>
            {policies.filter((p) => p.isActive || p.key === form.defaultCommissionPolicyKey).map((p) => <option key={p._id} value={p.key}>{p.name} ({p.key})</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Statement day" help="1–28"><Input type="number" min={1} max={28} disabled={!canWrite} value={form.statementDay} onChange={(e) => setForm({ ...form, statementDay: Number(e.target.value) || 1 })} /></Field>
          <Field label="Due days" help="After issue"><Input type="number" min={0} max={90} disabled={!canWrite} value={form.dueDays} onChange={(e) => setForm({ ...form, dueDays: Number(e.target.value) || 0 })} /></Field>
          <Field label="Grace days" help="After due"><Input type="number" min={0} max={180} disabled={!canWrite} value={form.graceDays} onChange={(e) => setForm({ ...form, graceDays: Number(e.target.value) || 0 })} /></Field>
        </div>
        <div>
          <Label>Enforcement on overdue</Label>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{form.enforcement.onOverdue.replace('_', ' ')}</Badge>
            <span className="text-xs text-muted-foreground">None at launch — statements are tracked and payments recorded manually; the collection method is decided later. Other modes are stored but not enforced yet.</span>
          </div>
        </div>
      </div>
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving} disabled={!dirty}><Save className="h-3.5 w-3.5" /> Save changes</Button>
        </div>
      )}
    </div>
  );
}
