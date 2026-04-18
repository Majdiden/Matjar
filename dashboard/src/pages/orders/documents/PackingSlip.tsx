import React from 'react';
import { useParams } from 'react-router-dom';
import { useOrderAndStore, useAutoPrint, formatAddress } from './shared';
import type { OrderItem } from '../../../types';
import './print.css';

/**
 * Printable packing slip.
 *
 * Intentionally excludes prices (spec §14): warehouse / fulfillment staff
 * need SKU + qty + variant to pick, not financial detail. Auto-triggers
 * the browser's print dialog on mount so the operator can drop the tab
 * straight onto a printer queue.
 */
const PackingSlip: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { loading, error, order, store } = useOrderAndStore(id);
  useAutoPrint(!loading && !!order);

  if (loading) return <div className="p-8 text-sm">Loading packing slip…</div>;
  if (error || !order) return <div className="p-8 text-sm text-red-600">Failed to load order{error ? `: ${error}` : ''}.</div>;

  const orderNumber = order.orderNumber || `#${String(order._id).slice(-6).toUpperCase()}`;
  const addressLines = formatAddress(order.shippingAddress);
  const tracking = order.trackingNumber || '';
  const carrier = order.trackingCarrier || '';

  return (
    <div className="document-page">
      <header className="doc-header">
        <div className="doc-header-left">
          {store?.logo ? (
            <img src={store.logo} alt={store.storeName} className="doc-logo" />
          ) : null}
          <div>
            <div className="doc-store-name">{store?.storeName || 'Store'}</div>
            {store?.storeDescription ? (
              <div className="doc-muted">{store.storeDescription}</div>
            ) : null}
          </div>
        </div>
        <div className="doc-header-right">
          <div className="doc-title">Packing Slip</div>
          <div className="doc-muted">Order {orderNumber}</div>
          <div className="doc-muted">{new Date(order.createdAt).toLocaleString()}</div>
        </div>
      </header>

      <section className="doc-grid">
        <div>
          <div className="doc-section-title">Ship to</div>
          {addressLines.length === 0 ? (
            <div className="doc-muted">No shipping address</div>
          ) : (
            addressLines.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>
        <div>
          <div className="doc-section-title">Shipment</div>
          <div>Carrier: {carrier || '—'}</div>
          <div>Tracking: {tracking || '—'}</div>
          {order.shippingMethod?.name ? (
            <div>Method: {order.shippingMethod.name}</div>
          ) : null}
        </div>
      </section>

      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: '60%' }}>Item</th>
            <th>SKU</th>
            <th style={{ textAlign: 'right' }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {(order.products || []).map((item: OrderItem, idx: number) => {
            const productObj = typeof item.product === 'object' ? item.product : null;
            const name = productObj?.name || item.name || 'Product';
            const sku = productObj?.sku || item.sku || '—';
            const variants: Array<{ name: string; value: string }> =
              item.variantOptions || [];
            return (
              <tr key={idx}>
                <td>
                  <div>{name}</div>
                  {variants.length > 0 && (
                    <div className="doc-muted doc-small">
                      {variants.map((v) => `${v.name}: ${v.value}`).join(' · ')}
                    </div>
                  )}
                </td>
                <td>{sku}</td>
                <td style={{ textAlign: 'right' }}>{item.quantity}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="doc-footer">
        <div className="doc-muted doc-small">
          This packing slip intentionally omits prices.
        </div>
      </footer>
    </div>
  );
};

export default PackingSlip;
