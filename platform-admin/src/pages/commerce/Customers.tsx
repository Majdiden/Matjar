import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OBJECT_ID, parsePage, makeSetParam } from '../../lib/list-helpers';
import { api, hasScope, PLATFORM_SCOPES, type Pagination, type TenantListRow } from '../../lib/api';
import { commerceApi, formatAmount, type CustomerRow } from '../../lib/api-commerce';
import { useAuth } from '../../contexts/auth-context';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { PageSpinner, EmptyState, ErrorState } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';
import { RefreshCw, Search, Users } from 'lucide-react';
import { Pager } from './shared';


/**
 * Customers are tenant-scoped by design: the operator must pick a store first.
 * There is no cross-store customer search (privacy).
 */
export default function CommerceCustomers() {
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const [sp, setSp] = useSearchParams();
  const page = parsePage(sp.get('page'));
  const tenantId = OBJECT_ID.test(sp.get('tenantId') || '') ? sp.get('tenantId')! : '';
  const q = sp.get('q') || '';

  const [qLocal, setQLocal] = useState(q);
  const [tenants, setTenants] = useState<TenantListRow[]>([]);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setQLocal(q), [q]);
  useEffect(() => {
    if (!canRead) return;
    api.tenants.list({ limit: 100 }).then((d) => setTenants(d.tenants)).catch(() => setTenants([]));
  }, [canRead]);

  const load = useCallback(async () => {
    if (!tenantId) { setRows([]); setPagination(null); return; }
    setLoading(true); setError(null);
    try {
      const data = await commerceApi.customers.list({ tenantId, q, page, limit: 25 });
      setRows(data.customers); setPagination(data.pagination); setCurrency(data.tenant?.currency ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally { setLoading(false); }
  }, [tenantId, q, page]);

  useEffect(() => { if (canRead) void load(); }, [canRead, load]);

  const setParam = makeSetParam(sp, setSp);

  if (!canRead) return <ErrorState error="Viewing customers requires the support.read scope." />;

  const columns: DataListColumn<CustomerRow>[] = [
    { id: 'name', header: 'Customer', primary: true, cell: (r) => (
      <div className="min-w-0"><div className="truncate font-medium">{r.name || [r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</div><div className="break-all text-xs text-muted-foreground" dir="ltr">{r.email}</div></div>
    ) },
    { id: 'phone', header: 'Phone', cell: (r) => <span dir="ltr">{r.phone || '—'}</span> },
    { id: 'orders', header: 'Orders', align: 'end', cell: (r) => r.totalOrders ?? 0 },
    { id: 'spent', header: 'Total spent', align: 'end', cell: (r) => <span className="whitespace-nowrap">{formatAmount(r.totalSpent ?? 0, currency)}</span> },
    { id: 'last', header: 'Last order', cell: (r) => r.lastOrder ? <span className="text-xs">{r.lastOrder.orderNumber || ''} <span className="text-muted-foreground">{formatDate(r.lastOrder.at)}</span></span> : <span className="text-muted-foreground">—</span> },
    { id: 'status', header: 'Status', cell: (r) => <Badge variant={r.isActive === false ? 'destructive' : 'success'}>{r.isActive === false ? 'Disabled' : 'Active'}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-indigo-600" />
          <div><h1 className="text-2xl font-bold tracking-tight">Customers</h1><p className="text-sm text-muted-foreground">Pick a store first — customer data is never searched across stores. The Users tile on a tenant page deep-links here.</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading || !tenantId}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,18rem)_1fr]">
        <Select value={tenantId} onChange={(e) => setParam('tenantId', e.target.value || null)}>
          <option value="">Select a store…</option>
          {tenants.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.slug})</option>)}
        </Select>
        <form onSubmit={(e) => { e.preventDefault(); setParam('q', qLocal.trim() || null); }} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qLocal} onChange={(e) => setQLocal(e.target.value)} placeholder="Email, name or phone" className="pl-8" disabled={!tenantId} />
        </form>
      </div>

      {!tenantId ? <EmptyState title="No store selected" description="Choose a store to list its customers." />
        : error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="No customers" description="This store has no customer accounts matching the search." />
        : <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />}
      <Pager pagination={pagination} page={page} loading={loading} onPage={(n) => setParam('page', n <= 1 ? null : String(n))} />
    </div>
  );
}
