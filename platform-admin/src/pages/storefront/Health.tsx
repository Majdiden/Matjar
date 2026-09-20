import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hasScope, PLATFORM_SCOPES, type Pagination } from '../../lib/api';
import { storefrontApi, OVERALL_TONE, type HealthRow } from '../../lib/api-storefront';
import { CheckCell } from '../../components/StorefrontBadges';
import { useAuth } from '../../contexts/auth-context';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageSpinner, EmptyState, ErrorState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatDate, formatRelative } from '../../lib/utils';
import { RefreshCw, Activity, Play } from 'lucide-react';
import { PillStrip, Pager, TenantLink } from '../commerce/shared';

const OVERALL = ['ok', 'degraded', 'error', 'unknown'] as const;

export default function StorefrontHealth() {
  const toast = useToast();
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const [sp, setSp] = useSearchParams();
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const overall = (OVERALL as readonly string[]).includes(sp.get('overall') || '') ? sp.get('overall')! : '';

  const [rows, setRows] = useState<HealthRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await storefrontApi.health.list({ overall, page, limit: 25 }); setRows(d.results); setPagination(d.pagination); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load health results'); }
    finally { setLoading(false); }
  }, [overall, page]);
  useEffect(() => { if (canRead) void load(); }, [canRead, load]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp);
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSp(next, { replace: true });
  };

  const recheck = async (r: HealthRow) => {
    setBusy(r.tenantId);
    try { const res = await storefrontApi.health.check(r.tenantId); toast.success(`Checked ${res.host}: ${res.overall}`); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Check failed'); }
    finally { setBusy(null); }
  };

  if (!canRead) return <ErrorState error="Viewing storefront health requires the support.read scope." />;

  const columns: DataListColumn<HealthRow>[] = [
    { id: 'store', header: 'Store', primary: true, cell: (r) => <div className="min-w-0"><div className="truncate font-medium" dir="ltr">{r.host}</div><TenantLink id={r.tenantId} tenant={r.tenant} /></div> },
    { id: 'overall', header: 'Overall', cell: (r) => <Badge variant={OVERALL_TONE[r.overall]}>{r.overall}</Badge> },
    { id: 'home', header: 'Home', cell: (r) => <CheckCell c={r.checks?.home} /> },
    { id: 'product', header: 'Product', cell: (r) => <CheckCell c={r.checks?.product} /> },
    { id: 'cart', header: 'Cart', cell: (r) => <CheckCell c={r.checks?.cart} /> },
    { id: 'ssl', header: 'SSL', cell: (r) => r.ssl?.ok == null ? <span className="text-xs text-muted-foreground">n/a</span> : <span className={`text-xs ${r.ssl.ok ? 'text-emerald-600' : 'text-destructive'}`}>{r.ssl.ok ? '✓' : '✗'}{r.ssl.expiresAt ? ` exp ${formatDate(r.ssl.expiresAt)}` : ''}{r.ssl.error ? ` ${r.ssl.error.slice(0, 40)}` : ''}</span> },
    { id: 'theme', header: 'Theme', cell: (r) => <span className="text-xs">{r.theme?.slug || '—'}{r.theme?.version ? ` v${r.theme.version}` : ''}</span> },
    { id: 'checked', header: 'Checked', cell: (r) => <span className="text-xs text-muted-foreground" title={formatDate(r.checkedAt)}>{formatRelative(r.checkedAt)}{r.source === 'manual' ? ' · manual' : ''}</span> },
    { id: 'actions', align: 'end', cell: (r) => <Button variant="ghost" size="sm" disabled={busy === r.tenantId} onClick={() => recheck(r)} title="Check now"><Play className="h-3.5 w-3.5" /></Button> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-indigo-600" />
          <div><h1 className="text-2xl font-bold tracking-tight">Storefront health</h1><p className="text-sm text-muted-foreground">Probed every 6 hours: home, one product page, cart and TLS expiry on each store's primary host.</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>
      <PillStrip options={OVERALL} value={overall} onChange={(v) => setParam('overall', v || null)} allLabel="All" />
      {error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="No results yet" description="The first sweep runs when the worker boots; use “Check now” on a tenant's Storefront tab to probe one store immediately." />
        : <DataList columns={columns} rows={rows} rowKey={(r) => r.tenantId} />}
      <Pager pagination={pagination} page={page} loading={loading} onPage={(n) => setParam('page', n <= 1 ? null : String(n))} />
    </div>
  );
}
