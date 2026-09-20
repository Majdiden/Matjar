import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OBJECT_ID, parsePage, allowed, makeSetParam } from '../../lib/list-helpers';
import { hasScope, PLATFORM_SCOPES, type Pagination } from '../../lib/api';
import { commerceApi, type InventoryRow } from '../../lib/api-commerce';
import { useAuth } from '../../contexts/auth-context';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageSpinner, EmptyState, ErrorState } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';
import { RefreshCw, Search, Boxes } from 'lucide-react';
import { Pager, TenantLink } from './shared';

const FILTERS = [
  { key: '', label: 'All tracked' },
  { key: 'lowStock', label: 'Low stock' },
  { key: 'negative', label: 'Negative' },
] as const;
const FILTER_KEYS = FILTERS.map((f) => f.key) as readonly ('' | 'lowStock' | 'negative')[];

/** Stock levels across stores. `onHand` = product stock, or the sum of variant stock. */
export default function CommerceInventory() {
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const [sp, setSp] = useSearchParams();
  const page = parsePage(sp.get('page'));
  const filter = allowed(sp.get('filter'), FILTER_KEYS);
  const tenantId = OBJECT_ID.test(sp.get('tenantId') || '') ? sp.get('tenantId')! : '';
  const q = sp.get('q') || '';

  const [qLocal, setQLocal] = useState(q);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setQLocal(q), [q]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await commerceApi.inventory.list({ tenantId, q, lowStock: filter === 'lowStock', negative: filter === 'negative', page, limit: 25 });
      setRows(data.items); setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally { setLoading(false); }
  }, [tenantId, q, filter, page]);

  useEffect(() => { if (canRead) void load(); }, [canRead, load]);

  const setParam = makeSetParam(sp, setSp);

  if (!canRead) return <ErrorState error="Viewing inventory requires the support.read scope." />;

  const columns: DataListColumn<InventoryRow>[] = [
    { id: 'name', header: 'Product', primary: true, cell: (r) => (
      <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><TenantLink id={r.tenantId} tenant={r.tenant} /></div>
    ) },
    { id: 'sku', header: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku || '—'}</span> },
    { id: 'onHand', header: 'On hand', align: 'end', cell: (r) => {
      const low = r.onHand <= (r.lowStockThreshold ?? 5);
      return <span className={r.onHand < 0 ? 'font-semibold text-destructive' : low ? 'font-medium text-amber-600' : ''}>{r.onHand}</span>;
    } },
    { id: 'threshold', header: 'Low at', align: 'end', cell: (r) => r.lowStockThreshold ?? 5 },
    { id: 'variants', header: 'Variants', fullWidthOnMobile: true, cell: (r) => r.hasVariants && r.variants.length ? (
      <div className="flex flex-wrap gap-1">{r.variants.slice(0, 6).map((v) => (
        <Badge key={v._id} variant={v.stock <= 0 ? 'destructive' : 'outline'} className="text-[10px]">{v.optionValues?.map((o) => o.value).join('/') || v.sku || '?'}: {v.stock}</Badge>
      ))}{r.variants.length > 6 && <span className="text-xs text-muted-foreground">+{r.variants.length - 6}</span>}</div>
    ) : <span className="text-muted-foreground">—</span> },
    { id: 'updated', header: 'Updated', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Boxes className="h-6 w-6 text-indigo-600" />
          <div><h1 className="text-2xl font-bold tracking-tight">Inventory</h1><p className="text-sm text-muted-foreground">Stock levels for tracked products. Negative or zero stock signals an oversell or a sync problem.</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setParam('q', qLocal.trim() || null); }} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={qLocal} onChange={(e) => setQLocal(e.target.value)} placeholder="Product name" className="pl-8" />
      </form>
      {tenantId && <div className="text-xs text-muted-foreground">Filtered to one store. <button className="underline" onClick={() => setParam('tenantId', null)}>Clear</button></div>}
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:overflow-visible md:px-0">
        <div className="flex w-max items-center gap-1 rounded-md border bg-card p-1">
          {FILTERS.map((f) => (
            <button key={f.key || '__all'} type="button" onClick={() => setParam('filter', f.key || null)} className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs transition-colors ${filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="Nothing to show" description={filter ? 'No products match this stock filter.' : 'No tracked products.'} />
        : <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />}
      <Pager pagination={pagination} page={page} loading={loading} onPage={(n) => setParam('page', n <= 1 ? null : String(n))} />
    </div>
  );
}
