import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { systemApi, formatUptime, type SystemHealth, type QueueRow } from '../../lib/api-system';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';
import { SystemShell, StatusBadge } from './SystemShell';

/**
 * System health — bounded probes of the API process, MongoDB, Redis and the
 * BullMQ queues, plus the integration roll-up. Never shows config values.
 */
export default function Health() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await systemApi.health(refresh));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const api = data?.checks.find((c) => c.name === 'api');
  const mongo = data?.checks.find((c) => c.name === 'mongo');
  const redis = data?.checks.find((c) => c.name === 'redis');
  const queues = data?.checks.find((c) => c.name === 'queues');

  const queueColumns: DataListColumn<QueueRow>[] = [
    { id: 'name', header: 'Queue', primary: true, cell: (q) => <span className="font-mono text-xs">{q.name}</span> },
    {
      id: 'state',
      header: 'State',
      cell: (q) =>
        q.error ? <Badge variant="destructive">unavailable</Badge> : q.paused ? <Badge variant="warning">paused</Badge> : <Badge variant="success">running</Badge>,
    },
    { id: 'waiting', header: 'Waiting', align: 'end', cell: (q) => q.waiting ?? '—' },
    { id: 'active', header: 'Active', align: 'end', cell: (q) => q.active ?? '—' },
    { id: 'delayed', header: 'Delayed', align: 'end', cell: (q) => q.delayed ?? '—' },
    {
      id: 'failed',
      header: 'Failed',
      align: 'end',
      cell: (q) => <span className={(q.failed || 0) > 0 ? 'font-semibold text-red-600' : ''}>{q.failed ?? '—'}</span>,
    },
    { id: 'completed', header: 'Completed', align: 'end', hideOnMobile: true, cell: (q) => q.completed ?? '—' },
  ];

  return (
    <SystemShell
      title="System"
      description="Health of the platform's own dependencies. Values are probed live with short timeouts."
      actions={
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={() => load(true)} />
      ) : loading && !data ? (
        <PageSpinner />
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
            <span className="text-sm font-medium">Overall</span>
            <StatusBadge status={data.overall} />
            <span className="text-xs text-muted-foreground">as of {formatDate(data.generatedAt)}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile title="API" status={api?.status || 'unknown'}>
              <Row k="Uptime" v={formatUptime(api?.uptimeSec)} />
              <Row k="Node" v={api?.nodeVersion || '—'} />
              <Row k="Environment" v={api?.environment || '—'} />
              <Row k="Memory (RSS / heap)" v={api?.memory ? `${api.memory.rssMb} / ${api.memory.heapUsedMb} MB` : '—'} />
            </Tile>
            <Tile title="MongoDB" status={mongo?.status || 'unknown'}>
              <Row k="Ping" v={mongo?.latencyMs != null ? `${mongo.latencyMs} ms` : '—'} />
              <Row k="Topology" v={mongo?.replica?.isReplicaSet ? `replica set (${mongo.replica.isPrimary ? 'primary' : 'secondary'})` : 'standalone'} />
            </Tile>
            <Tile title="Redis" status={redis?.status || 'unknown'}>
              <Row k="Ping" v={redis?.latencyMs != null ? `${redis.latencyMs} ms` : '—'} />
              <Row k="Connection" v={redis?.connectionState || '—'} />
            </Tile>
            <Tile title="Queues" status={queues?.status || 'unknown'}>
              <Row k="Queues" v={String(queues?.queues?.length ?? 0)} />
              <Row k="Failed jobs" v={String((queues?.queues || []).reduce((n, q) => n + (q.failed || 0), 0))} />
              <Row k="Backlog" v={String((queues?.queues || []).reduce((n, q) => n + (q.waiting || 0) + (q.delayed || 0), 0))} />
            </Tile>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Queues</h2>
            <DataList columns={queueColumns} rows={queues?.queues || []} rowKey={(q) => q.name} />
          </div>
        </>
      ) : null}
    </SystemShell>
  );
}

function Tile({ title, status, children }: { title: string; status: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <StatusBadge status={status} />
      </div>
      <dl className="space-y-1 text-xs">{children}</dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-end font-mono [overflow-wrap:anywhere]">{v}</dd>
    </div>
  );
}
