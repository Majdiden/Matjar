import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, RefreshCw } from 'lucide-react';
import {
  feedbackApi,
  FEEDBACK_TYPES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_STATUS_LABEL,
  type FeedbackRow,
  type FeedbackStatus,
  type FeedbackType,
} from '../../lib/api-feedback';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Label, Select, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatDate, formatRelative } from '../../lib/utils';
import { OBJECT_ID, parsePage, allowed, makeSetParam, attachmentLink } from '../../lib/list-helpers';
import { Pagination } from '../../components/ui/Pagination';

function statusVariant(s: FeedbackStatus): React.ComponentProps<typeof Badge>['variant'] {
  if (s === 'resolved') return 'success';
  if (s === 'wont_fix') return 'outline';
  if (s === 'open') return 'warning';
  return 'secondary';
}

/** Merchant → platform feedback queue with triage (status, notes). */
export default function Feedback() {
  const { user } = useAuth();
  const toast = useToast();
  const canTriage = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);
  const [searchParams, setSearchParams] = useSearchParams();

  const type: FeedbackType | '' = allowed(searchParams.get('type'), FEEDBACK_TYPES);
  const status: FeedbackStatus | '' = allowed(searchParams.get('status'), FEEDBACK_STATUSES);
  const rawTenant = searchParams.get('tenantId') || '';
  const tenantId = OBJECT_ID.test(rawTenant) ? rawTenant : '';
  const page = parsePage(searchParams.get('page'));
  const setParam = makeSetParam(searchParams, setSearchParams);

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [counts, setCounts] = useState<Partial<Record<FeedbackStatus, number>>>({});
  const [pagination, setPagination] = useState<{ total: number; page: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeedbackRow | null>(null);
  const [tenantDraft, setTenantDraft] = useState(tenantId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await feedbackApi.list({ page, limit: 25, type: type || undefined, status: status || undefined, tenantId: tenantId || undefined });
      setRows(data.items);
      setCounts(data.counts);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [page, type, status, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (r: FeedbackRow) => {
    setSelected(r);
    try {
      setSelected(await feedbackApi.get(r._id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load feedback');
    }
  };

  const columns: DataListColumn<FeedbackRow>[] = [
    {
      id: 'subject',
      header: 'Feedback',
      primary: true,
      cell: (r) => (
        <button type="button" className="text-start" onClick={() => openDetail(r)}>
          <div className="font-medium hover:underline">{r.subject}</div>
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.message}</div>
        </button>
      ),
    },
    { id: 'type', header: 'Type', cell: (r) => <Badge variant="outline">{FEEDBACK_TYPE_LABEL[r.type]}</Badge> },
    { id: 'status', header: 'Status', cell: (r) => <Badge variant={statusVariant(r.status)}>{FEEDBACK_STATUS_LABEL[r.status]}</Badge> },
    {
      id: 'tenant',
      header: 'Store',
      cell: (r) =>
        r.tenant ? (
          <Link to={`/tenants/${r.tenantId}`} className="text-sm hover:underline">
            {r.tenant.name}
          </Link>
        ) : (
          '—'
        ),
    },
    { id: 'from', header: 'From', hideOnMobile: true, cell: (r) => <span className="text-xs">{r.userEmail || '—'}</span> },
    { id: 'when', header: 'Received', cell: (r) => <span className="text-xs text-muted-foreground" title={formatDate(r.createdAt)}>{formatRelative(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
            <p className="text-sm text-muted-foreground">
              What merchants tell us from their dashboard. Triage here; internal notes are never shown to merchants.
              {!canTriage && ' (read-only — you lack the tenant.lifecycle scope)'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto whitespace-nowrap px-1 scrollbar-hide">
        <button
          type="button"
          onClick={() => setParam('status', null)}
          className={`rounded-full border px-3 py-1 text-xs ${!status ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
        >
          All {Object.values(counts).reduce((n, c) => n + (c || 0), 0)}
        </button>
        {FEEDBACK_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setParam('status', s)}
            className={`rounded-full border px-3 py-1 text-xs ${status === s ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            {FEEDBACK_STATUS_LABEL[s]} {counts[s] || 0}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="fb-type">Type</Label>
          <Select id="fb-type" value={type} onChange={(e) => setParam('type', e.target.value || null)}>
            <option value="">All types</option>
            {FEEDBACK_TYPES.map((t) => (
              <option key={t} value={t}>{FEEDBACK_TYPE_LABEL[t]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fb-tenant">Tenant id</Label>
          <Input
            id="fb-tenant"
            value={tenantDraft}
            placeholder="24-hex id"
            onChange={(e) => setTenantDraft(e.target.value.trim())}
            onBlur={() => setParam('tenantId', OBJECT_ID.test(tenantDraft) ? tenantDraft : null)}
          />
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <PageSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No feedback" description="Nothing matches these filters." />
      ) : (
        <>
          <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />
          {pagination && <Pagination page={page} pages={pagination.pages} total={pagination.total} loading={loading} onPage={(p) => setParam('page', String(p))} />}
        </>
      )}

      {selected && (
        <FeedbackDetail
          item={selected}
          canTriage={canTriage}
          onClose={() => setSelected(null)}
          onChanged={(updated) => {
            setSelected(updated);
            setRows((prev) => prev.map((r) => (r._id === updated._id ? { ...r, ...updated, internalNotes: undefined } : r)));
            void load();
          }}
        />
      )}
    </div>
  );
}

function FeedbackDetail({ item, canTriage, onClose, onChanged }: {
  item: FeedbackRow;
  canTriage: boolean;
  onClose: () => void;
  onChanged: (f: FeedbackRow) => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<FeedbackStatus>(item.status);
  const [resolution, setResolution] = useState(item.resolution || '');
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(item.status);
    setResolution(item.resolution || '');
  }, [item._id, item.status, item.resolution]);

  const dirty = status !== item.status || (resolution || '') !== (item.resolution || '');

  const saveStatus = async () => {
    setSaving(true);
    try {
      const updated = await feedbackApi.updateStatus(item._id, {
        status,
        resolution: resolution.trim(),
        reason: reason.trim().length >= 3 ? reason.trim() : undefined,
        notifyMerchant: notify,
      });
      toast.success('Status updated');
      setReason('');
      onChanged(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const updated = await feedbackApi.addNote(item._id, note.trim());
      setNote('');
      toast.success('Note added');
      onChanged(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={item.subject} description={`${FEEDBACK_TYPE_LABEL[item.type]} · ${item.tenant?.name || 'store'} · ${item.userEmail || 'unknown user'}`} className="max-w-2xl">
      <div className="space-y-4 text-sm">
        <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 [overflow-wrap:anywhere]">{item.message}</div>
        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>Page: <span className="font-mono">{item.page || '—'}</span></div>
          <div>Received: {formatDate(item.createdAt)}</div>
          <div className="sm:col-span-2 [overflow-wrap:anywhere]">Browser: {item.browser || '—'}</div>
          {item.attachments?.length > 0 && (
            <div className="sm:col-span-2">
              Attachments:{' '}
              {item.attachments.map((a, i) => {
                const l = attachmentLink(a);
                return (
                  <a key={i} href={l.href} target="_blank" rel="noreferrer" className="me-2 underline [overflow-wrap:anywhere]">
                    {l.label}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Status</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select value={status} disabled={!canTriage} onChange={(e) => setStatus(e.target.value as FeedbackStatus)}>
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s} value={s}>{FEEDBACK_STATUS_LABEL[s]}</option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={notify} disabled={!canTriage} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Email the merchant (resolved / planned / won't fix)
            </label>
          </div>
          <div className="mt-2 space-y-1">
            <Label htmlFor="fb-res">Resolution (visible to the merchant)</Label>
            <Textarea id="fb-res" value={resolution} disabled={!canTriage} onChange={(e) => setResolution(e.target.value)} placeholder="What was done, or why not." />
          </div>
          <div className="mt-2 space-y-1">
            <Label htmlFor="fb-reason">Reason (audit log only)</Label>
            <Input id="fb-reason" value={reason} disabled={!canTriage} onChange={(e) => setReason(e.target.value)} placeholder="Optional, ≥ 3 chars" />
          </div>
          {canTriage && (
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={saveStatus} loading={saving} disabled={!dirty}>
                Save status
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Internal notes</div>
          {item.internalNotes?.length ? (
            <ul className="space-y-2">
              {item.internalNotes.map((n) => (
                <li key={n._id} className="text-xs">
                  <div className="text-muted-foreground">{n.byEmail || 'operator'} · {formatDate(n.at)}</div>
                  <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{n.text}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No notes yet.</p>
          )}
          {canTriage && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note" className="min-h-[60px]" />
              <Button size="sm" onClick={addNote} loading={saving} disabled={!note.trim()} className="sm:self-end">
                Add note
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
