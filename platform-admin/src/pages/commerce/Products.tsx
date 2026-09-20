import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OBJECT_ID, parsePage, allowed, makeSetParam } from '../../lib/list-helpers';
import { hasScope, PLATFORM_SCOPES, type Pagination } from '../../lib/api';
import { commerceApi, formatAmount, PRODUCT_STATUSES, type ProductDetail, type ProductRow } from '../../lib/api-commerce';
import { useAuth } from '../../contexts/auth-context';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner, EmptyState, ErrorState } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';
import { RefreshCw, Search, Package, Eye } from 'lucide-react';
import { PillStrip, Pager, TenantLink } from './shared';

const STATUS_TONE: Record<string, React.ComponentProps<typeof Badge>['variant']> = { active: 'success', draft: 'secondary', archived: 'outline' };

export default function CommerceProducts() {
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const [sp, setSp] = useSearchParams();
  const page = parsePage(sp.get('page'));
  const status = allowed(sp.get('status'), PRODUCT_STATUSES);
  const tenantId = OBJECT_ID.test(sp.get('tenantId') || '') ? sp.get('tenantId')! : '';
  const q = sp.get('q') || '';
  const sku = sp.get('sku') || '';

  const [qLocal, setQLocal] = useState(q);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ open: boolean; loading: boolean; error: string | null; data: ProductDetail | null }>({ open: false, loading: false, error: null, data: null });

  useEffect(() => setQLocal(q), [q]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await commerceApi.products.list({ q, sku, tenantId, status, page, limit: 25 });
      setRows(data.products); setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally { setLoading(false); }
  }, [q, sku, tenantId, status, page]);

  useEffect(() => { if (canRead) void load(); }, [canRead, load]);

  const setParam = makeSetParam(sp, setSp);

  const open = async (r: ProductRow) => {
    setDetail({ open: true, loading: true, error: null, data: null });
    try { setDetail({ open: true, loading: false, error: null, data: await commerceApi.products.get(r.tenantId, r._id) }); }
    catch (err) { setDetail({ open: true, loading: false, error: err instanceof Error ? err.message : 'Failed to load product', data: null }); }
  };

  if (!canRead) return <ErrorState error="Viewing products requires the support.read scope." />;

  const stockOf = (r: ProductRow) => (r.hasVariants ? r.variantStock ?? 0 : r.stock);
  const columns: DataListColumn<ProductRow>[] = [
    { id: 'name', header: 'Product', primary: true, cell: (r) => (
      <div className="flex min-w-0 items-center gap-2">
        {r.image ? <img src={r.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : <div className="h-9 w-9 shrink-0 rounded bg-muted" />}
        <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><TenantLink id={r.tenantId} tenant={r.tenant} />{r.isDemo && <Badge variant="outline" className="ms-1 text-[10px]">demo</Badge>}</div>
      </div>
    ) },
    { id: 'sku', header: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku || '—'}</span> },
    { id: 'status', header: 'Status', cell: (r) => <Badge variant={STATUS_TONE[r.status] ?? 'outline'} className="capitalize">{r.status}</Badge> },
    { id: 'price', header: 'Price', align: 'end', cell: (r) => <span className="whitespace-nowrap">{formatAmount(r.price, r.currency)}</span> },
    { id: 'stock', header: 'Stock', align: 'end', cell: (r) => {
      const s = stockOf(r); const low = r.trackInventory !== false && s <= (r.lowStockThreshold ?? 5);
      return <span className={low ? 'font-medium text-amber-600' : ''}>{r.trackInventory === false ? '∞' : s}{r.hasVariants ? ` · ${r.variantCount} var.` : ''}</span>;
    } },
    { id: 'updated', header: 'Updated', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.updatedAt || r.createdAt)}</span> },
    { id: 'actions', align: 'end', cell: (r) => <Button variant="ghost" size="sm" onClick={() => open(r)} aria-label="View product"><Eye className="h-3.5 w-3.5" /></Button> },
  ];

  const p = detail.data?.product;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-indigo-600" />
          <div><h1 className="text-2xl font-bold tracking-tight">Products</h1><p className="text-sm text-muted-foreground">Cross-store catalog inspection by name, slug or SKU.</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setParam('q', qLocal.trim() || null); }} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={qLocal} onChange={(e) => setQLocal(e.target.value)} placeholder="Name, slug, SKU or product id" className="pl-8" />
      </form>
      {tenantId && <div className="text-xs text-muted-foreground">Filtered to one store. <button className="underline" onClick={() => setParam('tenantId', null)}>Clear</button></div>}
      <PillStrip options={PRODUCT_STATUSES} value={status} onChange={(v) => setParam('status', v || null)} allLabel="All statuses" />

      {error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="No products match" />
        : <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />}
      <Pager pagination={pagination} page={page} loading={loading} onPage={(n) => setParam('page', n <= 1 ? null : String(n))} />

      <Modal open={detail.open} onClose={() => setDetail((d) => ({ ...d, open: false }))} title={p?.name || 'Product'} description={detail.data?.tenant ? <TenantLink id={detail.data.tenant._id} tenant={detail.data.tenant} /> : undefined} className="max-w-3xl">
        {detail.loading ? <PageSpinner /> : detail.error ? <ErrorState error={detail.error} /> : p ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant={STATUS_TONE[p.status] ?? 'outline'} className="capitalize">{p.status}</Badge>
              {p.category && <Badge variant="secondary">{p.category.name}</Badge>}
              {p.featured && <Badge variant="outline">featured</Badge>}
              {p.isDemo && <Badge variant="outline">demo</Badge>}
            </div>
            {p.images?.length ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1">{p.images.slice(0, 8).map((src) => <img key={src} src={src} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />)}</div>
            ) : null}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
              <div><dt className="text-[11px] uppercase text-muted-foreground">Price</dt><dd>{formatAmount(p.price, p.currency)}{p.compareAtPrice ? <span className="ms-1 text-xs text-muted-foreground line-through">{formatAmount(p.compareAtPrice, p.currency)}</span> : null}</dd></div>
              <div><dt className="text-[11px] uppercase text-muted-foreground">SKU</dt><dd className="font-mono text-xs">{p.sku || '—'}</dd></div>
              <div><dt className="text-[11px] uppercase text-muted-foreground">Stock</dt><dd>{p.trackInventory === false ? 'not tracked' : p.hasVariants ? p.variants.reduce((a, v) => a + (v.stock || 0), 0) : p.stock}</dd></div>
              <div><dt className="text-[11px] uppercase text-muted-foreground">Slug</dt><dd className="break-all font-mono text-xs">{p.slug}</dd></div>
            </dl>
            {p.hasVariants && p.variants.length > 0 && (
              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">Variants ({p.variants.length})</div>
                <ul className="divide-y">{p.variants.map((v) => (
                  <li key={v._id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0"><div className="truncate">{v.optionValues?.map((o) => `${o.name}: ${o.value}`).join(', ') || '—'}</div><div className="font-mono text-xs text-muted-foreground">{v.sku || ''}</div></div>
                    <div className="shrink-0 text-end"><div>{formatAmount(v.price, p.currency)}</div><div className={`text-xs ${v.stock <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>stock {v.stock}</div></div>
                  </li>
                ))}</ul>
              </div>
            )}
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Collections</div>
              {detail.data?.collections.length ? <div className="flex flex-wrap gap-1">{detail.data.collections.map((c) => <Badge key={c._id} variant={c.isPublished ? 'secondary' : 'outline'}>{c.title}{c.isPublished ? '' : ' (unpublished)'}</Badge>)}</div> : <span className="text-muted-foreground">Not in any collection.</span>}
            </div>
            <div className="text-xs text-muted-foreground">Created {formatDate(p.createdAt)} · updated {formatDate(p.updatedAt)}</div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
