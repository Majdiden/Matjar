import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasScope, PLATFORM_SCOPES } from '../lib/api';
import {
  tenantConfigApi,
  sourceLabel,
  sourceVariant,
  fmtValue,
  LIMIT_KEYS,
  LIMIT_LABELS,
  type ConfigRow,
  type TenantConfig,
  type TenantFeatureOverride,
} from '../lib/api-programs';
import { useAuth } from '../contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Label, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageSpinner, ErrorState } from '../components/ui/Spinner';
import { useToast } from '../components/ui/toast-context';
import { formatDate } from '../lib/utils';
import { RefreshCw, SlidersHorizontal, Undo2 } from 'lucide-react';

/**
 * Store configuration inspector — every setting, flag, limit and pricing
 * value with the layer it came from (default / global / plan / program /
 * store override). Flags and limits can be overridden inline (audited,
 * reasoned, optionally time-bounded).
 */
export default function TenantConfigTab({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const canFlags = hasScope(user, PLATFORM_SCOPES.FLAGS_WRITE);
  const canLimits = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);

  const [data, setData] = useState<TenantConfig | null>(null);
  const [overrides, setOverrides] = useState<TenantFeatureOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagModal, setFlagModal] = useState<ConfigRow | null>(null);
  const [revoking, setRevoking] = useState<TenantFeatureOverride | null>(null);
  const [limitModal, setLimitModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, o] = await Promise.all([tenantConfigApi.config(tenantId), tenantConfigApi.overrides(tenantId)]);
      setData(c);
      setOverrides(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  if (!canRead) return <ErrorState error="Viewing configuration requires the support.read scope." />;
  if (loading && !data) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return null;

  const flagGroups = groupBy(data.flags, (r) => r.group.replace(/^flags:/, ''));
  const liveOverrideFor = (key: string) => overrides.find((o) => o.key === key && o.active);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Plan <code>{data.tenant.plan}</code>
          {data.tenant.programs.length > 0 && <> · Programs {data.tenant.programs.map((p) => <Badge key={p} variant="default" className="ml-1">{p}</Badge>)}</>}
          {' · '}as of {formatDate(data.generatedAt)}
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>

      <Legend />

      <Card>
        <CardHeader><CardTitle>Store settings</CardTitle><CardDescription>Merchant-controlled values. Edited by the merchant in their dashboard.</CardDescription></CardHeader>
        <CardContent className="divide-y">
          {data.settings.map((r) => <Row key={r.key} row={r} />)}
        </CardContent>
      </Card>

      {Object.entries(flagGroups).map(([group, rows]) => (
        <Card key={group}>
          <CardHeader><CardTitle>Features · {group}</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {rows.map((r) => {
              const live = liveOverrideFor(r.key);
              return (
                <Row
                  key={r.key}
                  row={r}
                  action={
                    canFlags ? (
                      live ? (
                        <Button variant="ghost" size="sm" onClick={() => setRevoking(live)} title={`Override: ${live.reason}`}><Undo2 className="h-3.5 w-3.5" /> Revoke</Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setFlagModal(r)}><SlidersHorizontal className="h-3.5 w-3.5" /> Override</Button>
                      )
                    ) : undefined
                  }
                  note={live ? `${live.reason}${live.endsAt ? ` · until ${formatDate(live.endsAt)}` : ''}` : undefined}
                />
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div><CardTitle>Limits</CardTitle><CardDescription>Not enforced yet — see the Usage tab for consumption.{data.limitOverridesReason ? ` Store override reason: ${data.limitOverridesReason}` : ''}</CardDescription></div>
          {canLimits && <Button variant="outline" size="sm" onClick={() => setLimitModal(true)}><SlidersHorizontal className="h-3.5 w-3.5" /> Override</Button>}
        </CardHeader>
        <CardContent className="divide-y">
          {data.limits.map((r) => <Row key={r.key} row={{ ...r, label: LIMIT_LABELS[r.key as keyof typeof LIMIT_LABELS] || r.label }} unlimitedNull />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pricing</CardTitle><CardDescription>Read-only summary. Edit on the <Link to={`/tenants/${tenantId}?tab=billing`} className="underline">Billing tab</Link>.</CardDescription></CardHeader>
        <CardContent className="divide-y">
          {data.pricing.map((r) => <Row key={r.key} row={r} />)}
        </CardContent>
      </Card>

      <FlagOverrideModal
        row={flagModal}
        onClose={() => setFlagModal(null)}
        onSubmit={async (value, reason, endsAt) => {
          if (!flagModal) return;
          await tenantConfigApi.createOverride(tenantId, { key: flagModal.key, value, reason, endsAt });
          toast.success('Override saved');
          setFlagModal(null);
          await load();
        }}
      />

      <ConfirmModal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={`Revoke override on ${revoking?.key ?? ''}`}
        description={`Currently forced ${revoking?.value ? 'ON' : 'OFF'} (${revoking?.reason ?? ''}). The flag falls back to the program/plan/global value.`}
        fields={[{ name: 'reason', label: 'Reason', required: true, minLength: 4 }]}
        confirmLabel="Revoke"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          if (!revoking) return;
          await tenantConfigApi.revokeOverride(tenantId, revoking._id, v.reason);
          toast.success('Override revoked');
          setRevoking(null);
          await load();
        }}
      />

      <LimitOverrideModal
        open={limitModal}
        current={data.limits}
        onClose={() => setLimitModal(false)}
        onSubmit={async (limits, reason) => {
          await tenantConfigApi.setLimitOverrides(tenantId, limits, reason);
          toast.success('Limit overrides saved');
          setLimitModal(false);
          await load();
        }}
      />
    </div>
  );
}

function groupBy<T>(rows: T[], key: (r: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) (out[key(r)] ||= []).push(r);
  return out;
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Effective value comes from:</span>
      {(['default', 'global', 'plan', 'program', 'tenant'] as const).map((s) => (
        <Badge key={s} variant={sourceVariant(s)} className="text-[10px]">{sourceLabel(s)}</Badge>
      ))}
    </div>
  );
}

function Row({ row, action, note, unlimitedNull }: { row: ConfigRow; action?: React.ReactNode; note?: string; unlimitedNull?: boolean }) {
  const eff = unlimitedNull && (row.effective === null || row.effective === undefined) ? 'Unlimited' : fmtValue(row.effective);
  const layers: Array<[string, unknown]> = [['default', row.default], ['global', row.global ?? undefined], ['plan', row.plan], ['program', row.program], ['tenant', row.tenant]].filter(
    ([, v]) => v !== null && v !== undefined
  ) as Array<[string, unknown]>;
  return (
    <div className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{row.label}</p>
          <Badge variant={sourceVariant(row.source)} className="text-[10px]">{sourceLabel(row.source)}{row.programKey && row.source === 'program' ? ` · ${row.programKey}` : ''}</Badge>
        </div>
        {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
        {note && <p className="text-xs text-amber-700">{note}</p>}
        {layers.length > 1 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {layers.map(([k, v]) => `${sourceLabel(k)}: ${k === 'default' && unlimitedNull && v == null ? 'unlimited' : fmtValue(v)}`).join(' › ')}
          </p>
        )}
        {row.all && row.all.length > 0 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{row.all.map((m) => `${m.label || m.code}${m.enabled ? ' ✓' : ' ✗'}`).join(' · ')}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        <span className="text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">{eff}</span>
        {action}
      </div>
    </div>
  );
}

function FlagOverrideModal({ row, onClose, onSubmit }: { row: ConfigRow | null; onClose: () => void; onSubmit: (value: boolean, reason: string, endsAt: string | null) => Promise<void> }) {
  const [value, setValue] = useState<'on' | 'off'>('on');
  const [reason, setReason] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (row) { setValue(row.effective ? 'off' : 'on'); setReason(''); setEndsAt(''); setError(null); setSaving(false); }
  }, [row]);
  if (!row) return null;
  const submit = async () => {
    setSaving(true); setError(null);
    try { await onSubmit(value === 'on', reason.trim(), endsAt ? new Date(`${endsAt}T23:59:59Z`).toISOString() : null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={saving ? () => {} : onClose} title={`Override ${row.label}`} description={`Currently ${fmtValue(row.effective)} via ${sourceLabel(row.source)}. A store override beats every other layer.`}
      footer={<><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={submit} loading={saving} disabled={reason.trim().length < 4}>Save override</Button></>}>
      <div className="space-y-3">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</div>}
        <div className="space-y-1.5"><Label htmlFor="fo-value">Value</Label>
          <Select id="fo-value" value={value} onChange={(e) => setValue(e.target.value as 'on' | 'off')}><option value="on">Force on</option><option value="off">Force off</option></Select></div>
        <div className="space-y-1.5"><Label htmlFor="fo-reason">Reason <span className="text-destructive">*</span></Label>
          <Textarea id="fo-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Support ticket, contract clause…" /></div>
        <div className="space-y-1.5"><Label htmlFor="fo-ends">Ends (optional)</Label>
          <Input id="fo-ends" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          <p className="text-xs text-muted-foreground">Leave blank for an open-ended override. Time-boxed overrides expire automatically.</p></div>
      </div>
    </Modal>
  );
}

function LimitOverrideModal({ open, current, onClose, onSubmit }: { open: boolean; current: ConfigRow[]; onClose: () => void; onSubmit: (limits: Record<string, number | null>, reason: string) => Promise<void> }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const v: Record<string, string> = {};
    for (const k of LIMIT_KEYS) { const r = current.find((x) => x.key === k); v[k] = r?.tenant != null ? String(r.tenant) : ''; }
    setVals(v); setReason(''); setError(null); setSaving(false);
  }, [open, current]);
  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const limits: Record<string, number | null> = {};
      for (const k of LIMIT_KEYS) {
        const raw = (vals[k] ?? '').trim();
        if (raw === '') { limits[k] = null; continue; }
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) throw new Error(`${LIMIT_LABELS[k]} must be a whole number`);
        limits[k] = n;
      }
      await onSubmit(limits, reason.trim());
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="Store limit overrides" description="Blank = inherit from program/plan. Requires tenant.lifecycle. Not enforced yet."
      footer={<><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={submit} loading={saving} disabled={reason.trim().length < 4}>Save</Button></>}>
      <div className="space-y-3">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          {LIMIT_KEYS.map((k) => {
            const r = current.find((x) => x.key === k);
            return (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`lo-${k}`}>{LIMIT_LABELS[k]}</Label>
                <Input id={`lo-${k}`} type="number" min={0} value={vals[k] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} placeholder={r?.effective != null ? `inherit (${r.effective})` : 'inherit (unlimited)'} />
              </div>
            );
          })}
        </div>
        <div className="space-y-1.5"><Label htmlFor="lo-reason">Reason <span className="text-destructive">*</span></Label>
          <Textarea id="lo-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </div>
    </Modal>
  );
}
