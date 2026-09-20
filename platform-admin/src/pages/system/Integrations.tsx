import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { systemApi, type Integration } from '../../lib/api-system';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';
import { SystemShell, StatusBadge } from './SystemShell';

/** External providers — configured/enabled/health only; never a config value. */
export default function Integrations() {
  const [rows, setRows] = useState<Integration[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await systemApi.integrations();
      setRows(d.integrations);
      setGeneratedAt(d.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataListColumn<Integration>[] = [
    {
      id: 'name',
      header: 'Integration',
      primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground capitalize">{r.kind}</div>
          {r.note && <div className="mt-1 text-xs text-amber-700">{r.note}</div>}
        </div>
      ),
    },
    { id: 'health', header: 'Health', cell: (r) => <StatusBadge status={r.health} /> },
    {
      id: 'configured',
      header: 'Configured',
      cell: (r) => (r.configured ? <Badge variant="success">yes</Badge> : <Badge variant="outline">no</Badge>),
    },
    {
      id: 'enabled',
      header: 'Enabled',
      cell: (r) => (r.enabled ? <Badge variant="secondary">on</Badge> : <Badge variant="outline">off</Badge>),
    },
    { id: 'env', header: 'Environment', hideOnMobile: true, cell: (r) => <span className="text-xs">{r.environment}</span> },
    {
      id: 'last',
      header: 'Last activity',
      fullWidthOnMobile: true,
      cell: (r) => (
        <div className="text-xs text-muted-foreground">
          {r.lastSuccessAt && <div>ok {formatDate(r.lastSuccessAt)}</div>}
          {r.lastErrorAt && <div className="text-red-600">error {formatDate(r.lastErrorAt)}{r.lastError ? ` — ${r.lastError}` : ''}</div>}
          {!r.lastSuccessAt && !r.lastErrorAt && '—'}
        </div>
      ),
    },
  ];

  return (
    <SystemShell
      title="System"
      description="External providers the platform depends on. Configuration values are never shown here."
      actions={
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <PageSpinner />
      ) : (
        <>
          <DataList columns={columns} rows={rows} rowKey={(r) => r.name} />
          {generatedAt && <p className="text-xs text-muted-foreground">as of {formatDate(generatedAt)}</p>}
        </>
      )}
    </SystemShell>
  );
}
