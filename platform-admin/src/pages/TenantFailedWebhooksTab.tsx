import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table';
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Webhook deliveries that exhausted their retry budget. Tenants fix these by editing the
          webhook target URL or secret in their dashboard; this page is read-only and cross-tenant.
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
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
        <div className="rounded-lg border bg-card">
          <Table>
            <THead>
              <TR>
                <TH>Event</TH>
                <TH>URL</TH>
                <TH>HTTP</TH>
                <TH>Attempts</TH>
                <TH>Last error</TH>
                <TH>Last tried</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r._id}>
                  <TD>
                    <Badge variant="outline">{r.event || '—'}</Badge>
                  </TD>
                  <TD className="max-w-[320px] truncate font-mono text-xs" title={r.url}>
                    {r.url || '—'}
                  </TD>
                  <TD className="text-xs">{r.responseStatusCode ?? '—'}</TD>
                  <TD className="text-xs">{r.attempts ?? '—'}</TD>
                  <TD className="max-w-[280px] truncate text-xs text-destructive/90" title={r.error || ''}>
                    {r.error || '—'}
                  </TD>
                  <TD className="text-xs text-muted-foreground">{formatDate(r.updatedAt || r.createdAt)}</TD>
                  <TD>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Failed delivery"
        description={selected ? shortId(selected._id) : undefined}
        className="max-w-3xl"
      >
        {selected && (
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(selected, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
  );
}
