import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  incidentsApi,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
} from '../../lib/api-incidents';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Label, Select, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatDate, shortId } from '../../lib/utils';
import { severityVariant, statusVariant } from './badges';

/** Incident sheet: metadata, timeline, add update, edit severity/owner, resolve. */
export function IncidentDetail({ id, canWrite, onClose, onChanged }: {
  id: string;
  canWrite: boolean;
  onClose: () => void;
  onChanged: (i: Incident) => void;
}) {
  const toast = useToast();
  const [inc, setInc] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [text, setText] = useState('');
  const [nextStatus, setNextStatus] = useState<IncidentStatus | ''>('');
  const [severity, setSeverity] = useState<IncidentSeverity>('sev3');
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const data = await incidentsApi.get(id);
      setInc(data);
      setSeverity(data.severity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incident');
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const apply = (updated: Incident, msg: string) => {
    setInc(updated);
    setSeverity(updated.severity);
    toast.success(msg);
    onChanged(updated);
  };

  const addUpdate = async () => {
    if (!inc || !text.trim()) return;
    setSaving(true);
    try {
      apply(await incidentsApi.addTimeline(inc.id, { text: text.trim(), status: nextStatus || undefined }), 'Update posted');
      setText('');
      setNextStatus('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post update');
    } finally {
      setSaving(false);
    }
  };

  const saveSeverity = async () => {
    if (!inc || severity === inc.severity || reason.trim().length < 4) return;
    setSaving(true);
    try {
      apply(await incidentsApi.update(inc.id, { severity, reason: reason.trim() }), 'Severity updated');
      setReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const resolve = async () => {
    if (!inc || resolution.trim().length < 4) return;
    setSaving(true);
    try {
      apply(await incidentsApi.resolve(inc.id, { resolutionNotes: resolution.trim() }), 'Incident resolved');
      setResolving(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setSaving(false);
    }
  };

  const open = inc ? inc.status !== 'resolved' : false;

  return (
    <Modal
      open
      onClose={onClose}
      title={inc?.title || 'Incident'}
      description={inc ? `Opened by ${inc.createdByEmail || 'operator'} · ${formatDate(inc.createdAt)}` : undefined}
      className="max-w-2xl"
    >
      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : !inc ? (
        <PageSpinner />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={severityVariant(inc.severity)}>{SEVERITY_LABEL[inc.severity]}</Badge>
            <Badge variant={statusVariant(inc.status)}>{STATUS_LABEL[inc.status]}</Badge>
            <span className="text-xs text-muted-foreground">Owner: {inc.ownerEmail || '—'}</span>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>Started: {formatDate(inc.startedAt)}</div>
            <div>Detected: {inc.detectedAt ? formatDate(inc.detectedAt) : '—'}</div>
            <div>Resolved: {inc.resolvedAt ? formatDate(inc.resolvedAt) : '—'}</div>
            <div>Services: {inc.affectedServices.length ? inc.affectedServices.join(', ') : '—'}</div>
            {inc.affectedTenantIds.length > 0 && (
              <div className="sm:col-span-2">
                Stores ({inc.affectedTenantIds.length}):{' '}
                {inc.affectedTenantIds.slice(0, 20).map((t) => (
                  <Link key={t} to={`/tenants/${t}`} className="me-2 font-mono underline">{shortId(t)}</Link>
                ))}
                {inc.affectedTenantIds.length > 20 && `+${inc.affectedTenantIds.length - 20} more`}
              </div>
            )}
          </div>

          {inc.resolutionNotes && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="mb-1 font-medium">Resolution</div>
              <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{inc.resolutionNotes}</div>
            </div>
          )}

          <div className="rounded-md border p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Timeline</div>
            {inc.timeline.length ? (
              <ol className="space-y-2">
                {[...inc.timeline].reverse().map((e) => (
                  <li key={e.id} className="text-xs">
                    <div className="text-muted-foreground">
                      {formatDate(e.at)} · {e.byEmail || 'operator'}
                      {e.status && <> · <Badge variant={statusVariant(e.status)}>{STATUS_LABEL[e.status]}</Badge></>}
                    </div>
                    <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{e.text}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">No updates yet.</p>
            )}
            {canWrite && open && (
              <div className="mt-3 space-y-2">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Post an update" className="min-h-[60px]" />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as IncidentStatus | '')} className="sm:max-w-xs">
                    <option value="">Keep status ({STATUS_LABEL[inc.status]})</option>
                    {INCIDENT_STATUSES.filter((s) => s !== 'resolved' && s !== inc.status).map((s) => (
                      <option key={s} value={s}>Move to {STATUS_LABEL[s]}</option>
                    ))}
                  </Select>
                  <Button size="sm" onClick={addUpdate} loading={saving} disabled={!text.trim()}>Post update</Button>
                </div>
              </div>
            )}
          </div>

          {canWrite && open && (
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Severity</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
                  {INCIDENT_SEVERITIES.map((s) => (
                    <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
                  ))}
                </Select>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (audit, ≥ 4 chars)" />
              </div>
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="outline" onClick={saveSeverity} loading={saving} disabled={severity === inc.severity || reason.trim().length < 4}>
                  Save severity
                </Button>
              </div>
            </div>
          )}

          {canWrite && open && (
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Resolve</div>
              {resolving ? (
                <div className="space-y-2">
                  <Label htmlFor="inc-resolution">Resolution notes (what happened, what fixed it)</Label>
                  <Textarea id="inc-resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} className="min-h-[80px]" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setResolving(false)} disabled={saving}>Cancel</Button>
                    <Button size="sm" onClick={resolve} loading={saving} disabled={resolution.trim().length < 4}>Mark resolved</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Resolving is final; a resolved incident cannot be reopened.</p>
                  <Button size="sm" onClick={() => setResolving(true)}>Resolve…</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
