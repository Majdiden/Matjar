import { useEffect, useState } from 'react';
import { CheckSquare, Download, Skull, X } from 'lucide-react';
import {
  bulkApi,
  allowedBulkActions,
  BULK_ACTION_LABEL,
  BULK_DESTRUCTIVE,
  BULK_MAX_GRACE_DAYS,
  BULK_MAX_TENANTS,
  BULK_MIN_GRACE_DAYS,
  type BulkAction,
  type BulkParams,
  type BulkResponse,
} from '../lib/api-bulk';
import { api, hasScope, PLATFORM_SCOPES, type SubscriptionPlan, type TenantListRow } from '../lib/api';
import { TenantsBulkDeleteModal } from './TenantsBulkDeleteModal';
import { programsApi, type AccessProgram } from '../lib/api-programs';
import { Button } from '../components/ui/Button';
import { Input, Label, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/toast-context';
import { useAuth } from '../contexts/auth-context';

const CSV_COLUMNS: [string, (t: TenantListRow) => string | null | undefined][] = [
  ['name', (t) => t.name],
  ['slug', (t) => t.slug],
  ['email', (t) => t.email],
  ['phone', (t) => t.phone],
  ['domain', (t) => t.domains?.primary || t.domains?.customDomain || t.domains?.subdomain],
  ['plan', (t) => t.subscriptionPlan],
  ['subscription_status', (t) => t.subscriptionStatus],
  ['lifecycle', (t) => t.lifecycle?.state],
  ['deletion_scheduled_at', (t) => t.deletionScheduledAt],
  ['created_at', (t) => t.createdAt],
];

const csvCell = (v: string | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** Download the selected rows as CSV — client-side, from data already on screen. */
function exportCsv(rows: TenantListRow[]) {
  const lines = [CSV_COLUMNS.map(([h]) => h).join(','), ...rows.map((t) => CSV_COLUMNS.map(([, get]) => csvCell(get(t))).join(','))];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Bar pinned to the bottom of the viewport while rows are selected on the
 * Tenants list. Runs one of the reversible bulk actions through POST
 * /bulk/tenants after a reason and a fresh re-authentication. Per-tenant
 * outcomes are shown afterwards so a partial failure is never silent.
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
  // Permanent deletion is separate from the reversible actions (own scope + modal).
  const canDeletePermanently = hasScope(user, PLATFORM_SCOPES.TENANT_DELETE);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<BulkAction>(actions[0] ?? 'suspend');
  const [reason, setReason] = useState('');
  const [programId, setProgramId] = useState('');
  const [planKey, setPlanKey] = useState('');
  const [effectiveAt, setEffectiveAt] = useState<'immediately' | 'next_period'>('next_period');
  const [graceDays, setGraceDays] = useState('');
  const [programs, setPrograms] = useState<AccessProgram[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkResponse | null>(null);

  const needsProgram = action === 'add_to_program' || action === 'remove_from_program';
  const needsPlan = action === 'change_plan';
  const needsGrace = action === 'schedule_deletion';
  const graceNum = Number(graceDays);
  const graceValid =
    graceDays.trim() === '' || (Number.isInteger(graceNum) && graceNum >= BULK_MIN_GRACE_DAYS && graceNum <= BULK_MAX_GRACE_DAYS);
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
    (!needsPlan || !!planKey) &&
    (!needsGrace || graceValid);

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
      if (needsGrace && graceDays.trim()) params.graceDays = graceNum;
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
      {/* Pinned to the viewport (above the mobile tab bar; beside the md+ sidebar,
          which is w-60) and aligned with the page's max-w-7xl content column. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 md:start-60 md:bottom-4 md:px-6">
        <div className="pointer-events-auto mx-auto flex max-w-[calc(80rem-3rem)] flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2 text-sm">
            <CheckSquare className="h-4 w-4 text-indigo-600" />
            <span className="font-medium">{selected.length} selected</span>
            {tooMany && <span className="text-xs text-destructive">max {BULK_MAX_TENANTS}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => exportCsv(selected)}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} disabled={tooMany || actions.length === 0}>Bulk action…</Button>
            {canDeletePermanently && (
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)} title="Delete permanently">
                <Skull className="h-4 w-4" />
                <span className="hidden sm:inline">Delete…</span>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <TenantsBulkDeleteModal
        open={deleteOpen}
        selected={selected}
        onClose={() => setDeleteOpen(false)}
        onDone={() => {
          onClear();
          onDone();
        }}
      />

      <Modal
        open={open}
        onClose={running ? () => {} : close}
        title={result ? 'Bulk action result' : `Bulk action on ${selected.length} tenant${selected.length === 1 ? '' : 's'}`}
        description={
          result
            ? `${result.summary.ok} succeeded · ${result.summary.failed} failed`
            : 'Reversible actions only — a scheduled deletion can be cancelled until its grace period ends. Each tenant is processed one by one through the same checks as a single action, and each gets its own audit entry.'
        }
        footer={
          result ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close} disabled={running}>Cancel</Button>
              <Button onClick={run} loading={running} disabled={!canRun} variant={BULK_DESTRUCTIVE.has(action) ? 'destructive' : 'default'}>
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
            {needsGrace && (
              <div className="space-y-1">
                <Label htmlFor="bulk-grace">Grace period (days)</Label>
                <Input
                  id="bulk-grace"
                  type="number"
                  inputMode="numeric"
                  min={BULK_MIN_GRACE_DAYS}
                  max={BULK_MAX_GRACE_DAYS}
                  value={graceDays}
                  onChange={(e) => setGraceDays(e.target.value)}
                  placeholder="Leave blank for platform default"
                />
                <p className={`text-xs ${graceValid ? 'text-muted-foreground' : 'text-destructive'}`}>
                  {BULK_MIN_GRACE_DAYS}–{BULK_MAX_GRACE_DAYS} days. Stores close now and are purged once the grace period ends unless the deletion is cancelled.
                </p>
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
