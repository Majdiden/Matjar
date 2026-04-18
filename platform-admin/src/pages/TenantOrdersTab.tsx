import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type Pagination } from '../lib/api';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table';
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 rounded-md border bg-card p-1 w-fit">
        {STATUS_OPTIONS.map((s) => {
          const active = (s || '') === status;
          return (
            <button
              key={s || 'all'}
              onClick={() => setParam('ordersStatus', s || null)}
              className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
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

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <PageSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No orders" description="This tenant has no orders matching the filter." />
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <THead>
                <TR>
                  <TH>Order</TH>
                  <TH>Customer</TH>
                  <TH>Status</TH>
                  <TH>Payment</TH>
                  <TH>Total</TH>
                  <TH>Placed</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r._id}>
                    <TD className="font-medium">
                      {r.orderNumber || shortId(r._id)}
                    </TD>
                    <TD className="text-sm">{r.customerEmail || '—'}</TD>
                    <TD>
                      <Badge variant="outline" className="capitalize">
                        {r.status || 'unknown'}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge variant="outline" className="capitalize">
                        {r.paymentStatus || '—'}
                      </Badge>
                    </TD>
                    <TD>{formatMoney(r.total, r.currency || 'USD')}</TD>
                    <TD className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TD>
                    <TD>
                      <Button variant="ghost" size="sm" onClick={() => openOrder(r._id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
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
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(selected, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
  );
}
