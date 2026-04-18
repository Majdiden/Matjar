import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ErrorState } from '../components/ui/Spinner';
import { useToast } from '../components/ui/toast-context';
import { formatDate, shortId } from '../lib/utils';
import { Plus, RefreshCw, Download } from 'lucide-react';

interface ExportRow {
  _id: string;
  tenantId: string;
  requestedBy?: string | null;
  status: 'pending' | 'running' | 'ready' | 'failed' | 'expired';
  // Raw `url` is no longer returned by the API — downloads go through
  // the scope-checked proxy endpoint. `downloadUrl` is synthesized by
  // the backend when status === 'ready'.
  downloadUrl?: string | null;
  bytes?: number;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

const STORAGE_PREFIX = 'platform_admin_exports_';

function storageKey(tenantId: string) {
  return `${STORAGE_PREFIX}${tenantId}`;
}

function readTracked(tenantId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(tenantId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeTracked(tenantId: string, ids: string[]) {
  localStorage.setItem(storageKey(tenantId), JSON.stringify(ids.slice(-25)));
}

export default function TenantExportsTab({
  tenantId,
  tenantSlug,
}: {
  tenantId: string;
  tenantSlug?: string;
}) {
  const toast = useToast();
  const [exportIds, setExportIds] = useState<string[]>(() => readTracked(tenantId));
  const [rows, setRows] = useState<Record<string, ExportRow | { error: string }>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshOne = useCallback(
    async (exportId: string) => {
      try {
        const data = await api.tenants.getExportStatus(tenantId, exportId);
        setRows((prev) => ({ ...prev, [exportId]: data as ExportRow }));
      } catch (err) {
        setRows((prev) => ({
          ...prev,
          [exportId]: { error: err instanceof Error ? err.message : 'Failed' },
        }));
      }
    },
    [tenantId]
  );

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all(exportIds.map(refreshOne));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    }
  }, [exportIds, refreshOne]);

  useEffect(() => {
    if (exportIds.length === 0) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportIds.length]);

  // Poll any in-flight export every 3s until it reaches a terminal state.
  useEffect(() => {
    const hasPending = Object.values(rows).some(
      (r) => 'status' in r && (r.status === 'pending' || r.status === 'running')
    );
    if (!hasPending) {
      if (pollRef.current) clearTimeout(pollRef.current);
      return;
    }
    pollRef.current = setTimeout(() => {
      refreshAll();
    }, 3000);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [rows, refreshAll]);

  const create = async () => {
    setCreating(true);
    try {
      const result = await api.tenants.requestAsyncExport(tenantId);
      const next = [...exportIds, result.exportId];
      setExportIds(next);
      writeTracked(tenantId, next);
      toast.success('Export enqueued');
      refreshOne(result.exportId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create export');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium">Async tenant export</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Spins up a worker job that dumps the tenant's data and uploads it to object storage.
              Use this for large tenants where the sync export would time out. Exports tracked here
              are ones created from this browser — server-side they persist regardless.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={exportIds.length === 0}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={create} loading={creating}>
              <Plus className="h-3.5 w-3.5" /> New export
            </Button>
          </div>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={refreshAll} />}

      {exportIds.length === 0 ? (
        <EmptyState
          title="No exports tracked"
          description={`Click "New export" to enqueue a dump of ${tenantSlug || 'this tenant'}'s data.`}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <THead>
              <TR>
                <TH>Export</TH>
                <TH>Status</TH>
                <TH>Size</TH>
                <TH>Started</TH>
                <TH>Completed</TH>
                <TH>Expires</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {exportIds
                .slice()
                .reverse()
                .map((id) => {
                  const row = rows[id];
                  if (!row) {
                    return (
                      <TR key={id}>
                        <TD className="text-xs">{shortId(id)}</TD>
                        <TD colSpan={6} className="text-xs text-muted-foreground">
                          loading…
                        </TD>
                      </TR>
                    );
                  }
                  if ('error' in row) {
                    return (
                      <TR key={id}>
                        <TD className="text-xs">{shortId(id)}</TD>
                        <TD colSpan={6} className="text-xs text-destructive">
                          {row.error}
                        </TD>
                      </TR>
                    );
                  }
                  return (
                    <TR key={id}>
                      <TD className="text-xs">{shortId(row._id)}</TD>
                      <TD>
                        <ExportStatusBadge status={row.status} />
                        {row.error && (
                          <div className="mt-1 text-xs text-destructive">{row.error}</div>
                        )}
                      </TD>
                      <TD className="text-xs">{formatBytes(row.bytes)}</TD>
                      <TD className="text-xs text-muted-foreground">
                        {formatDate(row.startedAt)}
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        {formatDate(row.completedAt)}
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        {formatDate(row.expiresAt)}
                      </TD>
                      <TD>
                        {row.status === 'ready' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await api.tenants.downloadExport(tenantId, row._id);
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : 'Download failed'
                                );
                              }
                            }}
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

const ExportStatusBadge: React.FC<{ status: ExportRow['status'] }> = ({ status }) => {
  const variant: React.ComponentProps<typeof Badge>['variant'] =
    status === 'ready' ? 'success' :
    status === 'failed' ? 'destructive' :
    status === 'expired' ? 'outline' :
    status === 'running' ? 'warning' : 'secondary';
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
};
