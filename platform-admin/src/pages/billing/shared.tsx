/**
 * Shared billing UI pieces (statement badge + detail modal with actions,
 * commission policy editor with live preview). Used by the Billing page,
 * the Plans page and the tenant Billing tab.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Label, Select, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ui/toast-context';
import { formatDate } from '../../lib/utils';
import {
  billingApi,
  formatAmount,
  formatPercent,
  statementTenant,
  PAYMENT_METHODS,
  STATUS_LABEL,
  type CommissionPolicy,
  type CommissionTier,
  type PaymentMethod,
  type PolicyInput,
  type PolicyPreview,
  type Statement,
  type StatementStatus,
} from '../../lib/api-billing';
import { Plus, Trash2 } from 'lucide-react';

// ------------------------------------------------------------ statements

export function StatementStatusBadge({ status }: { status: StatementStatus }) {
  const variant: React.ComponentProps<typeof Badge>['variant'] =
    status === 'paid' ? 'success'
    : status === 'overdue' ? 'destructive'
    : status === 'partially_paid' || status === 'issued' ? 'warning'
    : status === 'draft' ? 'secondary'
    : 'outline';
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function LineTypeLabel({ type }: { type: Statement['lines'][number]['type'] }) {
  const label = { subscription: 'Subscription', commission: 'Commission', adjustment: 'Adjustment', credit: 'Credit', tax: 'Tax' }[type] ?? type;
  return <span className="capitalize">{label}</span>;
}

/**
 * Statement detail (lines + payments) with the write actions allowed by
 * its status. Parent passes `canWrite` (mirror of billing.write).
 */
export function StatementModal({
  statement,
  onClose,
  onChanged,
  canWrite,
  showTenant = true,
}: {
  statement: Statement | null;
  onClose: () => void;
  onChanged: (s: Statement) => void;
  canWrite: boolean;
  showTenant?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [action, setAction] = useState<null | 'pay' | 'waive' | 'void'>(null);
  const s = statement;
  if (!s) return null;
  const tenant = statementTenant(s);
  const canIssue = s.status === 'draft';
  const canPay = ['issued', 'partially_paid', 'overdue'].includes(s.status) && s.balance > 0;
  const canWaive = ['issued', 'partially_paid', 'overdue'].includes(s.status);
  const canVoid = !['paid', 'void'].includes(s.status) && (s.amountPaid || 0) === 0;

  const run = async (name: string, fn: () => Promise<Statement>, ok: string) => {
    setBusy(name);
    try {
      const next = await fn();
      onChanged(next);
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
      throw err;
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Modal
        open={!!s && !action}
        onClose={onClose}
        title={`Statement ${s.periodKey}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {showTenant && tenant.name && (
              <span>{tenant.name} <code className="text-xs">{tenant.slug}</code> ·</span>
            )}
            <StatementStatusBadge status={s.status} />
            {s.planFamily && <Badge variant="outline" className="capitalize">{s.planFamily}</Badge>}
          </span>
        }
        className="max-w-2xl"
        footer={
          canWrite ? (
            <>
              {canIssue && (
                <Button size="sm" loading={busy === 'issue'} onClick={() => run('issue', () => billingApi.statements.issue(s._id), 'Statement issued')}>
                  Issue
                </Button>
              )}
              {canPay && <Button size="sm" onClick={() => setAction('pay')}>Record payment</Button>}
              {canWaive && <Button size="sm" variant="outline" onClick={() => setAction('waive')}>Waive</Button>}
              {canVoid && <Button size="sm" variant="destructive" onClick={() => setAction('void')}>Void</Button>}
              <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          )
        }
      >
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Kv label="Period" value={`${formatDate(s.periodStart).split(',')[0]} – ${formatDate(s.periodEnd).split(',')[0]}`} />
            <Kv label="Issued" value={s.issuedAt ? formatDate(s.issuedAt) : '—'} />
            <Kv label="Due" value={s.dueAt ? formatDate(s.dueAt) : '—'} />
            <Kv label="Paid at" value={s.paidAt ? formatDate(s.paidAt) : '—'} />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lines</div>
            <div className="divide-y rounded-md border">
              {s.lines.length === 0 && <div className="p-2 text-xs text-muted-foreground">No lines.</div>}
              {s.lines.map((l, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-2">
                  <div className="min-w-0">
                    <div className="font-medium"><LineTypeLabel type={l.type} /></div>
                    <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{l.description}{l.ref ? ` · ${l.ref}` : ''}</div>
                  </div>
                  <div className="shrink-0 tabular-nums">{formatAmount(l.amount, s.currency)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Kv label="Subtotal" value={formatAmount(s.subtotal, s.currency)} />
            <Kv label="Credits" value={formatAmount(s.credits, s.currency)} />
            <Kv label="Amount due" value={formatAmount(s.amountDue, s.currency)} strong />
            <Kv label="Balance" value={formatAmount(s.balance, s.currency)} strong />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Payments</div>
            {s.payments.length === 0 ? (
              <div className="rounded-md border p-2 text-xs text-muted-foreground">No payments recorded.</div>
            ) : (
              <div className="divide-y rounded-md border">
                {s.payments.map((p, i) => (
                  <div key={p._id ?? i} className="flex items-start justify-between gap-3 p-2">
                    <div className="min-w-0">
                      <div className="font-medium capitalize">{p.method.replace('_', ' ')}</div>
                      <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {formatDate(p.recordedAt)}{p.reference ? ` · ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}
                      </div>
                    </div>
                    <div className="shrink-0 tabular-nums">{formatAmount(p.amount, s.currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {s.note && <div className="rounded-md bg-muted p-2 text-xs">Note: {s.note}</div>}
        </div>
      </Modal>

      <ConfirmModal
        open={action === 'pay'}
        onClose={() => setAction(null)}
        title="Record payment"
        description={`Balance ${formatAmount(s.balance, s.currency)}. Amounts above the balance are rejected.`}
        fields={[
          { name: 'amount', label: `Amount (${s.currency})`, type: 'number', required: true, defaultValue: String(s.balance) },
          { name: 'method', label: `Method (${PAYMENT_METHODS.map((m) => m.value).join(', ')})`, required: true, defaultValue: 'bankak' },
          { name: 'reference', label: 'Reference', placeholder: 'Transaction / receipt number' },
          { name: 'note', label: 'Note' },
        ]}
        confirmLabel="Record"
        onConfirm={async (v) => {
          const method = v.method.trim().toLowerCase() as PaymentMethod;
          if (!PAYMENT_METHODS.some((m) => m.value === method)) throw new Error('Unknown payment method');
          await run('pay', () => billingApi.statements.recordPayment(s._id, {
            amount: Number(v.amount), method, reference: v.reference || undefined, note: v.note || undefined,
          }), 'Payment recorded');
          setAction(null);
        }}
      />
      <ConfirmModal
        open={action === 'waive'}
        onClose={() => setAction(null)}
        title="Waive statement"
        description="Sets the balance to zero without a payment. Audited with your reason."
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4 }]}
        confirmLabel="Waive"
        onConfirm={async (v) => { await run('waive', () => billingApi.statements.waive(s._id, v.reason), 'Statement waived'); setAction(null); }}
      />
      <ConfirmModal
        open={action === 'void'}
        onClose={() => setAction(null)}
        title="Void statement"
        description="Cancels the statement and releases its ledger rows so a regenerated statement can pick them up. Irreversible."
        confirmPhrase={s.periodKey}
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4 }]}
        confirmLabel="Void statement"
        confirmVariant="destructive"
        onConfirm={async (v) => { await run('void', () => billingApi.statements.void(s._id, v.reason), 'Statement voided'); setAction(null); }}
      />
    </>
  );
}

export function Kv({ label, value, strong }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`min-w-0 [overflow-wrap:anywhere] ${strong ? 'font-semibold' : ''}`}>{value}</div>
    </div>
  );
}

// ------------------------------------------------------------ tier table

export function TierTable({ tiers, currency, basis }: { tiers: CommissionTier[]; currency: string; basis?: 'gmv' | 'order_count' }) {
  return (
    <div className="divide-y rounded-md border text-sm">
      {tiers.map((t, i) => {
        const lower = i === 0 ? 0 : tiers[i - 1].upTo ?? 0;
        const range = t.upTo == null
          ? `above ${basis === 'order_count' ? lower : formatAmount(lower, currency)}`
          : `${basis === 'order_count' ? lower : formatAmount(lower, currency)} – ${basis === 'order_count' ? t.upTo : formatAmount(t.upTo, currency)}`;
        return (
          <div key={i} className="flex items-center justify-between gap-3 p-2">
            <span className="text-muted-foreground">{range}</span>
            <span className="tabular-nums">
              {formatPercent(t.percent)}{t.fixedPerOrder ? ` + ${formatAmount(t.fixedPerOrder, currency)}/order` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ policy editor

const EMPTY_POLICY: PolicyInput = {
  key: '', name: '', description: '', isActive: true,
  basis: 'gmv', gmvScope: 'delivered', recognitionEvent: 'delivered',
  period: 'calendar_month', tierMode: 'marginal',
  tiers: [{ upTo: null, percent: 5, fixedPerOrder: 0 }],
  perOrder: { minFee: null, maxFee: null }, periodCap: null,
  paymentMethods: 'all', currency: 'SDG', rounding: 'nearest', precision: 0,
};

function validateTiers(tiers: CommissionTier[]): string | null {
  if (!tiers.length) return 'At least one tier is required';
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!(t.percent >= 0 && t.percent <= 100)) return `Tier ${i + 1}: percent must be between 0 and 100`;
    const last = i === tiers.length - 1;
    if (last && t.upTo != null) return 'The last tier must be open-ended (no upper bound)';
    if (!last) {
      if (t.upTo == null || t.upTo <= 0) return `Tier ${i + 1}: an upper bound is required`;
      if (i > 0 && (tiers[i - 1].upTo ?? 0) >= t.upTo) return `Tier ${i + 1}: bounds must be ascending`;
    }
  }
  return null;
}

export function PolicyFormModal({
  open, policy, onClose, onSaved,
}: { open: boolean; policy?: CommissionPolicy | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const toast = useToast();
  const isEdit = !!policy;
  const [form, setForm] = useState<PolicyInput>(EMPTY_POLICY);
  const [methods, setMethods] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Live preview inputs.
  const [pvAmount, setPvAmount] = useState('10000');
  const [pvSoFar, setPvSoFar] = useState('0');
  const [preview, setPreview] = useState<PolicyPreview | null>(null);
  const [pvError, setPvError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (policy) {
      const rest: PolicyInput = {
        key: policy.key, name: policy.name, description: policy.description, isActive: policy.isActive,
        basis: policy.basis, gmvScope: policy.gmvScope, recognitionEvent: policy.recognitionEvent,
        period: policy.period, tierMode: policy.tierMode, tiers: policy.tiers.map((t) => ({ ...t })),
        perOrder: { ...policy.perOrder }, periodCap: policy.periodCap, paymentMethods: policy.paymentMethods,
        currency: policy.currency, rounding: policy.rounding, precision: policy.precision,
      };
      setForm({ ...EMPTY_POLICY, ...rest });
      setMethods(Array.isArray(policy.paymentMethods) ? policy.paymentMethods.join(', ') : '');
    } else {
      setForm({ ...EMPTY_POLICY, tiers: [{ upTo: null, percent: 5, fixedPerOrder: 0 }] });
      setMethods('');
    }
    setError(null); setSaving(false); setPreview(null); setPvError(null);
  }, [open, policy]);

  const tiers = useMemo(() => form.tiers ?? [], [form.tiers]);
  const tierError = useMemo(() => validateTiers(tiers), [tiers]);
  const set = <K extends keyof PolicyInput>(k: K, v: PolicyInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setTier = (i: number, patch: Partial<CommissionTier>) =>
    set('tiers', tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const payload = (): PolicyInput => ({
    ...form,
    key: form.key?.trim().toLowerCase(),
    name: form.name?.trim(),
    paymentMethods: methods.trim() ? methods.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean) : 'all',
    perOrder: { minFee: form.perOrder?.minFee ?? null, maxFee: form.perOrder?.maxFee ?? null },
  });

  const runPreview = useCallback(async () => {
    if (tierError) { setPvError(tierError); return; }
    setPvError(null);
    try {
      const policyObj = { ...payload() };
      delete policyObj.key;
      delete policyObj.name;
      setPreview(await billingApi.policies.preview({
        policy: policyObj, periodBasisSoFar: Number(pvSoFar) || 0, orderAmount: Number(pvAmount) || 0, fxRateToPolicyCurrency: 1,
      }));
    } catch (err) {
      setPvError(err instanceof Error ? err.message : 'Preview failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, methods, pvAmount, pvSoFar, tierError]);

  const submit = async () => {
    if (tierError) { setError(tierError); return; }
    setSaving(true); setError(null);
    try {
      const body = payload();
      if (isEdit && policy) { const rest = { ...body }; delete rest.key; await billingApi.policies.update(policy._id, rest); toast.success('Policy updated'); }
      else { await billingApi.policies.create(body); toast.success('Policy created'); }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const num = (v: string): number | null => (v === '' ? null : Number(v));

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? `Edit policy "${policy?.name}"` : 'New commission policy'}
      description="Tier thresholds and caps are in the policy currency; fees are charged in each store's currency."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!form.name?.trim() || (!isEdit && !form.key?.trim()) || !!tierError}>
            {isEdit ? 'Save changes' : 'Create policy'}
          </Button>
        </>
      }
    >
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pe-1">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Key" required><Input value={form.key ?? ''} disabled={isEdit} onChange={(e) => set('key', e.target.value)} placeholder="standard" /></Field>
          <Field label="Name" required><Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Standard" /></Field>
        </div>
        <Field label="Description"><Textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Basis">
            <Select value={form.basis} onChange={(e) => set('basis', e.target.value as PolicyInput['basis'])}>
              <option value="gmv">Sales (GMV)</option><option value="order_count">Order count</option>
            </Select>
          </Field>
          <Field label="Period">
            <Select value={form.period} onChange={(e) => set('period', e.target.value as PolicyInput['period'])}>
              <option value="calendar_month">Calendar month</option><option value="rolling_30d">Rolling 30 days</option><option value="lifetime">Lifetime</option>
            </Select>
          </Field>
          <Field label="Tier mode">
            <Select value={form.tierMode} onChange={(e) => set('tierMode', e.target.value as PolicyInput['tierMode'])}>
              <option value="marginal">Marginal (progressive)</option><option value="bracket">Bracket (whole period)</option>
            </Select>
          </Field>
          <Field label="Currency"><Input value={form.currency ?? ''} onChange={(e) => set('currency', e.target.value.toUpperCase())} maxLength={3} /></Field>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label>Tiers</Label>
            <Button size="sm" variant="ghost" type="button" onClick={() => {
              const next = tiers.map((t, i) => (i === tiers.length - 1 && t.upTo == null ? { ...t, upTo: (tiers[i - 1]?.upTo ?? 0) + 100000 } : t));
              set('tiers', [...next, { upTo: null, percent: Math.max(0, (tiers[tiers.length - 1]?.percent ?? 5) - 1), fixedPerOrder: 0 }]);
            }}><Plus className="h-3.5 w-3.5" /> Add tier</Button>
          </div>
          <div className="space-y-2">
            {tiers.map((t, i) => {
              const last = i === tiers.length - 1;
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 rounded-md border p-2">
                  <Field label={last ? 'Up to' : 'Up to'}>
                    <Input type="number" min={0} disabled={last} placeholder={last ? '∞' : ''} value={last ? '' : t.upTo ?? ''} onChange={(e) => setTier(i, { upTo: num(e.target.value) })} />
                  </Field>
                  <Field label="Percent"><Input type="number" min={0} max={100} step="0.01" value={t.percent} onChange={(e) => setTier(i, { percent: Number(e.target.value) })} /></Field>
                  <Field label="+ per order"><Input type="number" min={0} value={t.fixedPerOrder ?? 0} onChange={(e) => setTier(i, { fixedPerOrder: Number(e.target.value) || 0 })} /></Field>
                  <Button size="icon" variant="ghost" type="button" disabled={tiers.length === 1} aria-label="Remove tier" onClick={() => {
                    const next = tiers.filter((_, j) => j !== i);
                    if (next.length) next[next.length - 1] = { ...next[next.length - 1], upTo: null };
                    set('tiers', next);
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
          {tierError && <p className="mt-1 text-xs text-destructive">{tierError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Min fee / order"><Input type="number" min={0} value={form.perOrder?.minFee ?? ''} onChange={(e) => set('perOrder', { minFee: num(e.target.value), maxFee: form.perOrder?.maxFee ?? null })} placeholder="none" /></Field>
          <Field label="Max fee / order"><Input type="number" min={0} value={form.perOrder?.maxFee ?? ''} onChange={(e) => set('perOrder', { minFee: form.perOrder?.minFee ?? null, maxFee: num(e.target.value) })} placeholder="none" /></Field>
          <Field label="Period cap"><Input type="number" min={0} value={form.periodCap ?? ''} onChange={(e) => set('periodCap', num(e.target.value))} placeholder="none" /></Field>
          <Field label="Precision"><Input type="number" min={0} max={4} value={form.precision ?? 0} onChange={(e) => set('precision', Number(e.target.value) || 0)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rounding">
            <Select value={form.rounding} onChange={(e) => set('rounding', e.target.value as PolicyInput['rounding'])}>
              <option value="nearest">Nearest</option><option value="up">Up</option><option value="down">Down</option>
            </Select>
          </Field>
          <Field label="Payment methods" help="Comma-separated codes; blank = all"><Input value={methods} onChange={(e) => setMethods(e.target.value)} placeholder="all" /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive !== false} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 rounded border-input" />
          Active (assignable to plans)
        </label>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-sm font-medium">Preview</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Order amount"><Input type="number" min={0} value={pvAmount} onChange={(e) => setPvAmount(e.target.value)} /></Field>
            <Field label="Period so far"><Input type="number" min={0} value={pvSoFar} onChange={(e) => setPvSoFar(e.target.value)} /></Field>
            <div className="col-span-2 flex items-end sm:col-span-1"><Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={runPreview}>Calculate</Button></div>
          </div>
          {pvError && <p className="mt-2 text-xs text-destructive">{pvError}</p>}
          {preview && (
            <div className="mt-2 text-sm">
              Fee <strong>{formatAmount(preview.feeAmount, form.currency)}</strong> · tier {preview.tierIndex + 1} at {formatPercent(preview.percentApplied)}
              {preview.capped && <Badge variant="warning" className="ms-2">capped</Badge>}
              {preview.breakdown.length > 1 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {preview.breakdown.map((b, i) => <span key={i}>{i > 0 && ' + '}{formatAmount(b.amount, form.currency)} × {formatPercent(b.percent)}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function Field({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label>{label}{required && <span className="ms-1 text-destructive">*</span>}</Label>
      {children}
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}
