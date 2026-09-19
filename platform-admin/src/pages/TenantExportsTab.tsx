import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { DataList, type DataListColumn } from '../components/ui/DataList';
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

  type ExportListRow = { id: string; row?: ExportRow | { error: string } };
  const exportRows: ExportListRow[] = exportIds
    .slice()
    .reverse()
    .map((id) => ({ id, row: rows[id] }));

  const isReady = (r?: ExportRow | { error: string }): r is ExportRow => !!r && !('error' in r);

  const columns: DataListColumn<ExportListRow>[] = [
    { id: 'export', header: 'Export', primary: true, cell: (r) => <span className="text-xs">{shortId(r.id)}</span> },
    {
      id: 'status',
      header: 'Status',
      fullWidthOnMobile: true,
      cell: (r) => {
        if (!r.row) return <span className="text-xs text-muted-foreground">loading…</span>;
        if ('error' in r.row) return <span className="text-xs text-destructive">{r.row.error}</span>;
        return (
          <>
            <ExportStatusBadge status={r.row.status} />
            {r.row.error && <div className="mt-1 break-words text-xs text-destructive">{r.row.error}</div>}
          </>
        );
      },
    },
    { id: 'size', header: 'Size', cell: (r) => <span className="text-xs">{isReady(r.row) ? formatBytes(r.row.bytes) : '—'}</span> },
    { id: 'started', header: 'Started', cell: (r) => <span className="text-xs text-muted-foreground">{isReady(r.row) ? formatDate(r.row.startedAt) : '—'}</span> },
    { id: 'completed', header: 'Completed', cell: (r) => <span className="text-xs text-muted-foreground">{isReady(r.row) ? formatDate(r.row.completedAt) : '—'}</span> },
    { id: 'expires', header: 'Expires', cell: (r) => <span className="text-xs text-muted-foreground">{isReady(r.row) ? formatDate(r.row.expiresAt) : '—'}</span> },
    {
      id: 'actions',
      align: 'end',
      cell: (r) =>
        isReady(r.row) && r.row.status === 'ready' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await api.tenants.downloadExport(tenantId, r.id);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Download failed');
              }
            }}
          >
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Async tenant export</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Spins up a worker job that dumps the tenant's data and uploads it to object storage.
              Use this for large tenants where the sync export would time out. Exports tracked here
              are ones created from this browser — server-side they persist regardless.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
        <DataList columns={columns} rows={exportRows} rowKey={(r) => r.id} />
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
