import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOrderAndStore, useAutoPrint } from './shared';
import { api } from '../../../lib/api-client';
import { formatPrice } from '../../../lib/format';
import type { OrderWithExtras, Payment } from '../../../types';
import './print.css';

/** The /payments/order/:id endpoint returns an envelope like
 * `{ data: { payments: [...] } }` or `{ responseObject: { payments: [...] } }`
 * depending on backend version. Narrow-typed so consumers get safety
 * without coupling to every legacy shape. */
interface PaymentsListEnvelope {
  data?: { payments?: Payment[] };
  responseObject?: { payments?: Payment[] };
}

/**
 * Printable refund receipt for a single refund (Payment row with
 * status="refunded"). Shows the amount, original order number, reason,
 * method, and timestamp — the minimum a customer needs as proof of
 * refund and an accountant needs for reconciliation.
 */
const RefundReceipt: React.FC = () => {
  const { id, refundId } = useParams<{ id: string; refundId: string }>();
  const { loading, error, order, store } = useOrderAndStore(id);
  const [refund, setRefund] = useState<Payment | null>(null);
  const [refundErr, setRefundErr] = useState<string | null>(null);
  const [refundLoading, setRefundLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      try {
        setRefundLoading(true);
        const res = await api.payments.listForOrder(id) as PaymentsListEnvelope;
        const data = res?.data || res?.responseObject || {};
        const list: Payment[] = data.payments || [];
        const match = list.find((p) => String(p._id) === String(refundId));
        if (cancelled) return;
        if (!match) {
          setRefundErr('Refund not found for this order');
          setRefund(null);
        } else {
          setRefund(match);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : null;
        if (!cancelled) setRefundErr(msg || 'Failed to load refund');
      } finally {
        if (!cancelled) setRefundLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, refundId]);

  const ready = !loading && !refundLoading && !!order && !!refund;
  useAutoPrint(ready);

  if (loading || refundLoading) return <div className="p-8 text-sm">Loading refund receipt…</div>;
  if (error || !order) return <div className="p-8 text-sm text-red-600">Failed to load order{error ? `: ${error}` : ''}.</div>;
  if (refundErr || !refund) return <div className="p-8 text-sm text-red-600">{refundErr || 'Refund not found.'}</div>;

  const orderNumber = order.orderNumber || `#${String(order._id).slice(-6).toUpperCase()}`;
  const reason = refund?.metadata?.reason || refund?.reason || '—';
  const method =
    refund?.paymentMethod ||
    refund?.provider ||
    (refund?.metadata?.manual ? 'Manual' : '—');
  const currency = (order as OrderWithExtras).baseCurrency || store?.currency;
  const amount = Number(refund.amount) || 0;
  const when = refund.createdAt ? new Date(refund.createdAt) : new Date();

  return (
    <div className="document-page">
      <header className="doc-header">
        <div className="doc-header-left">
          {store?.logo ? (
            <img src={store.logo} alt={store.storeName} className="doc-logo" />
          ) : null}
          <div>
            <div className="doc-store-name">{store?.storeName || 'Store'}</div>
            {store?.email ? <div className="doc-muted doc-small">{store.email}</div> : null}
          </div>
        </div>
        <div className="doc-header-right">
          <div className="doc-title">Refund Receipt</div>
          <div className="doc-muted">Refund {String(refund._id).slice(-8).toUpperCase()}</div>
          <div className="doc-muted">{when.toLocaleString()}</div>
        </div>
      </header>

      <section className="doc-refund-amount">
        <div className="doc-muted">Refund amount</div>
        <div className="doc-refund-value">{formatPrice(amount, currency)}</div>
      </section>

      <section className="doc-grid">
        <div>
          <div className="doc-section-title">Original order</div>
          <div>Order {orderNumber}</div>
          <div className="doc-muted doc-small">
            Placed {new Date(order.createdAt).toLocaleString()}
          </div>
          <div className="doc-muted doc-small">
            Order total: {formatPrice(order.totalAmount || 0, currency)}
          </div>
        </div>
        <div>
          <div className="doc-section-title">Refund details</div>
          <div>Method: {method}</div>
          <div>Reason: {reason}</div>
          {refund?.providerTransactionId ? (
            <div className="doc-muted doc-small">Tx: {refund.providerTransactionId}</div>
          ) : null}
          {refund?.eventId ? (
            <div className="doc-muted doc-small">Event: {refund.eventId}</div>
          ) : null}
        </div>
      </section>

      <footer className="doc-footer">
        {store?.storeName ? (
          <div className="doc-muted doc-small">
            {store.storeName}
            {store?.address ? ` · ${store.address}` : ''}
            {store?.email ? ` · ${store.email}` : ''}
          </div>
        ) : null}
      </footer>
    </div>
  );
};

export default RefundReceipt;
