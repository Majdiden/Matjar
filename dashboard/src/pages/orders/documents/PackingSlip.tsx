import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useOrderAndStore, useAutoPrint, formatAddress } from './shared';
import PrintToolbar from './PrintToolbar';
import type { OrderItem } from '../../../types';
import { formatDateTime } from '../../../lib/format';
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
  const { t } = useTranslation(['orders']);
  const ps = (key: string) => t(`orders:document.packing_slip.${key}`);
  const { id } = useParams<{ id: string }>();
  const { loading, error, order, store } = useOrderAndStore(id);
  useAutoPrint(!loading && !!order);

  if (loading) return <div className="p-8 text-sm">{ps('loading')}</div>;
  if (error || !order) return <div className="p-8 text-sm text-red-600">{ps('error')}{error ? `: ${error}` : ''}.</div>;

  const orderNumber = order.orderNumber || `#${String(order._id).slice(-6).toUpperCase()}`;
  const addressLines = formatAddress(order.shippingAddress);
  const tracking = order.trackingNumber || '';
  const carrier = order.trackingCarrier || '';

  return (
    <>
    <PrintToolbar />
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
          <div className="doc-title">{ps('title')}</div>
          <div className="doc-muted">Order {orderNumber}</div>
          <div className="doc-muted">{formatDateTime(order.createdAt)}</div>
        </div>
      </header>

      <section className="doc-grid">
        <div>
          <div className="doc-section-title">{ps('ship_to')}</div>
          {addressLines.length === 0 ? (
            <div className="doc-muted">{t('orders:document.packing_slip.no_shipping_address')}</div>
          ) : (
            addressLines.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>
        <div>
          <div className="doc-section-title">{ps('shipment_section')}</div>
          <div>{ps('carrier')}: {carrier || '—'}</div>
          <div>{ps('tracking')}: {tracking || '—'}</div>
          {order.shippingMethod?.name ? (
            <div>{ps('method')}: {order.shippingMethod.name}</div>
          ) : null}
        </div>
      </section>

      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: '60%' }}>{ps('column.item')}</th>
            <th>{ps('column.sku')}</th>
            <th style={{ textAlign: 'end' }}>{ps('column.qty')}</th>
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
                <td style={{ textAlign: 'end' }}>{item.quantity}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="doc-footer">
        <div className="doc-muted doc-small">
          {ps('omits_prices')}
        </div>
      </footer>
    </div>
    </>
  );
};

export default PackingSlip;
