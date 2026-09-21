import { useEffect, useState } from 'react';
import { CheckSquare, X } from 'lucide-react';
import { bulkApi, allowedBulkActions, BULK_ACTION_LABEL, BULK_MAX_TENANTS, type BulkAction, type BulkParams, type BulkResponse } from '../lib/api-bulk';
import { api, type SubscriptionPlan, type TenantListRow } from '../lib/api';
import { programsApi, type AccessProgram } from '../lib/api-programs';
import { Button } from '../components/ui/Button';
import { Label, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/toast-context';
import { useAuth } from '../contexts/auth-context';

/**
 * Sticky bar shown while rows are selected on the Tenants list. Runs one of
 * the five reversible bulk actions through POST /bulk/tenants after a reason
 * and a fresh re-authentication. Per-tenant outcomes are shown afterwards so
 * a partial failure is never silent.
 */
export function TenantsBulkBar({ selected, onClear, ensureReauth, onDone }: {
  selected: TenantListRow[];
  onClear: () => void;
  ensureReauth: () => Promise<void>;
  onDone: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  // Only the actions this operator's scopes allow (server enforces the same map).
  const actions = allowedBulkActions(user);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<BulkAction>(actions[0] ?? 'suspend');
  const [reason, setReason] = useState('');
  const [programId, setProgramId] = useState('');
  const [planKey, setPlanKey] = useState('');
  const [effectiveAt, setEffectiveAt] = useState<'immediately' | 'next_period'>('next_period');
  const [programs, setPrograms] = useState<AccessProgram[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkResponse | null>(null);

  const needsProgram = action === 'add_to_program' || action === 'remove_from_program';
  const needsPlan = action === 'change_plan';
  const tooMany = selected.length > BULK_MAX_TENANTS;

  useEffect(() => {
    if (!open) return;
    if (needsProgram && programs.length === 0) {
      programsApi.list({ limit: 100, status: 'active' }).then((d) => setPrograms(d.programs)).catch(() => {});
    }
    if (needsPlan && plans.length === 0) {
      api.plans.list().then((p) => setPlans(p.filter((x) => x.isActive))).catch(() => {});
    }
  }, [open, needsProgram, needsPlan, programs.length, plans.length]);

  const canRun =
    !tooMany &&
    reason.trim().length >= 4 &&
    (!needsProgram || !!programId) &&
    (!needsPlan || !!planKey);

  const run = async () => {
    if (!canRun) return;
    setRunning(true);
    try {
      await ensureReauth();
      const params: BulkParams = {};
      if (needsProgram) params.programId = programId;
      if (needsPlan) {
        params.planKey = planKey;
        params.effectiveAt = effectiveAt;
      }
      const r = await bulkApi.tenants({ action, tenantIds: selected.map((t) => t._id), reason: reason.trim(), params });
      setResult(r);
      if (r.summary.failed === 0) toast.success(`${BULK_ACTION_LABEL[action]}: ${r.summary.ok} of ${r.summary.total} done`);
      else toast.error(`${BULK_ACTION_LABEL[action]}: ${r.summary.failed} of ${r.summary.total} failed`);
      onDone();
    } catch (err) {
      if (!(err instanceof Error && err.message === 'Cancelled')) toast.error(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setRunning(false);
    }
  };

  const close = () => {
    setOpen(false);
    if (result) {
      setResult(null);
      setReason('');
      onClear();
    }
  };

  const nameOf = (id: string) => selected.find((t) => t._id === id)?.name || id;

  return (
    <>
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <CheckSquare className="h-4 w-4 text-indigo-600" />
          <span className="font-medium">{selected.length} selected</span>
          {tooMany && <span className="text-xs text-destructive">max {BULK_MAX_TENANTS}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setOpen(true)} disabled={tooMany}>Bulk action…</Button>
          <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={running ? () => {} : close}
        title={result ? 'Bulk action result' : `Bulk action on ${selected.length} tenant${selected.length === 1 ? '' : 's'}`}
        description={
          result
            ? `${result.summary.ok} succeeded · ${result.summary.failed} failed`
            : 'Reversible actions only. Each tenant is processed one by one through the same checks as a single action, and each gets its own audit entry.'
        }
        footer={
          result ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close} disabled={running}>Cancel</Button>
              <Button onClick={run} loading={running} disabled={!canRun} variant={action === 'suspend' ? 'destructive' : 'default'}>
                {BULK_ACTION_LABEL[action]} {selected.length}
              </Button>
            </>
          )
        }
      >
        {result ? (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto text-sm">
            {result.results.map((r) => (
              <li key={r.tenantId} className="flex items-start justify-between gap-2 rounded border px-2 py-1">
                <span className="min-w-0 truncate">{nameOf(r.tenantId)}</span>
                {r.ok ? <span className="shrink-0 text-xs text-emerald-600">done</span> : <span className="shrink-0 text-end text-xs text-destructive">{r.error}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label htmlFor="bulk-action">Action</Label>
              <Select id="bulk-action" value={action} onChange={(e) => setAction(e.target.value as BulkAction)}>
                {actions.map((a) => (
                  <option key={a} value={a}>{BULK_ACTION_LABEL[a]}</option>
                ))}
              </Select>
            </div>
            {needsProgram && (
              <div className="space-y-1">
                <Label htmlFor="bulk-program">Program</Label>
                <Select id="bulk-program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                  <option value="">Choose a program</option>
                  {programs.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} ({p.key})</option>
                  ))}
                </Select>
              </div>
            )}
            {needsPlan && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="bulk-plan">Plan</Label>
                  <Select id="bulk-plan" value={planKey} onChange={(e) => setPlanKey(e.target.value)}>
                    <option value="">Choose a plan</option>
                    {plans.map((p) => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bulk-effective">Effective</Label>
                  <Select id="bulk-effective" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value as 'immediately' | 'next_period')}>
                    <option value="next_period">Next period</option>
                    <option value="immediately">Immediately</option>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="bulk-reason">Reason</Label>
              <Textarea id="bulk-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (audit log, ≥ 4 chars)" className="min-h-[60px]" />
            </div>
            <div className="rounded-md border p-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Tenants</div>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
                {selected.map((t) => (
                  <li key={t._id} className="truncate">{t.name} <span className="text-muted-foreground">· {t.email}</span></li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
