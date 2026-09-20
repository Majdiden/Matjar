import { useCallback, useEffect, useState } from 'react';
import { hasScope, PLATFORM_SCOPES } from '../lib/api';
import { tenantConfigApi, sourceLabel, sourceVariant, LIMIT_LABELS, type TenantUsage } from '../lib/api-programs';
import { useAuth } from '../contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataList, type DataListColumn } from '../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../components/ui/Spinner';
import { useToast } from '../components/ui/toast-context';
import { formatDate } from '../lib/utils';
import { RefreshCw, Gauge } from 'lucide-react';

type HistoryRow = TenantUsage['history'][number];

/**
 * Usage vs effective limits (plan → program → store override) with the last
 * 30 nightly snapshots. Read-only; nothing is enforced in this phase.
 */
export default function TenantUsageTab({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const canRefresh = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);
  const [data, setData] = useState<TenantUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await tenantConfigApi.usage(tenantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setData(await tenantConfigApi.refreshUsage(tenantId));
      toast.success('Snapshot taken');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  if (!canRead) return <ErrorState error="Viewing usage requires the support.read scope." />;
  if (loading && !data) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return null;

  const historyCols: DataListColumn<HistoryRow>[] = [
    { id: 'at', header: 'Snapshot', primary: true, cell: (h) => <span className="text-sm">{formatDate(h.at)} <span className="text-xs text-muted-foreground">({h.source})</span></span> },
    { id: 'products', header: 'Products', align: 'end', cell: (h) => <span className="tabular-nums">{h.products}</span> },
    { id: 'staff', header: 'Staff', align: 'end', cell: (h) => <span className="tabular-nums">{h.staff}</span> },
    { id: 'orders', header: 'Orders (month)', align: 'end', cell: (h) => <span className="tabular-nums">{h.ordersThisMonth}</span> },
    { id: 'storage', header: 'Storage MB', align: 'end', cell: (h) => <span className="tabular-nums">{h.storageMB}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {data.at ? <>Latest snapshot {formatDate(data.at)}</> : canRefresh ? 'No snapshot yet — take one to see current usage.' : 'No snapshot yet (nightly job at 03:30 UTC).'}
          {data.limitOverridesReason && <> · store limit override: {data.limitOverridesReason}</>}
        </p>
        {canRefresh && (
          <Button variant="outline" size="sm" onClick={refresh} loading={refreshing}><RefreshCw className="h-3.5 w-3.5" /> Take snapshot now</Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.resources.map((r) => {
          const pct = r.pct ?? 0;
          const tone = r.over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-600';
          return (
            <Card key={r.key}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm"><Gauge className="h-4 w-4 text-muted-foreground" /> {LIMIT_LABELS[r.key]}</CardTitle>
                    <CardDescription className="mt-1">
                      <Badge variant={sourceVariant(r.source)} className="text-[10px]">{sourceLabel(r.source)}{r.layers.programKey && r.source === 'program' ? ` · ${r.layers.programKey}` : ''}</Badge>
                    </CardDescription>
                  </div>
                  <div className="text-end">
                    <div className="text-2xl font-semibold tabular-nums">{r.used ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">of {r.limit == null ? '∞' : r.limit.toLocaleString()}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${tone}`} style={{ width: `${r.limit == null ? 0 : Math.min(100, pct)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {r.limit == null ? 'Unlimited on the effective plan' : r.over ? `Over limit by ${(r.used ?? 0) - r.limit}` : `${pct}% used`}
                  {' · '}plan {r.layers.plan ?? '∞'}{r.layers.program != null ? ` › program ${r.layers.program}` : ''}{r.layers.tenant != null ? ` › store ${r.layers.tenant}` : ''}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>History</CardTitle><CardDescription>One row per nightly snapshot (03:30 UTC) or manual refresh, newest first.</CardDescription></CardHeader>
        <CardContent>
          {data.history.length === 0 ? <EmptyState title="No snapshots yet" /> : <DataList columns={historyCols} rows={data.history} rowKey={(h) => h.at} />}
        </CardContent>
      </Card>
    </div>
  );
}
