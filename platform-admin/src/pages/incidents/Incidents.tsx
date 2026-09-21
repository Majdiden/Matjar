import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Siren, Plus, RefreshCw } from 'lucide-react';
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
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Label, Select } from '../../components/ui/Input';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { formatDate, formatRelative } from '../../lib/utils';
import { parsePage, allowed, makeSetParam } from '../../lib/list-helpers';
import { IncidentFormModal } from './IncidentFormModal';
import { IncidentDetail } from './IncidentDetail';
import { severityVariant, statusVariant } from './badges';

/** Incident register: open incidents first, timeline + resolution per incident. */
export default function Incidents() {
  const { user } = useAuth();
  const canWrite = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);
  const [searchParams, setSearchParams] = useSearchParams();

  const status: IncidentStatus | '' = allowed(searchParams.get('status'), INCIDENT_STATUSES);
  const severity: IncidentSeverity | '' = allowed(searchParams.get('severity'), INCIDENT_SEVERITIES);
  const openOnly = searchParams.get('open') === '1';
  const page = parsePage(searchParams.get('page'));
  const setParam = makeSetParam(searchParams, setSearchParams);

  const [rows, setRows] = useState<Incident[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await incidentsApi.list({
        page,
        limit: 25,
        status: status || undefined,
        severity: severity || undefined,
        // Server rejects status+open together; an explicit status wins.
        open: openOnly && !status ? '1' : undefined,
      });
      setRows(data.incidents);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, [page, status, severity, openOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataListColumn<Incident>[] = [
    {
      id: 'title',
      header: 'Incident',
      primary: true,
      cell: (r) => (
        <button type="button" className="text-start" onClick={() => setSelectedId(r.id)}>
          <div className="font-medium hover:underline">{r.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {r.affectedServices.length ? r.affectedServices.join(', ') : 'No services tagged'}
            {r.affectedTenantCount > 0 && ` · ${r.affectedTenantCount} store${r.affectedTenantCount === 1 ? '' : 's'}`}
          </div>
        </button>
      ),
    },
    { id: 'severity', header: 'Severity', cell: (r) => <Badge variant={severityVariant(r.severity)}>{SEVERITY_LABEL[r.severity]}</Badge> },
    { id: 'status', header: 'Status', cell: (r) => <Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge> },
    { id: 'owner', header: 'Owner', hideOnMobile: true, cell: (r) => <span className="text-xs">{r.ownerEmail || '—'}</span> },
    {
      id: 'started',
      header: 'Started',
      cell: (r) => (
        <span className="text-xs text-muted-foreground" title={formatDate(r.startedAt)}>
          {formatRelative(r.startedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Siren className="mt-1 h-6 w-6 shrink-0 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
            <p className="text-sm text-muted-foreground">
              Platform incidents with an owner, a timeline and a resolution. Internal only; nothing here is shown to merchants.
              {!canWrite && ' (read-only — you lack the tenant.lifecycle scope)'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> Open incident
            </Button>
          )}
        </div>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto whitespace-nowrap px-1 scrollbar-hide">
        <button
          type="button"
          onClick={() => {
            setParam('open', null);
            setParam('status', null);
          }}
          className={`rounded-full border px-3 py-1 text-xs ${!openOnly && !status ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => {
            setParam('status', null);
            setParam('open', '1');
          }}
          className={`rounded-full border px-3 py-1 text-xs ${openOnly ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
        >
          Open
        </button>
        {INCIDENT_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setParam('open', null);
              setParam('status', s);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${status === s ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:max-w-xs">
        <div className="space-y-1">
          <Label htmlFor="inc-sev">Severity</Label>
          <Select id="inc-sev" value={severity} onChange={(e) => setParam('severity', e.target.value || null)}>
            <option value="">All severities</option>
            {INCIDENT_SEVERITIES.map((s) => (
              <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
            ))}
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <PageSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No incidents" description="Nothing matches these filters." />
      ) : (
        <>
          <DataList columns={columns} rows={rows} rowKey={(r) => r.id} />
          {pagination && <Pagination page={page} pages={pagination.pages} total={pagination.total} loading={loading} onPage={(p) => setParam('page', String(p))} />}
        </>
      )}

      {creating && (
        <IncidentFormModal
          onClose={() => setCreating(false)}
          onCreated={(inc) => {
            setCreating(false);
            setSelectedId(inc.id);
            void load();
          }}
        />
      )}

      {selectedId && (
        <IncidentDetail
          id={selectedId}
          canWrite={canWrite}
          onClose={() => {
            setSelectedId(null);
            if (searchParams.get('id')) setParam('id', null);
          }}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}
