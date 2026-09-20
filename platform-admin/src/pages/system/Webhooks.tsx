import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, RotateCcw, Eye } from 'lucide-react';
import { systemApi, type WebhookDeliveryRow, type WebhookDeliveryDetail } from '../../lib/api-system';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Label, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatDate, shortId } from '../../lib/utils';
import { OBJECT_ID, parsePage, allowed, makeSetParam } from '../../lib/list-helpers';
import { Pagination } from '../../components/ui/Pagination';
import { SystemShell } from './SystemShell';

const STATUSES = ['failed', 'success'] as const;

/** Cross-tenant webhook delivery inspector (redacted payloads, retry). */
export default function Webhooks() {
  const { user } = useAuth();
  const toast = useToast();
  const canRetry = hasScope(user, PLATFORM_SCOPES.QUEUE_RETRY);
  const [searchParams, setSearchParams] = useSearchParams();

  const status = allowed(searchParams.get('status'), STATUSES);
  const rawTenant = searchParams.get('tenantId') || '';
  const tenantId = OBJECT_ID.test(rawTenant) ? rawTenant : '';
  const event = searchParams.get('event') || '';
  const page = parsePage(searchParams.get('page'));
  const setParam = makeSetParam(searchParams, setSearchParams);

  const [rows, setRows] = useState<WebhookDeliveryRow[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WebhookDeliveryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retrying, setRetrying] = useState<WebhookDeliveryRow | null>(null);
  const [tenantDraft, setTenantDraft] = useState(tenantId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, evs] = await Promise.all([
        systemApi.webhooks.list({
          page,
          limit: 25,
          status: status || undefined,
          tenantId: tenantId || undefined,
          event: event || undefined,
        }),
        systemApi.webhooks.events().catch(() => []),
      ]);
      setRows(data.items);
      setPagination(data.pagination);
      setEvents(evs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [page, status, tenantId, event]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (r: WebhookDeliveryRow) => {
    setDetailLoading(true);
    setSelected({ ...r });
    try {
      setSelected(await systemApi.webhooks.get(r.tenantId, r._id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load delivery');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: DataListColumn<WebhookDeliveryRow>[] = [
    {
      id: 'event',
      header: 'Event',
      primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <Badge variant="outline">{r.event}</Badge>
          <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={r.url}>
            {r.url}
          </div>
        </div>
      ),
    },
    {
      id: 'tenant',
      header: 'Store',
      cell: (r) =>
        r.tenant ? (
          <Link to={`/tenants/${r.tenantId}`} className="text-sm hover:underline">
            {r.tenant.name}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">{shortId(r.tenantId)}</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={r.status === 'success' ? 'success' : 'destructive'}>{r.status}</Badge>
          {r.responseStatus != null && <span className="text-xs text-muted-foreground">HTTP {r.responseStatus}</span>}
          {r.retryOf && <Badge variant="secondary" className="text-[10px]">retry</Badge>}
        </div>
      ),
    },
    { id: 'error', header: 'Error', hideOnMobile: true, cell: (r) => <span className="text-xs text-destructive/90">{r.error || '—'}</span> },
    { id: 'when', header: 'When', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
    {
      id: 'actions',
      cell: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => open(r)} aria-label="Inspect">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {canRetry && (
            <Button variant="outline" size="sm" onClick={() => setRetrying(r)}>
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <SystemShell
      title="System"
      description="Every webhook delivery attempt across all stores (last 30 days). Payloads are redacted."
      actions={
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="wh-status">Status</Label>
          <Select id="wh-status" value={status} onChange={(e) => setParam('status', e.target.value || null)}>
            <option value="">All</option>
            <option value="failed">Failed</option>
            <option value="success">Success</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="wh-event">Event</Label>
          <Select id="wh-event" value={event} onChange={(e) => setParam('event', e.target.value || null)}>
            <option value="">All</option>
            {events.map((ev) => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="wh-tenant">Tenant id</Label>
          <Input
            id="wh-tenant"
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
        <EmptyState title="No deliveries" description="No webhook deliveries match these filters." />
      ) : (
        <>
          <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />
          {pagination && <Pagination page={page} pages={pagination.pages} total={pagination.total} loading={loading} onPage={(p) => setParam('page', String(p))} />}
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Delivery ${shortId(selected._id)}` : ''}
        description={selected ? `${selected.event} → ${selected.url}` : undefined}
        className="max-w-3xl"
      >
        {detailLoading ? (
          <PageSpinner />
        ) : selected ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Kv k="Status" v={`${selected.status}${selected.responseStatus != null ? ` (HTTP ${selected.responseStatus})` : ''}`} />
              <Kv k="Duration" v={selected.durationMs != null ? `${selected.durationMs} ms` : '—'} />
              <Kv k="Attempt" v={String(selected.attempt ?? 1)} />
              <Kv k="When" v={formatDate(selected.createdAt)} />
              {selected.error && <Kv k="Error" v={selected.error} wide />}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Payload (redacted)</div>
              <pre className="max-h-[50vh] max-w-full overflow-auto rounded-md bg-muted p-3 text-[11px] sm:text-xs">
                {JSON.stringify(selected.payload ?? null, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={!!retrying}
        onClose={() => setRetrying(null)}
        title="Re-send this delivery?"
        description="The original payload is signed and POSTed again to the merchant's endpoint. Their system will receive the event a second time — only retry when they expect it."
        confirmLabel="Re-send"
        onConfirm={async () => {
          if (!retrying) return;
          try {
            const out = await systemApi.webhooks.retry(retrying.tenantId, retrying._id);
            if (out.result.success) toast.success(`Delivered (HTTP ${out.result.status})`);
            else toast.error(`Endpoint rejected the delivery${out.result.status ? ` (HTTP ${out.result.status})` : ''}`);
            await load();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Retry failed');
            throw err;
          }
        }}
      />
    </SystemShell>
  );
}

function Kv({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="text-muted-foreground">{k}</div>
      <div className="[overflow-wrap:anywhere]">{v}</div>
    </div>
  );
}
