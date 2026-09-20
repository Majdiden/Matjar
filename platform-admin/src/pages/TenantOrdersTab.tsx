import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Pagination } from '../lib/api';
import { commerceApi, formatAmount, ORDER_STATUSES, ORDER_TONE, PAYMENT_TONE, type OrderDetail, type OrderRow } from '../lib/api-commerce';
import { DataList, type DataListColumn } from '../components/ui/DataList';
import { Button } from '../components/ui/Button';
import { PageSpinner, EmptyState, ErrorState } from '../components/ui/Spinner';
import { formatDate, shortId } from '../lib/utils';
import { Eye } from 'lucide-react';
import { OrderDetailModal, PillStrip, Pager, StatusBadgeOf } from './commerce/shared';

/**
 * One tenant's orders (tenant detail tab). Same redacted list + timeline
 * drawer as the cross-store Orders page, pre-filtered to this tenant.
 */
export default function TenantOrdersTab({ tenantId }: { tenantId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('ordersPage') || '1', 10) || 1);
  const status = ORDER_STATUSES.includes(searchParams.get('ordersStatus') as never) ? searchParams.get('ordersStatus')! : '';

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ open: boolean; loading: boolean; error: string | null; data: OrderDetail | null }>({ open: false, loading: false, error: null, data: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await commerceApi.orders.list({ tenantId, status, page, limit: 25 });
      setRows(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, status]);

  useEffect(() => { load(); }, [load]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key); else next.set(key, value);
    if (key === 'ordersStatus') next.delete('ordersPage');
    setSearchParams(next, { replace: true });
  };

  const openOrder = async (id: string) => {
    setDetail({ open: true, loading: true, error: null, data: null });
    try {
      setDetail({ open: true, loading: false, error: null, data: await commerceApi.orders.get(tenantId, id) });
    } catch (err) {
      setDetail({ open: true, loading: false, error: err instanceof Error ? err.message : 'Failed to load order', data: null });
    }
  };

  const columns: DataListColumn<OrderRow>[] = [
    { id: 'order', header: 'Order', primary: true, cell: (r) => <span className="font-medium">{r.orderNumber || shortId(r._id)}</span> },
    { id: 'customer', header: 'Customer', fullWidthOnMobile: true, cell: (r) => (
      <div className="min-w-0"><div className="truncate text-sm">{r.customer?.name || '—'}</div><div className="break-all text-xs text-muted-foreground" dir="ltr">{r.customer?.email || ''}</div></div>
    ) },
    { id: 'status', header: 'Status', cell: (r) => <StatusBadgeOf value={r.status} tone={ORDER_TONE} /> },
    { id: 'payment', header: 'Payment', cell: (r) => <StatusBadgeOf value={r.paymentStatus} tone={PAYMENT_TONE} /> },
    { id: 'total', header: 'Total', align: 'end', cell: (r) => <span className="whitespace-nowrap">{formatAmount(r.totalAmount, r.currency)}</span> },
    { id: 'placed', header: 'Placed', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
    { id: 'actions', align: 'end', cell: (r) => (
      <Button variant="ghost" size="sm" onClick={() => openOrder(r._id)} aria-label="View order"><Eye className="h-3.5 w-3.5" /></Button>
    ) },
  ];

  return (
    <div className="space-y-3">
      <PillStrip options={ORDER_STATUSES} value={status} onChange={(v) => setParam('ordersStatus', v || null)} allLabel="All" />

      {error ? <ErrorState error={error} onRetry={load} />
        : loading && rows.length === 0 ? <PageSpinner />
        : rows.length === 0 ? <EmptyState title="No orders" description="This tenant has no orders matching the filter." />
        : <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />}

      <Pager pagination={pagination} page={page} loading={loading} onPage={(n) => setParam('ordersPage', n <= 1 ? null : String(n))} />

      <OrderDetailModal open={detail.open} onClose={() => setDetail((d) => ({ ...d, open: false }))} loading={detail.loading} error={detail.error} data={detail.data} />
    </div>
  );
}
