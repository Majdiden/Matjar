import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type Pagination } from '../lib/api';
import { DataList, type DataListColumn } from '../components/ui/DataList';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageSpinner, EmptyState, ErrorState } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { formatDate, formatMoney, shortId } from '../lib/utils';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface OrderRow {
  _id: string;
  orderNumber?: string;
  status?: string;
  fulfillmentStatus?: string;
  paymentStatus?: string;
  total?: number;
  currency?: string;
  customerEmail?: string;
  createdAt: string;
}

const STATUS_OPTIONS = ['', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function TenantOrdersTab({ tenantId }: { tenantId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('ordersPage') || '1', 10);
  const status = searchParams.get('ordersStatus') || '';

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<unknown>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.tenants.listOrders(tenantId, {
        page,
        limit: 25,
        status: status || undefined,
      });
      setRows(data.orders as OrderRow[]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key === 'ordersStatus') next.delete('ordersPage');
    setSearchParams(next, { replace: true });
  };

  const openOrder = async (id: string) => {
    setSelected({ _loading: true, _id: id });
    setDetailLoading(true);
    try {
      const data = await api.tenants.getOrder(tenantId, id);
      setSelected(data);
    } catch (err) {
      setSelected({ _error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: DataListColumn<OrderRow>[] = [
    { id: 'order', header: 'Order', primary: true, cell: (r) => <span className="font-medium">{r.orderNumber || shortId(r._id)}</span> },
    { id: 'customer', header: 'Customer', fullWidthOnMobile: true, cell: (r) => <span className="break-all text-sm">{r.customerEmail || '—'}</span> },
    { id: 'status', header: 'Status', cell: (r) => <Badge variant="outline" className="capitalize">{r.status || 'unknown'}</Badge> },
    { id: 'payment', header: 'Payment', cell: (r) => <Badge variant="outline" className="capitalize">{r.paymentStatus || '—'}</Badge> },
    { id: 'total', header: 'Total', cell: (r) => formatMoney(r.total, r.currency || 'USD') },
    { id: 'placed', header: 'Placed', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
    {
      id: 'actions',
      align: 'end',
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => openOrder(r._id)} aria-label="View order">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:overflow-visible md:px-0">
        <div className="flex w-max items-center gap-1 rounded-md border bg-card p-1">
        {STATUS_OPTIONS.map((s) => {
          const active = (s || '') === status;
          return (
            <button
              key={s || 'all'}
              onClick={() => setParam('ordersStatus', s || null)}
              className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs capitalize transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {s || 'All'}
            </button>
          );
        })}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <PageSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No orders" description="This tenant has no orders matching the filter." />
      ) : (
        <>
          <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />

          {pagination && pagination.pages > 1 && (
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground">
                Page {pagination.page} of {pagination.pages} · {pagination.total} total
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setParam('ordersPage', String(page - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages || loading}
                  onClick={() => setParam('ordersPage', String(page + 1))}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Order detail"
        className="max-w-3xl"
      >
        {detailLoading ? (
          <PageSpinner />
        ) : (
          <pre className="max-h-[60vh] max-w-full overflow-auto rounded-md bg-muted p-3 text-[11px] sm:text-xs">
            {JSON.stringify(selected, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
  );
}
