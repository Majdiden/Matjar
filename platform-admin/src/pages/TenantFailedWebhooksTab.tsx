import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { DataList, type DataListColumn } from '../components/ui/DataList';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { PageSpinner, EmptyState, ErrorState } from '../components/ui/Spinner';
import { formatDate, shortId } from '../lib/utils';
import { Eye, RefreshCw } from 'lucide-react';

interface WebhookDeliveryRow {
  _id: string;
  webhookId?: string;
  event?: string;
  url?: string;
  status?: string;
  responseStatusCode?: number | null;
  responseBody?: string | null;
  attempts?: number;
  nextRetryAt?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt?: string;
  payload?: unknown;
}

export default function TenantFailedWebhooksTab({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<WebhookDeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WebhookDeliveryRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.tenants.listFailedWebhooks(tenantId);
      setRows(data as WebhookDeliveryRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load failed webhooks');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: DataListColumn<WebhookDeliveryRow>[] = [
    { id: 'event', header: 'Event', primary: true, cell: (r) => <Badge variant="outline">{r.event || '—'}</Badge> },
    {
      id: 'url',
      header: 'URL',
      fullWidthOnMobile: true,
      className: 'max-w-[320px] truncate font-mono text-xs',
      cell: (r) => <span className="break-all font-mono text-xs" title={r.url}>{r.url || '—'}</span>,
    },
    { id: 'http', header: 'HTTP', cell: (r) => <span className="text-xs">{r.responseStatusCode ?? '—'}</span> },
    { id: 'attempts', header: 'Attempts', cell: (r) => <span className="text-xs">{r.attempts ?? '—'}</span> },
    {
      id: 'error',
      header: 'Last error',
      fullWidthOnMobile: true,
      className: 'max-w-[280px] truncate text-xs text-destructive/90',
      cell: (r) => <span className="line-clamp-3 break-words text-xs text-destructive/90 md:line-clamp-none" title={r.error || ''}>{r.error || '—'}</span>,
    },
    { id: 'tried', header: 'Last tried', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.updatedAt || r.createdAt)}</span> },
    {
      id: 'actions',
      align: 'end',
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setSelected(r)} aria-label="View delivery">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="min-w-0 text-sm text-muted-foreground">
          Webhook deliveries that exhausted their retry budget. Tenants fix these by editing the
          webhook target URL or secret in their dashboard; this page is read-only and cross-tenant.
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="shrink-0 self-start">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <PageSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No failed deliveries" description="All webhook deliveries for this tenant have succeeded." />
      ) : (
        <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Failed delivery"
        description={selected ? shortId(selected._id) : undefined}
        className="max-w-3xl"
      >
        {selected && (
          <pre className="max-h-[60vh] max-w-full overflow-auto rounded-md bg-muted p-3 text-[11px] sm:text-xs">
            {JSON.stringify(selected, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
  );
}
