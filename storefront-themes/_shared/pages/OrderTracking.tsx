import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ordersApi } from '../api/client';
import { useStore } from '../contexts/StoreContext';
import { useConfirm } from '../components/primitives/ConfirmDialog';

/**
 * Customer-facing order tracking page (/orders/:id).
 *
 * Two access modes, both backed by `ordersApi.track`:
 *   1. Logged-in customer — bearer token proves ownership, no email needed.
 *   2. Guest — must enter the email used at checkout. We don't disclose
 *      whether the order id exists until the email matches; the backend
 *      returns 404 in either failure case so the response shape can't
 *      be used to enumerate order ids.
 *
 * The page mirrors the dashboard order detail layout but stripped of
 * staff-only controls: status badge, friendly timeline, line items,
 * shipping address, totals, and tracking number/carrier when available.
 */

interface OrderTrackingProps {
  className?: string;
  accentColor?: string;
}

interface HistoryEntry {
  event: string;
  status?: string;
  previousStatus?: string;
  note?: string;
  at: string;
}

interface TrackedFulfillment {
  _id: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  items: Array<{ orderLineId: string; quantity: number }>;
  trackingNumber?: string;
  trackingCarrier?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  createdAt: string;
}

interface TrackedOrder {
  _id: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  products: Array<{
    _id?: string;
    product?: any;
    name?: string;
    sku?: string;
    quantity: number;
    price: number;
  }>;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  discount?: number;
  totalAmount: number;
  giftCardRedemption?: {
    code?: string;
    codeLast4?: string;
    amount?: number;
    redeemedAt?: string;
  };
  shippingAddress?: any;
  trackingNumber?: string;
  trackingCarrier?: string;
  fulfillments?: TrackedFulfillment[];
  history?: HistoryEntry[];
  createdAt: string;
}

const SHIPMENT_STATUS_COPY: Record<TrackedFulfillment['status'], { label: string; tint: string }> = {
  Pending:   { label: 'Preparing',  tint: 'bg-amber-50 text-amber-700'   },
  Shipped:   { label: 'Shipped',    tint: 'bg-sky-50 text-sky-700'       },
  Delivered: { label: 'Delivered',  tint: 'bg-emerald-50 text-emerald-700' },
  Cancelled: { label: 'Cancelled',  tint: 'bg-red-50 text-red-700'       },
};

// Map the order's *current* status to a customer-friendly label and color
// — same idea as the dashboard timeline, kept here so themes don't have to
// import dashboard code.
const STATUS_COPY: Record<string, { label: string; tint: string; ring: string }> = {
  Pending:    { label: 'Order received',     tint: 'bg-amber-50 text-amber-700',     ring: 'ring-amber-500'   },
  Processing: { label: 'Being prepared',     tint: 'bg-violet-50 text-violet-700',   ring: 'ring-violet-500'  },
  Shipped:    { label: 'On its way',         tint: 'bg-sky-50 text-sky-700',         ring: 'ring-sky-500'     },
  Delivered:  { label: 'Delivered',          tint: 'bg-emerald-50 text-emerald-700', ring: 'ring-emerald-500' },
  Cancelled:  { label: 'Cancelled',          tint: 'bg-red-50 text-red-700',         ring: 'ring-red-500'     },
  Refunded:   { label: 'Refunded',           tint: 'bg-rose-50 text-rose-700',       ring: 'ring-rose-500'    },
};

// Linear progress journey for non-terminal orders.
const PROGRESS_STEPS = ['Pending', 'Processing', 'Shipped', 'Delivered'] as const;

const eventLabel = (entry: HistoryEntry): string => {
  if (entry.event === 'created') return 'Order placed';
  if (entry.event === 'cancelled') return 'Order cancelled';
  if (entry.event === 'tracking_updated') return 'Tracking information updated';
  if (entry.event === 'note_added') return 'Note added';
  if (entry.event === 'status_changed' && entry.status) {
    return STATUS_COPY[entry.status]?.label || entry.status;
  }
  return entry.event;
};

const OrderTracking: React.FC<OrderTrackingProps> = ({ className = '', accentColor }) => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { formatPrice } = useStore();

  const accent = accentColor || 'var(--color-primary, #2563eb)';

  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const trackingToken = searchParams.get('token') || undefined;
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const confirm = useConfirm();

  const handleCancel = async () => {
    if (!id) return;
    const confirmed = await confirm({
      title: 'Cancel this order?',
      description: 'This cannot be undone — any reserved stock will be released.',
      confirmText: 'Cancel order',
      cancelText: 'Keep order',
      variant: 'destructive',
    });
    if (!confirmed) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await ordersApi.cancel(id);
      // Refetch so the page reflects the new status, history, and any
      // restored stock counters.
      fetchOrder(email || undefined);
    } catch (err: any) {
      setCancelError(err?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const fetchOrder = (emailHint?: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    ordersApi
      .track(id, emailHint?.trim(), trackingToken)
      .then((res: any) => {
        const fetched = res?.data?.order || res?.responseObject?.order;
        if (fetched) {
          setOrder(fetched);
          setNeedsEmail(false);
        } else {
          setError('Order not found');
        }
      })
      .catch((err: any) => {
        // 404 from the backend means either: order doesn't exist, OR
        // guest didn't supply a matching email. We can't distinguish, so
        // we always offer the email form when the user has no token.
        const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
        if (!token) {
          setNeedsEmail(true);
        } else {
          setError(err?.message || 'Failed to load order');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder(email || undefined);
    // Run once on mount; the email form re-triggers via its own handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Email gate for guests ───────────────────────────────────────
  if (needsEmail && !order) {
    return (
      <div className={`max-w-md mx-auto px-4 sm:px-6 py-16 ${className}`}>
        <h1 className="text-2xl font-bold mb-2 text-center">Track your order</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Enter the email address you used at checkout to view this order.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchOrder(email);
          }}
          className="space-y-4 border rounded-2xl p-6 bg-white shadow-sm"
        >
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': accent } as React.CSSProperties}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {loading ? 'Looking up…' : 'View order'}
          </button>
          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
        </form>
      </div>
    );
  }

  // ── Loading skeleton ────────────────────────────────────────────
  if (loading && !order) {
    return (
      <div className={`max-w-4xl mx-auto px-4 sm:px-6 py-16 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-100 rounded" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={`max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center ${className}`}>
        <h1 className="text-2xl font-bold mb-2">Order not found</h1>
        <p className="text-gray-500 mb-6">{error || "We couldn't find an order with that reference."}</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition"
          style={{ backgroundColor: accent }}
        >
          Back to home
        </Link>
      </div>
    );
  }

  const statusCopy = STATUS_COPY[order.status] || { label: order.status, tint: 'bg-gray-100 text-gray-700', ring: 'ring-gray-400' };
  const placedAt = new Date(order.createdAt);
  const isTerminal = order.status === 'Cancelled' || order.status === 'Refunded';
  const currentStepIdx = PROGRESS_STEPS.indexOf(order.status as any);

  // Sort history newest-first for the timeline.
  const history = [...(order.history || [])].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Order</p>
          <h1 className="text-3xl font-bold">
            {order.orderNumber || `#${order._id.slice(-6).toUpperCase()}`}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Placed {placedAt.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${statusCopy.tint}`}>
            {statusCopy.label}
          </span>
          {(order.status === 'Pending' || order.status === 'Processing') && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 hover:border-red-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
          )}
        </div>
      </div>
      {cancelError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {cancelError}
        </div>
      )}

      {/* ── Progress strip (skip for cancelled/refunded) ─────── */}
      {!isTerminal && (
        <div className="mb-8 border rounded-2xl bg-white shadow-sm p-6">
          <div className="flex items-center justify-between relative">
            {/* baseline */}
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200" />
            {/* filled track */}
            <div
              className="absolute left-0 top-4 h-0.5 transition-all"
              style={{
                width: currentStepIdx >= 0
                  ? `${(currentStepIdx / (PROGRESS_STEPS.length - 1)) * 100}%`
                  : '0%',
                backgroundColor: accent,
              }}
            />
            {PROGRESS_STEPS.map((step, idx) => {
              const reached = currentStepIdx >= 0 && idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={step} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      reached ? 'text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
                    }`}
                    style={reached ? { backgroundColor: accent } : undefined}
                  >
                    {reached ? '✓' : idx + 1}
                  </div>
                  <p className={`text-[11px] mt-2 font-medium text-center ${isCurrent ? '' : 'text-gray-500'}`}
                     style={isCurrent ? { color: accent } : undefined}>
                    {STATUS_COPY[step].label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tracking number callout ──────────────────────────── */}
      {order.trackingNumber && (
        <div className="mb-8 border rounded-2xl bg-white shadow-sm p-6 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accent}15` }}
          >
            <svg width="22" height="22" fill="none" stroke={accent} strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Tracking number</p>
            <p className="font-mono text-sm font-semibold">{order.trackingNumber}</p>
            {order.trackingCarrier && (
              <p className="text-xs text-gray-500 mt-0.5">via {order.trackingCarrier}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Items + totals ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">Order items</h2>
            </div>
            <div className="px-6 py-2 divide-y">
              {order.products.map((item, i) => {
                const productName = item.name || (typeof item.product === 'object' && item.product?.name) || 'Item';
                const productImage = typeof item.product === 'object' ? item.product?.images?.[0] : undefined;
                return (
                  <div key={i} className="flex gap-4 py-4">
                    <div className="w-16 h-16 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {productImage ? (
                        <img src={productImage} alt={productName} className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h17.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 012.25 16.875v-9.75z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{productName}</p>
                      {Array.isArray((item as any).variantOptions) && (item as any).variantOptions.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(item as any).variantOptions.map((o: any) => `${o.name}: ${o.value}`).join(' / ')}
                        </p>
                      )}
                      {(item as any).isPreorder && (
                        <p className="text-xs text-amber-600 font-medium mt-0.5">
                          Pre-order
                          {(item as any).preorderExpectedShipDate
                            ? ` — ships ${new Date((item as any).preorderExpectedShipDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                            : ''}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">Qty {item.quantity} · {formatPrice(item.price)}</p>
                    </div>
                    <p className="text-sm font-semibold whitespace-nowrap">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 bg-gray-50/50 border-t space-y-1.5 text-sm">
              {order.subtotal !== undefined && (
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
              )}
              {(order.discount ?? 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−{formatPrice(order.discount!)}</span>
                </div>
              )}
              {(order.shippingCost ?? 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>{formatPrice(order.shippingCost!)}</span>
                </div>
              )}
              {(order.tax ?? 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{formatPrice(order.tax!)}</span>
                </div>
              )}
              {(order.giftCardRedemption?.amount ?? 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Gift card{order.giftCardRedemption?.codeLast4 ? ` (•••• ${order.giftCardRedemption.codeLast4})` : ''}</span>
                  <span>−{formatPrice(order.giftCardRedemption!.amount!)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 mt-2 border-t">
                <span>Total</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {(order.fulfillments || []).length > 0 && (
            <div className="border rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold">Shipments</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(order.fulfillments || []).length} shipment
                  {(order.fulfillments || []).length === 1 ? '' : 's'} for this order
                </p>
              </div>
              <div className="divide-y">
                {(order.fulfillments || []).map((f, idx) => {
                  const copy = SHIPMENT_STATUS_COPY[f.status] || { label: f.status, tint: 'bg-gray-100 text-gray-700' };
                  const lineNameFor = (lineId: string) => {
                    const line = order.products.find(p => String(p._id) === String(lineId));
                    return line?.name || (typeof line?.product === 'object' ? line?.product?.name : 'Item');
                  };
                  const dateLabel =
                    f.deliveredAt ? `Delivered ${new Date(f.deliveredAt).toLocaleDateString()}` :
                    f.shippedAt   ? `Shipped ${new Date(f.shippedAt).toLocaleDateString()}` :
                    f.cancelledAt ? `Cancelled ${new Date(f.cancelledAt).toLocaleDateString()}` :
                                    `Created ${new Date(f.createdAt).toLocaleDateString()}`;
                  return (
                    <div key={f._id} className="px-6 py-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Shipment {idx + 1}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${copy.tint}`}>
                            {copy.label}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{dateLabel}</span>
                      </div>
                      <ul className="text-sm space-y-0.5">
                        {f.items.map((it, i) => (
                          <li key={i} className="text-gray-600">
                            <span className="text-gray-900">{lineNameFor(it.orderLineId)}</span>
                            {' '}× {it.quantity}
                          </li>
                        ))}
                      </ul>
                      {(f.trackingNumber || f.trackingCarrier) && (
                        <p className="text-xs text-gray-500">
                          {f.trackingCarrier && <span>{f.trackingCarrier} </span>}
                          {f.trackingNumber && <span className="font-mono">{f.trackingNumber}</span>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {order.shippingAddress && (
            <div className="border rounded-2xl bg-white shadow-sm p-6">
              <h2 className="font-semibold mb-3">Shipping to</h2>
              <div className="text-sm space-y-0.5">
                <p className="font-medium">
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                </p>
                <p className="text-gray-600">{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && (
                  <p className="text-gray-600">{order.shippingAddress.addressLine2}</p>
                )}
                <p className="text-gray-600">
                  {order.shippingAddress.city}
                  {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''}{' '}
                  {order.shippingAddress.postalCode}
                </p>
                <p className="text-gray-600">{order.shippingAddress.country}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Timeline ───────────────────────────────────────── */}
        <div className="border rounded-2xl bg-white shadow-sm p-6 self-start">
          <h2 className="font-semibold mb-4">Activity</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No updates yet.</p>
          ) : (
            <ol className="relative space-y-5">
              {history.map((entry, idx) => {
                const isLatest = idx === 0;
                return (
                  <li key={idx} className="relative pl-6">
                    {idx < history.length - 1 && (
                      <span className="absolute left-[7px] top-3 bottom-[-22px] w-px bg-gray-200" />
                    )}
                    <span
                      className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white"
                      style={{ backgroundColor: isLatest ? accent : '#cbd5e1' }}
                    />
                    <p className={`text-sm font-medium ${isLatest ? '' : 'text-gray-700'}`}>
                      {eventLabel(entry)}
                    </p>
                    {entry.note && (
                      <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(entry.at).toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link to="/products" className="text-sm underline text-gray-600 hover:text-gray-900">
          ← Continue shopping
        </Link>
      </div>
    </div>
  );
};

export default OrderTracking;
