import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table';
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

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <THead>
          <TR>
            <TH>Provider</TH>
            <TH>Provider ID</TH>
            <TH>Order</TH>
            <TH>Status</TH>
            <TH>Amount</TH>
            <TH>Created</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r._id}>
              <TD className="capitalize">{r.provider || '—'}</TD>
              <TD className="text-xs text-muted-foreground">{r.providerPaymentId || shortId(r._id)}</TD>
              <TD className="text-xs">{r.orderId ? shortId(r.orderId) : '—'}</TD>
              <TD>
                <Badge variant="outline" className="capitalize">
                  {r.status || 'unknown'}
                </Badge>
              </TD>
              <TD>{formatMoney(r.amount, r.currency || 'USD')}</TD>
              <TD className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
