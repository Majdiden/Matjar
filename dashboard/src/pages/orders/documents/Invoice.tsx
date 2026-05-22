import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useOrderAndStore, useAutoPrint, formatAddress } from './shared';
import { formatPrice } from '../../../lib/format';
import type { OrderItem, OrderWithExtras } from '../../../types';
import './print.css';

/**
 * Printable invoice.
 *
 * Totals come from the order's stored fields — never recomputed. If the
 * merchant later edits a product price or tax rule, historical invoices
 * continue to match the money actually charged (spec §14 + §15).
 *
 * Tax is rendered as a single total line plus one line per entry in
 * `taxBreakdown` (per-jurisdiction / per-class rows captured at order
 * time). Shipping and discount are only shown when non-zero so we don't
 * clutter simple orders with zero rows.
 */
const Invoice: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const inv = (key: string) => t(`orders:document.invoice.${key}`);
  const { id } = useParams<{ id: string }>();
  const { loading, error, order, store } = useOrderAndStore(id);
  useAutoPrint(!loading && !!order);

  if (loading) return <div className="p-8 text-sm">{inv('loading')}</div>;
  if (error || !order) return <div className="p-8 text-sm text-red-600">{inv('error')}{error ? `: ${error}` : ''}.</div>;

  const orderNumber = order.orderNumber || `#${String(order._id).slice(-6).toUpperCase()}`;
  const o = order as OrderWithExtras;
  const currency = o.baseCurrency || store?.currency;
  const subtotal = typeof o.subtotal === 'number'
    ? o.subtotal
    : (order.products || []).reduce(
        (s: number, it: OrderItem) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0),
        0,
      );
  const tax = typeof o.tax === 'number' ? o.tax : 0;
  const shipping = typeof o.shippingCost === 'number' ? o.shippingCost : (o.shipping || 0);
  const discount = typeof o.discount === 'number' ? o.discount : 0;
  const total = typeof o.totalAmount === 'number' ? o.totalAmount : ((o as { total?: number }).total || 0);
  const taxBreakdown: Array<{ name: string; rate?: number; amount: number; productClass?: string }> =
    Array.isArray(o.taxBreakdown) ? o.taxBreakdown : [];

  const shipLines = formatAddress(order.shippingAddress);
  const billLines = formatAddress(order.billingAddress);

  // Pull the customer block from whichever of the three possible shapes
  // the order has — registered user, guest, or legacy snapshot.
  const user = order.user;
  const snap = order.customerSnapshot;
  const guest = order.guestCustomer;
  const customer: {
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  } = user
    ? { name: user.name, email: user.email }
    : snap
      ? { firstName: snap.firstName, lastName: snap.lastName, email: snap.email }
      : guest
        ? { firstName: guest.firstName, lastName: guest.lastName, email: guest.email }
        : {};
  const customerName =
    [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
    customer.name ||
    '';

  return (
    <div className="document-page">
      <header className="doc-header">
        <div className="doc-header-left">
          {store?.logo ? (
            <img src={store.logo} alt={store.storeName} className="doc-logo" />
          ) : null}
          <div>
            <div className="doc-store-name">{store?.storeName || 'Store'}</div>
            {store?.address ? <div className="doc-muted doc-small">{store.address}</div> : null}
            {store?.email ? <div className="doc-muted doc-small">{store.email}</div> : null}
            {store?.phone ? <div className="doc-muted doc-small">{store.phone}</div> : null}
          </div>
        </div>
        <div className="doc-header-right">
          <div className="doc-title">{inv('title')}</div>
          <div className="doc-muted">Order {orderNumber}</div>
          <div className="doc-muted">{new Date(order.createdAt).toLocaleString()}</div>
        </div>
      </header>

      <section className="doc-grid">
        <div>
          <div className="doc-section-title">{inv('bill_to')}</div>
          {customerName ? <div>{customerName}</div> : null}
          {customer.email ? <div className="doc-muted doc-small">{customer.email}</div> : null}
          {(billLines.length > 0 ? billLines : shipLines).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
        <div>
          <div className="doc-section-title">{inv('ship_to')}</div>
          {shipLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </section>

      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: '50%' }}>{inv('column.item')}</th>
            <th>{inv('column.sku')}</th>
            <th style={{ textAlign: 'end' }}>{inv('column.qty')}</th>
            <th style={{ textAlign: 'end' }}>{inv('column.price')}</th>
            <th style={{ textAlign: 'end' }}>{inv('column.line_total')}</th>
          </tr>
        </thead>
        <tbody>
          {(order.products || []).map((item: OrderItem, idx: number) => {
            const productObj = typeof item.product === 'object' ? item.product : null;
            const name = productObj?.name || item.name || 'Product';
            const sku = productObj?.sku || item.sku || '—';
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
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
                <td style={{ textAlign: 'end' }}>{qty}</td>
                <td style={{ textAlign: 'end' }}>{formatPrice(price, currency)}</td>
                <td style={{ textAlign: 'end' }}>{formatPrice(price * qty, currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="doc-totals">
        <dl>
          <dt>{inv('totals.subtotal')}</dt>
          <dd>{formatPrice(subtotal, currency)}</dd>

          {discount > 0 && (
            <>
              <dt>{inv('totals.discount')}</dt>
              <dd>−{formatPrice(discount, currency)}</dd>
            </>
          )}

          {shipping > 0 && (
            <>
              <dt>{inv('totals.shipping')}</dt>
              <dd>{formatPrice(shipping, currency)}</dd>
            </>
          )}

          {tax > 0 && (
            <>
              <dt>{inv('totals.tax')}</dt>
              <dd>{formatPrice(tax, currency)}</dd>
            </>
          )}

          {taxBreakdown.length > 0 && taxBreakdown.map((t, i) => (
            <React.Fragment key={i}>
              <dt className="doc-sub-dt">
                &nbsp;&nbsp;{t.name}
                {typeof t.rate === 'number' ? ` (${(t.rate * 100).toFixed(2)}%)` : ''}
                {t.productClass ? ` · ${t.productClass}` : ''}
              </dt>
              <dd className="doc-sub-dd">{formatPrice(t.amount, currency)}</dd>
            </React.Fragment>
          ))}

          <dt className="doc-grand">{inv('totals.total')}</dt>
          <dd className="doc-grand">{formatPrice(total, currency)}</dd>
        </dl>
      </section>

      <footer className="doc-footer">
        {store?.storeName ? (
          <div className="doc-muted doc-small">
            {store.storeName}
            {store?.address ? ` · ${store.address}` : ''}
            {store?.email ? ` · ${store.email}` : ''}
          </div>
        ) : null}
        <div className="doc-muted doc-small">
          {t('orders:document.invoice.payment_line', {
            method: order.paymentMethod || '—',
            status: t(`common.status.${order.paymentStatus}`, { ns: 'common', defaultValue: order.paymentStatus }),
          })}
        </div>
      </footer>
    </div>
  );
};

export default Invoice;
