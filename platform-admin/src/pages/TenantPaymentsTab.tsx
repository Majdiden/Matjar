import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { DataList, type DataListColumn } from '../components/ui/DataList';
import { Badge } from '../components/ui/Badge';
import { PageSpinner, EmptyState, ErrorState } from '../components/ui/Spinner';
import { formatDate, formatMoney, shortId } from '../lib/utils';

interface PaymentRow {
  _id: string;
  orderId?: string;
  provider?: string;
  providerPaymentId?: string;
  status?: string;
  amount?: number;
  currency?: string;
  createdAt: string;
}

export default function TenantPaymentsTab({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.tenants.listPayments(tenantId);
      setRows(data as PaymentRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (loading) return <PageSpinner />;
  if (rows.length === 0) {
    return <EmptyState title="No payments" description="This tenant has no recorded payments." />;
  }

  const columns: DataListColumn<PaymentRow>[] = [
    { id: 'provider', header: 'Provider', primary: true, cell: (r) => <span className="capitalize">{r.provider || '—'}</span> },
    { id: 'pid', header: 'Provider ID', fullWidthOnMobile: true, cell: (r) => <span className="break-all text-xs text-muted-foreground">{r.providerPaymentId || shortId(r._id)}</span> },
    { id: 'order', header: 'Order', cell: (r) => <span className="text-xs">{r.orderId ? shortId(r.orderId) : '—'}</span> },
    { id: 'status', header: 'Status', cell: (r) => <Badge variant="outline" className="capitalize">{r.status || 'unknown'}</Badge> },
    { id: 'amount', header: 'Amount', cell: (r) => formatMoney(r.amount, r.currency || 'USD') },
    { id: 'created', header: 'Created', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
  ];

  return <DataList columns={columns} rows={rows} rowKey={(r) => r._id} />;
}
