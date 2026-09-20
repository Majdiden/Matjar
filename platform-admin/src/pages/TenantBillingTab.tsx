/**
 * Tenant detail → Billing tab: effective pricing (with its source per field),
 * current-period accruals, fee ledger, statements, pricing overrides, and
 * plan changes. Reads mirror billing.read; write controls mirror billing.write.
 */
import { useCallback, useEffect, useState } from 'react';
import { hasScope, PLATFORM_SCOPES } from '../lib/api';
import {
  billingApi,
  formatAmount,
  formatPercent,
  currentPeriodKey,
  FAMILY_LABEL,
  type CommissionPolicy,
  type FeeEvent,
  type Plan,
  type Statement,
  type TenantEffective,
} from '../lib/api-billing';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Card as UiCard, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { DataList, type DataListColumn } from '../components/ui/DataList';
import { PageSpinner, ErrorState } from '../components/ui/Spinner';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ui/toast-context';
import { formatDate, shortId } from '../lib/utils';
import { StatementStatusBadge, StatementModal, TierTable, Kv, Field } from './billing/shared';
import { RefreshCw, Plus, FileText, ArrowLeftRight, XCircle } from 'lucide-react';

// Thin wrapper over ui/Card so every section shares the same header row.
const Card: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <UiCard>
    <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 p-4">
      <CardTitle className="text-sm">{title}</CardTitle>
      {action}
    </CardHeader>
    <CardContent className="p-4 pt-0">{children}</CardContent>
  </UiCard>
);

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const SourceBadge = ({ source }: { source: string }) => (
  <Badge variant={source === 'override' ? 'warning' : 'outline'} className="text-[10px] capitalize">{source}</Badge>
);

export default function TenantBillingTab({ tenantId, storeCurrency }: { tenantId: string; storeCurrency?: string | null }) {
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = hasScope(user, PLATFORM_SCOPES.BILLING_WRITE);

  const [data, setData] = useState<TenantEffective | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [ledger, setLedger] = useState<FeeEvent[]>([]);
  // Applied filter (validated) vs. what is being typed — a partial value must
  // never reach the API and 400 the whole tab.
  const [ledgerPeriod, setLedgerPeriod] = useState('');
  const [ledgerPeriodInput, setLedgerPeriodInput] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [policies, setPolicies] = useState<CommissionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Statement | null>(null);
  const [modal, setModal] = useState<null | 'override' | 'adjust' | 'generate' | 'plan' | 'cancel-plan'>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [eff, st, led, pl, pol] = await Promise.all([
        billingApi.tenant.effective(tenantId),
        billingApi.tenant.statements(tenantId),
        billingApi.tenant.ledger(tenantId, { periodKey: ledgerPeriod || undefined, limit: 50 }),
        billingApi.plans.list().catch(() => []),
        billingApi.policies.list().catch(() => []),
      ]);
      setData(eff); setStatements(st.rows); setLedger(led.rows); setPlans(pl); setPolicies(pol);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing');
    } finally { setLoading(false); }
  }, [tenantId, ledgerPeriod]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (loading && !data) return <PageSpinner />;
  if (!data) return null;

  const { pricing, currentPeriod, overrides, planChanges } = data;
  const scheduled = planChanges.find((c) => c.status === 'scheduled') || null;
  const activeOverrides = overrides.filter((o) => !o.revokedAt);
  // Adjustments/credits are charged in the STORE currency; the ledger may be
  // empty this period, so prefer the tenant setting over the period's currency.
  const currency = storeCurrency || currentPeriod.currency || pricing.baseFee.currency;

  const onStatementChanged = (s: Statement) => {
    setSelected(s);
    setStatements((list) => list.map((r) => (r._id === s._id ? { ...r, ...s } : r)));
  };

  const ledgerCols: DataListColumn<FeeEvent>[] = [
    { id: 'when', header: 'When', primary: true, cell: (e) => (
      <div className="min-w-0"><div className="text-sm">{formatDate(e.occurredAt)}</div><div className="text-xs text-muted-foreground">{e.periodKey}{e.orderNumber ? ` · #${e.orderNumber}` : ''}</div></div>
    ) },
    { id: 'type', header: 'Type', cell: (e) => <Badge variant={e.type === 'commission' ? 'secondary' : e.type === 'reversal' || e.type === 'credit' ? 'warning' : 'outline'} className="capitalize">{e.type}</Badge> },
    { id: 'basis', header: 'Basis', align: 'end', className: 'tabular-nums text-xs', cell: (e) => e.basisAmount ? formatAmount(e.basisAmount, e.basisCurrency || e.feeCurrency) : '—' },
    { id: 'rate', header: 'Rate', className: 'text-xs', cell: (e) => e.percentApplied != null ? `${formatPercent(e.percentApplied)}${e.tierIndex != null ? ` (tier ${e.tierIndex + 1})` : ''}` : '—' },
    { id: 'fee', header: 'Fee', align: 'end', className: 'tabular-nums font-medium', cell: (e) => <span className={e.feeAmount < 0 ? 'text-emerald-700' : ''}>{formatAmount(e.feeAmount, e.feeCurrency)}</span> },
    { id: 'src', header: 'Source', className: 'text-xs', cell: (e) => (
      <span className="text-xs text-muted-foreground">
        {e.source}{e.pricingSource ? ` · ${e.pricingSource}` : ''}{e.metadata && (e.metadata as { fxMissing?: boolean }).fxMissing ? ' · FX missing' : ''}{e.reason ? ` · ${e.reason}` : ''}
      </span>
    ) },
  ];

  const stmtCols: DataListColumn<Statement>[] = [
    { id: 'period', header: 'Period', primary: true, cell: (s) => <span className="font-medium">{s.periodKey}</span> },
    { id: 'due', header: 'Amount due', align: 'end', className: 'tabular-nums', cell: (s) => formatAmount(s.amountDue, s.currency) },
    { id: 'paid', header: 'Paid', align: 'end', className: 'tabular-nums', cell: (s) => formatAmount(s.amountPaid, s.currency) },
    { id: 'balance', header: 'Balance', align: 'end', className: 'tabular-nums font-medium', cell: (s) => formatAmount(s.balance, s.currency) },
    { id: 'status', header: 'Status', cell: (s) => <StatementStatusBadge status={s.status} /> },
    { id: 'dueAt', header: 'Due', className: 'text-xs text-muted-foreground', cell: (s) => (s.dueAt ? formatDate(s.dueAt).split(',')[0] : '—') },
    { id: 'open', align: 'end', cell: (s) => <Button variant="ghost" size="sm" onClick={() => setSelected(s)}>Open</Button> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <Card title="Effective pricing">
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{pricing.planName ?? pricing.planKey ?? '—'}</span>
              <Badge variant="outline">{FAMILY_LABEL[pricing.family] ?? pricing.family}</Badge>
              {pricing.inTrial && <Badge variant="secondary">Trial until {formatDate(pricing.trialEndsAt).split(',')[0]}</Badge>}
              {pricing.inFeeHoliday && <Badge variant="warning">Fee holiday until {formatDate(pricing.feeHolidayUntil).split(',')[0]}</Badge>}
              {pricing.policyFallback && <Badge variant="destructive" title={`Policy "${pricing.policyFallback.wanted}" is inactive or missing; the platform default "${pricing.policyFallback.used}" applies.`}>Policy fallback</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Kv label={<span className="inline-flex items-center gap-1">Base fee <SourceBadge source={pricing.source.baseFee} /></span>}
                value={pricing.chargesBaseFee ? `${formatAmount(pricing.baseFee.amount, pricing.baseFee.currency)}/${pricing.baseFee.interval}` : 'None'} />
              <Kv label={<span className="inline-flex items-center gap-1">Commission <SourceBadge source={pricing.source.commission} /></span>}
                value={pricing.chargesCommission && pricing.policy ? `${pricing.policy.name} (${pricing.policy.key})${pricing.percentDelta ? ` ${pricing.percentDelta > 0 ? '+' : ''}${pricing.percentDelta} pt` : ''}` : 'None'} />
            </div>
            {pricing.chargesCommission && pricing.policy && (
              <div>
                <TierTable tiers={pricing.policy.tiers} currency={pricing.policy.currency} basis={pricing.policy.basis} />
                <p className="mt-1 text-[11px] text-muted-foreground">{pricing.policy.tierMode} · {pricing.policy.period.replace('_', ' ')} · recognised on {pricing.policy.recognitionEvent}</p>
              </div>
            )}
          </div>
        </Card>

        <Card title={`Current period (${currentPeriod.periodKey})`} action={canWrite ? <Button size="sm" variant="outline" onClick={() => setModal('adjust')}><Plus className="h-3.5 w-3.5" /> Adjustment</Button> : undefined}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Kv label="Delivered GMV" value={formatAmount(currentPeriod.gmv, currency)} />
            <Kv label="Commission accrued" value={formatAmount(currentPeriod.commission, currency)} strong />
            <Kv label="Adjustments" value={formatAmount(currentPeriod.adjustments, currency)} />
            <Kv label="Credits" value={formatAmount(currentPeriod.credits, currency)} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{currentPeriod.count} ledger row(s) this period. The statement is generated on the 1st, or on demand below.</p>
        </Card>

        <Card title="Plan" action={canWrite ? <Button size="sm" variant="outline" onClick={() => setModal('plan')}><ArrowLeftRight className="h-3.5 w-3.5" /> Change plan</Button> : undefined}>
          <div className="space-y-2 text-sm">
            <Kv label="Current" value={<span>{pricing.planName ?? '—'} <code className="text-xs text-muted-foreground">{pricing.planKey}</code></span>} />
            {scheduled ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                <span>Scheduled: <strong>{scheduled.toPlan}</strong> on {formatDate(scheduled.effectiveAt).split(',')[0]} ({scheduled.requestedBy}){scheduled.reason ? ` — ${scheduled.reason}` : ''}</span>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => setModal('cancel-plan')}><XCircle className="h-3.5 w-3.5" /> Cancel</Button>}
              </div>
            ) : <p className="text-xs text-muted-foreground">No scheduled change.</p>}
            {planChanges.filter((c) => c.status !== 'scheduled').slice(0, 5).map((c) => (
              <div key={c._id} className="text-xs text-muted-foreground">{c.fromPlan ?? '—'} → {c.toPlan} · {c.status} · {formatDate(c.appliedAt || c.effectiveAt).split(',')[0]} ({c.requestedBy})</div>
            ))}
          </div>
        </Card>

        <Card title="Pricing overrides" action={canWrite ? <Button size="sm" variant="outline" onClick={() => setModal('override')}><Plus className="h-3.5 w-3.5" /> Override</Button> : undefined}>
          {overrides.length === 0 ? <p className="text-xs text-muted-foreground">No overrides. Active overrides are merged; the newest value wins per field and beats the plan for this store only.</p> : (
            <div className="space-y-2">
              {overrides.map((o) => (
                <div key={o._id} className={`rounded-md border p-2 text-xs ${o.revokedAt ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {o.baseFee?.amount != null && <Badge variant="outline">fee {formatAmount(o.baseFee.amount, o.baseFee.currency || currency)}/{o.baseFee.interval || 'month'}</Badge>}
                      {o.commissionPolicyKey && <Badge variant="outline">policy {o.commissionPolicyKey}</Badge>}
                      {o.percentDelta != null && o.percentDelta !== 0 && <Badge variant="outline">{o.percentDelta > 0 ? '+' : ''}{o.percentDelta} pt</Badge>}
                      {o.feeHolidayUntil && <Badge variant="warning">fee holiday → {formatDate(o.feeHolidayUntil).split(',')[0]}</Badge>}
                      {o.revokedAt && <Badge variant="destructive">revoked</Badge>}
                    </div>
                    {canWrite && !o.revokedAt && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRevoking(o._id)}>Revoke</Button>}
                  </div>
                  <div className="mt-1 text-muted-foreground [overflow-wrap:anywhere]">
                    {formatDate(o.startsAt).split(',')[0]}{o.endsAt ? ` → ${formatDate(o.endsAt).split(',')[0]}` : ' → open'} · {o.reason} · {shortId(o.createdBy)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Statements" action={canWrite ? <Button size="sm" variant="outline" onClick={() => setModal('generate')}><FileText className="h-3.5 w-3.5" /> Generate</Button> : undefined}>
        {statements.length === 0 ? <p className="text-xs text-muted-foreground">No statements yet.</p> : <DataList columns={stmtCols} rows={statements} rowKey={(s) => s._id} />}
      </Card>

      <Card title="Fee ledger" action={
        <div className="flex items-center gap-2">
          <Input
            placeholder="YYYY-MM"
            value={ledgerPeriodInput}
            onChange={(e) => {
              const v = e.target.value.trim();
              setLedgerPeriodInput(v);
              if (!v || PERIOD_RE.test(v)) setLedgerPeriod(v);
            }}
            className="h-8 w-28 text-xs"
          />
        </div>
      }>
        {ledger.length === 0 ? <p className="text-xs text-muted-foreground">No ledger rows{ledgerPeriod ? ` for ${ledgerPeriod}` : ''}.</p> : <DataList columns={ledgerCols} rows={ledger} rowKey={(e) => e._id} />}
      </Card>

      <StatementModal statement={selected} onClose={() => setSelected(null)} onChanged={onStatementChanged} canWrite={canWrite} showTenant={false} />

      <ConfirmModal
        open={modal === 'adjust'}
        onClose={() => setModal(null)}
        title="Add adjustment"
        description="Positive = extra charge, negative = credit. Appended to the ledger for the period and rolled into its statement."
        fields={[
          { name: 'amount', label: `Amount (${currency})`, type: 'number', required: true },
          { name: 'periodKey', label: 'Period (YYYY-MM)', defaultValue: currentPeriod.periodKey || currentPeriodKey() },
          { name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4 },
        ]}
        confirmLabel="Add"
        onConfirm={async (v) => {
          try { await billingApi.tenant.adjust(tenantId, { amount: Number(v.amount), reason: v.reason, periodKey: v.periodKey || undefined }); toast.success('Adjustment added'); setModal(null); await load(); }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); throw err; }
        }}
      />
      <ConfirmModal
        open={modal === 'generate'}
        onClose={() => setModal(null)}
        title="Generate statement"
        description="Builds (or rebuilds a draft) statement for the period from the ledger. Issued statements are returned unchanged unless forced."
        fields={[
          { name: 'periodKey', label: 'Period (YYYY-MM)', required: true, defaultValue: currentPeriod.periodKey || currentPeriodKey() },
          { name: 'force', label: "Type 'force' to rebuild an issued statement", placeholder: 'leave blank normally' },
        ]}
        confirmLabel="Generate"
        onConfirm={async (v) => {
          try {
            const r = await billingApi.tenant.generateStatement(tenantId, v.periodKey.trim(), v.force?.trim().toLowerCase() === 'force');
            toast.success(r.created ? 'Statement created' : r.regenerated ? 'Statement rebuilt' : 'Statement already issued');
            setModal(null); await load();
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); throw err; }
        }}
      />
      <ConfirmModal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="Revoke override"
        description="The store falls back to its plan pricing from now on."
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4 }]}
        confirmLabel="Revoke"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          if (!revoking) return;
          try { await billingApi.tenant.revokeOverride(tenantId, revoking, v.reason); toast.success('Override revoked'); setRevoking(null); await load(); }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); throw err; }
        }}
      />
      <ConfirmModal
        open={modal === 'cancel-plan'}
        onClose={() => setModal(null)}
        title="Cancel scheduled plan change"
        description={scheduled ? `The change to "${scheduled.toPlan}" will not be applied.` : ''}
        confirmLabel="Cancel change"
        onConfirm={async () => {
          try { await billingApi.tenant.cancelPlanChange(tenantId); toast.success('Scheduled change cancelled'); setModal(null); await load(); }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); throw err; }
        }}
      />

      <OverrideModal open={modal === 'override'} tenantId={tenantId} currency={currency} policies={policies} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await load(); }} />
      <PlanChangeModal open={modal === 'plan'} tenantId={tenantId} currentPlan={pricing.planKey} plans={plans} policies={policies} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await load(); }} />
      {activeOverrides.length > 1 && <p className="text-xs text-amber-700">Several active overrides — they are merged; the newest value wins per field.</p>}
    </div>
  );
}

// ------------------------------------------------------------ override modal

function OverrideModal({ open, tenantId, currency, policies, onClose, onSaved }: {
  open: boolean; tenantId: string; currency: string; policies: CommissionPolicy[]; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [fee, setFee] = useState('');
  const [feeCurrency, setFeeCurrency] = useState(currency);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [policyKey, setPolicyKey] = useState('');
  const [delta, setDelta] = useState('');
  const [holiday, setHoliday] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFee(''); setFeeCurrency(currency); setInterval('month'); setPolicyKey(''); setDelta(''); setHoliday(''); setStartsAt(''); setEndsAt(''); setReason(''); setError(null); setSaving(false);
  }, [open, currency]);

  const hasPricingField = fee !== '' || policyKey !== '' || delta !== '' || holiday !== '';
  const submit = async () => {
    setSaving(true); setError(null);
    try {
      await billingApi.tenant.createOverride(tenantId, {
        ...(fee !== '' ? { baseFee: { amount: Number(fee), currency: feeCurrency.toUpperCase(), interval } } : {}),
        ...(policyKey ? { commissionPolicyKey: policyKey } : {}),
        ...(delta !== '' ? { percentDelta: Number(delta) } : {}),
        ...(holiday ? { feeHolidayUntil: new Date(holiday).toISOString() } : {}),
        ...(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}),
        ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
        reason: reason.trim(),
      });
      toast.success('Override created');
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="Add pricing override" description="Negotiated or promotional pricing for this store only. Leave a field blank to keep the plan's value."
      footer={<>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={submit} loading={saving} disabled={!hasPricingField || reason.trim().length < 4}>Create override</Button>
      </>}>
      <div className="space-y-3">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</div>}
        <div className="grid grid-cols-3 gap-2">
          <Field label="Base fee"><Input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="plan" /></Field>
          <Field label="Currency"><Input value={feeCurrency} maxLength={3} onChange={(e) => setFeeCurrency(e.target.value.toUpperCase())} /></Field>
          <Field label="Interval"><Select value={interval} onChange={(e) => setInterval(e.target.value as 'month' | 'year')}><option value="month">Month</option><option value="year">Year</option></Select></Field>
        </div>
        <Field label="Commission policy">
          <Select value={policyKey} onChange={(e) => setPolicyKey(e.target.value)}>
            <option value="">Keep plan policy</option>
            {policies.filter((p) => p.isActive).map((p) => <option key={p._id} value={p.key}>{p.name} ({p.key})</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Percent delta" help="Points added to the tier rate; -1 = one point cheaper"><Input type="number" step="0.1" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="0" /></Field>
          <Field label="Fee holiday until" help="0% commission until this date"><Input type="date" value={holiday} onChange={(e) => setHoliday(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Starts"><Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
          <Field label="Ends"><Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
        </div>
        <Field label="Reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this store gets special pricing (audited)." /></Field>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------ plan change modal

function PlanChangeModal({ open, tenantId, currentPlan, plans, policies, onClose, onSaved }: {
  open: boolean; tenantId: string; currentPlan: string | null; plans: Plan[]; policies: CommissionPolicy[]; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [toPlan, setToPlan] = useState('');
  const [effectiveAt, setEffectiveAt] = useState<'immediately' | 'next_period'>('next_period');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setToPlan(''); setEffectiveAt('next_period'); setReason(''); setError(null); setSaving(false); } }, [open]);

  const target = plans.find((p) => p.key === toPlan);
  const policy = target?.pricing?.commissionPolicyKey ? policies.find((p) => p.key === target.pricing.commissionPolicyKey) : null;

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const trimmed = reason.trim();
      const r = await billingApi.tenant.planChange(tenantId, { toPlan, effectiveAt, ...(trimmed.length >= 3 ? { reason: trimmed } : {}) });
      toast.success(r.applied ? `Plan changed to ${toPlan}` : `Change to ${toPlan} scheduled for ${formatDate(r.change.effectiveAt).split(',')[0]}`);
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="Change plan" description="Next period keeps one billing model per statement. Immediate switches take effect now."
      footer={<>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={submit} loading={saving} disabled={!toPlan || toPlan === currentPlan}>Change plan</Button>
      </>}>
      <div className="space-y-3">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</div>}
        <Field label="New plan" required>
          <Select value={toPlan} onChange={(e) => setToPlan(e.target.value)}>
            <option value="">Select a plan…</option>
            {plans.map((p) => <option key={p._id} value={p.key} disabled={!p.isActive || p.key === currentPlan}>{p.name} ({p.key}) — {FAMILY_LABEL[p.family] ?? p.family}{!p.isActive ? ' [inactive]' : ''}{p.key === currentPlan ? ' [current]' : ''}</option>)}
          </Select>
        </Field>
        {target && (
          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            {target.family === 'commission'
              ? `${policy ? policy.name : target.pricing.commissionPolicyKey}: ${policy ? policy.tiers.map((t) => formatPercent(t.percent)).join(' → ') : ''} of delivered sales, no fee`
              : `${formatAmount(target.pricing.baseFee.amount, target.pricing.baseFee.currency)}/${target.pricing.baseFee.interval}${target.pricing.trialDays ? `, ${target.pricing.trialDays}-day trial` : ''}`}
          </div>
        )}
        <Field label="Takes effect">
          <Select value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value as 'immediately' | 'next_period')}>
            <option value="next_period">Next period (recommended)</option><option value="immediately">Immediately</option>
          </Select>
        </Field>
        <Field label="Reason" help="Optional; at least 3 characters when given. Recorded in the audit ledger."><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {reason.trim().length > 0 && reason.trim().length < 3 && <p className="text-xs text-amber-700">Reason too short — it will be omitted.</p>}
      </div>
    </Modal>
  );
}

