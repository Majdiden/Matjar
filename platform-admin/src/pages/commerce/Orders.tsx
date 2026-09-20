import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OBJECT_ID, parsePage, allowed, makeSetParam } from '../../lib/list-helpers';
import { hasScope, PLATFORM_SCOPES, type Pagination } from '../../lib/api';
import { commerceApi, formatAmount, ORDER_STATUSES, PAYMENT_STATUSES, ORDER_TONE, PAYMENT_TONE, type OrderDetail, type OrderRow } from '../../lib/api-commerce';
import { useAuth } from '../../contexts/auth-context';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageSpinner, EmptyState, ErrorState } from '../../components/ui/Spinner';
import { formatDate, shortId } from '../../lib/utils';
import { RefreshCw, Search, ShoppingCart, Eye } from 'lucide-react';
import { OrderDetailModal, PillStrip, Pager, StatusBadgeOf, TenantLink } from './shared';


/** Cross-store order search. Read-only; every row links to the owning tenant. */
export default function CommerceOrders() {
  const { user } = useAuth();
  const canRead = hasScope(user, PLATFORM_SCOPES.SUPPORT_READ);
  const [sp, setSp] = useSearchParams();
  const page = parsePage(sp.get('page'));
  const status = allowed(sp.get('status'), ORDER_STATUSES);
  const paymentStatus = allowed(sp.get('paymentStatus'), PAYMENT_STATUSES);
  const tenantId = OBJECT_ID.test(sp.get('tenantId') || '') ? sp.get('tenantId')! : '';
  const q = sp.get('q') || '';

  const [qLocal, setQLocal] = useState(q);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ open: boolean; loading: boolean; error: string | null; data: OrderDetail | null }>({ open: false, loading: false, error: null, data: null });

  useEffect(() => setQLocal(q), [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await commerceApi.orders.list({ q, tenantId, status, paymentStatus, page, limit: 25 });
      setRows(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [q, tenantId, status, paymentStatus, page]);

  useEffect(() => { if (canRead) void load(); }, [canRead, load]);

  const setParam = makeSetParam(sp, setSp);

  const openOrder = async (r: OrderRow) => {
    setDetail({ open: true, loading: true, error: null, data: null });
    try {
      setDetail({ open: true, loading: false, error: null, data: await commerceApi.orders.get(r.tenantId, r._id) });
    } catch (err) {
      setDetail({ open: true, loading: false, error: err instanceof Error ? err.message : 'Failed to load order', data: null });
    }
  };

  if (!canRead) return <ErrorState error="Viewing orders requires the support.read scope." />;

  const columns: DataListColumn<OrderRow>[] = [
    {
      id: 'order', header: 'Order', primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.orderNumber || shortId(r._id)}</div>
          <TenantLink id={r.tenantId} tenant={r.tenant} />
        </div>
      ),
    },
    { id: 'customer', header: 'Customer', fullWidthOnMobile: true, cell: (r) => (
      <div className="min-w-0"><div className="truncate">{r.customer?.name || '—'}</div><div className="break-all text-xs text-muted-foreground" dir="ltr">{r.customer?.email || ''}</div></div>
    ) },
    { id: 'status', header: 'Status', cell: (r) => <StatusBadgeOf value={r.status} tone={ORDER_TONE} /> },
    { id: 'payment', header: 'Payment', cell: (r) => <StatusBadgeOf value={r.paymentStatus} tone={PAYMENT_TONE} /> },
    { id: 'total', header: 'Total', align: 'end', cell: (r) => <span className="whitespace-nowrap">{formatAmount(r.totalAmount, r.currency)}</span> },
    { id: 'placed', header: 'Placed', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
    { id: 'actions', align: 'end', cell: (r) => (
      <Button variant="ghost" size="sm" onClick={() => openOrder(r)} aria-label="View order"><Eye className="h-3.5 w-3.5" /></Button>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
            <p className="text-sm text-muted-foreground">Every order across every store. Inspect only — merchants own their orders.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setParam('q', qLocal.trim() || null); }} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={qLocal} onChange={(e) => setQLocal(e.target.value)} placeholder="Order number, customer email or phone, order id" className="pl-8" />
      </form>
      {tenantId && (
        <div className="text-xs text-muted-foreground">Filtered to one store. <button className="underline" onClick={() => setParam('tenantId', null)}>Clear</button></div>
      )}
      <div className="space-y-2">
        <PillStrip options={ORDER_STATUSES} value={status} onChange={(v) => setParam('status', v || null)} allLabel="All statuses" />
        <PillStrip options={PAYMENT_STATUSES} value={paymentStatus} onChange={(v) => setParam('paymentStatus', v || null)} allLabel="Any payment" />
      </div>

      {error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="No orders match" description="Try a different status, payment state or search term." />
        : <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />}

      <Pager pagination={pagination} page={page} loading={loading} onPage={(n) => setParam('page', n <= 1 ? null : String(n))} />

      <OrderDetailModal open={detail.open} onClose={() => setDetail((d) => ({ ...d, open: false }))} loading={detail.loading} error={detail.error} data={detail.data} />
    </div>
  );
}
