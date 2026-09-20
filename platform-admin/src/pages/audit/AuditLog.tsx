import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ScrollText, RefreshCw, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { auditApi, type AuditRow } from '../../lib/api-audit';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Input, Label, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../../components/ui/Spinner';
import { formatDate, shortId } from '../../lib/utils';

/**
 * Platform audit ledger — who did what to which tenant/resource, when, and
 * why. Read-only by design (the ledger is append-only server-side).
 */
export default function AuditLog() {
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.AUDIT_READ);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1', 10);
  const filters = {
    actor: searchParams.get('actor') || '',
    action: searchParams.get('action') || '',
    tenantId: searchParams.get('tenantId') || '',
    outcome: searchParams.get('outcome') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  };
  const [draft, setDraft] = useState(filters);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; pages: number } | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  useEffect(() => {
    setDraft(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const [data, acts] = await Promise.all([
        auditApi.list({
          page,
          limit: 25,
          actor: filters.actor || undefined,
          action: filters.action || undefined,
          tenantId: filters.tenantId || undefined,
          outcome: (filters.outcome as 'success' | 'failure') || undefined,
          from: filters.from ? new Date(filters.from).toISOString() : undefined,
          to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
        }),
        actions.length ? Promise.resolve(actions) : auditApi.actions().catch(() => []),
      ]);
      setRows(data.items);
      setPagination(data.pagination);
      if (!actions.length) setActions(acts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, page, filters.actor, filters.action, filters.tenantId, filters.outcome, filters.from, filters.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(draft)) if (v) next.set(k, v);
    setSearchParams(next, { replace: true });
  };

  const clear = () => setSearchParams(new URLSearchParams(), { replace: true });

  const goPage = (n: number) => {
    const next = new URLSearchParams(searchParams);
    if (n <= 1) next.delete('page');
    else next.set('page', String(n));
    setSearchParams(next, { replace: true });
  };

  const columns: DataListColumn<AuditRow>[] = [
    {
      id: 'action',
      header: 'Action',
      primary: true,
      cell: (r) => (
        <button type="button" onClick={() => setSelected(r)} className="text-left hover:underline">
          <span className="font-mono text-xs sm:text-sm">{r.action}</span>
          {r.outcome === 'failure' && (
            <Badge variant="destructive" className="ml-2 text-[10px]">failed</Badge>
          )}
        </button>
      ),
    },
    {
      id: 'actor',
      header: 'Actor',
      cell: (r) => (
        <span className="break-all text-sm">
          {r.actorEmail || (r.actorType === 'system' ? 'system' : '—')}
          {r.actorRole && <span className="ml-1 text-xs text-muted-foreground">({r.actorRole})</span>}
        </span>
      ),
    },
    {
      id: 'tenant',
      header: 'Tenant',
      cell: (r) =>
        r.tenantId ? (
          <Link to={`/tenants/${r.tenantId}`} className="text-sm hover:underline">
            {r.tenant?.name || shortId(r.tenantId)}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'resource',
      header: 'Resource',
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.resourceType || '—'}
          {r.resourceId && <span className="ml-1 font-mono">{r.resourceId.length > 12 ? shortId(r.resourceId) : r.resourceId}</span>}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      fullWidthOnMobile: true,
      cell: (r) => <span className="text-xs">{r.reason || '—'}</span>,
    },
    {
      id: 'when',
      header: 'When',
      cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>,
    },
  ];

  if (!canRead) {
    return <ErrorState error="You lack the audit.read scope." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ScrollText className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
            <p className="text-sm text-muted-foreground">
              Every operator action on the platform. Append-only; entries can be filtered but never edited.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="self-start">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <form onSubmit={apply} className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1">
          <Label htmlFor="f-actor">Actor email</Label>
          <Input id="f-actor" value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} placeholder="ops@…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-action">Action</Label>
          <Select id="f-action" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-tenant">Tenant id</Label>
          <Input id="f-tenant" value={draft.tenantId} onChange={(e) => setDraft({ ...draft, tenantId: e.target.value })} placeholder="24-hex id" className="font-mono" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-outcome">Outcome</Label>
          <Select id="f-outcome" value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}>
            <option value="">Any</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-from">From</Label>
          <Input id="f-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-to">To</Label>
          <Input id="f-to" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" size="sm" className="w-full sm:w-auto">
            <Search className="h-3.5 w-3.5" /> Apply filters
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clear} className="w-full sm:w-auto">
            Clear
          </Button>
        </div>
      </form>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <PageSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No audit entries" description="Nothing matches these filters yet." />
      ) : (
        <>
          <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />
          {pagination && pagination.pages > 1 && (
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground">
                Page {pagination.page} of {pagination.pages} · {pagination.total} entries
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => goPage(page - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.pages || loading} onClick={() => goPage(page + 1)}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.action}
        description={selected ? `${selected.actorEmail || selected.actorType} · ${formatDate(selected.createdAt)}` : undefined}
        className="max-w-3xl"
      >
        {selected && <AuditDetail row={selected} />}
      </Modal>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <pre className="max-h-64 max-w-full overflow-auto rounded-md bg-muted p-2 text-[11px] sm:text-xs">
        {value == null ? '—' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function AuditDetail({ row }: { row: AuditRow }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div><dt className="text-muted-foreground">Outcome</dt><dd className="capitalize">{row.outcome}</dd></div>
        <div><dt className="text-muted-foreground">Role</dt><dd>{row.actorRole || '—'}</dd></div>
        <div><dt className="text-muted-foreground">Tenant</dt><dd>{row.tenant?.name || row.tenantId || '—'}</dd></div>
        <div><dt className="text-muted-foreground">Resource</dt><dd className="break-all">{row.resourceType || '—'} {row.resourceId || ''}</dd></div>
        <div><dt className="text-muted-foreground">IP</dt><dd className="font-mono">{row.ip || '—'}</dd></div>
        <div><dt className="text-muted-foreground">Request</dt><dd className="break-all font-mono">{row.requestId || '—'}</dd></div>
        <div className="col-span-2"><dt className="text-muted-foreground">Reason</dt><dd>{row.reason || '—'}</dd></div>
        <div className="col-span-2"><dt className="text-muted-foreground">User agent</dt><dd className="break-all">{row.userAgent || '—'}</dd></div>
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <JsonBlock label="Before" value={row.before} />
        <JsonBlock label="After" value={row.after} />
      </div>
      {row.metadata != null && <JsonBlock label="Metadata" value={row.metadata} />}
    </div>
  );
}
