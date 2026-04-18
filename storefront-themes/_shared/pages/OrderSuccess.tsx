import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../api/client';
import { useStore } from '../contexts/StoreContext';

/**
 * Order Success / Thank-You page
 *
 * Shown immediately after a successful checkout. Two entry points:
 *   1. /order-success/:id          — direct URL with the order id
 *   2. /order-success              — fallback, reads id from
 *      `location.state.order` (passed by Checkout.placeOrder)
 *
 * For logged-in customers we re-fetch the full order from the API so the
 * page survives a refresh. For guests we lean on whatever the create-order
 * response handed us via navigation state — guests have no auth token to
 * refetch with, and their tracking link is the public guest-tracking page.
 */

interface OrderSuccessProps {
  className?: string;
  accentColor?: string;
}

interface OrderLine {
  product?: any;
  name?: string;
  sku?: string;
  quantity: number;
  price: number;
}

interface Order {
  _id: string;
  orderNumber?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  products?: OrderLine[];
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  discount?: number;
  totalAmount: number;
  shippingAddress?: any;
  guestCustomer?: { email?: string };
  user?: { email?: string };
  trackingToken?: string;
  createdAt?: string;
}

const OrderSuccess: React.FC<OrderSuccessProps> = ({ className = '', accentColor }) => {
  const params = useParams<{ id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { formatPrice, store } = useStore();

  const accent = accentColor || 'var(--color-primary, #2563eb)';
  const stateOrder: Order | undefined = (location.state as any)?.order;
  const orderId = params.id || stateOrder?._id;
  const trackingToken = stateOrder?.trackingToken;

  const [order, setOrder] = useState<Order | null>(stateOrder || null);
  const [loading, setLoading] = useState(!stateOrder && !!orderId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      // No id at all — kick the user back to the home page rather than
      // sit on a broken thank-you screen.
      navigate('/', { replace: true });
      return;
    }

    // Always re-fetch when we have a token: gives us the canonical order
    // (with the orderNumber the backend allocated, history, etc.)
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (!token) {
      // Guest checkout — rely on whatever came in via state.
      if (!stateOrder) {
        setError("We couldn't find that order. Please check your email for the confirmation.");
      }
      return;
    }

    setLoading(true);
    ordersApi
      .get(orderId)
      .then((res: any) => {
        const fetched = res?.responseObject?.order || res?.responseObject || res?.data?.order;
        if (fetched) setOrder(fetched);
      })
      .catch((err) => {
        // Don't blow up — fall back to whatever came in via state.
        if (!stateOrder) setError(err?.message || 'Failed to load order');
      })
      .finally(() => setLoading(false));
    // We intentionally only run this on mount: orderId can't change without
    // a full route remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading skeleton ────────────────────────────────────────────
  if (loading && !order) {
    return (
      <div className={`max-w-3xl mx-auto px-4 sm:px-6 py-16 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-16 w-16 rounded-full bg-gray-200 mx-auto" />
          <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
          <div className="h-64 bg-gray-100 rounded mt-8" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={`max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center ${className}`}>
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center mb-4">
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M12 21a9 9 0 110-18 9 9 0 010 18z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">We couldn't load your order</h1>
        <p className="text-gray-500 mb-6">{error || "If you've just placed an order, check your email for the confirmation."}</p>
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

  const customerEmail = order.user?.email || order.guestCustomer?.email;
  const trackingParams = new URLSearchParams();
  if (customerEmail) trackingParams.set('email', customerEmail);
  if (trackingToken) trackingParams.set('token', trackingToken);
  const trackingHref = `/orders/${order._id}${trackingParams.toString() ? `?${trackingParams.toString()}` : ''}`;
  const lines = order.products || [];
  const placedAt = order.createdAt ? new Date(order.createdAt) : new Date();

  return (
    <div className={`max-w-3xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <div
          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-5 ring-8 ring-opacity-10"
          style={{
            backgroundColor: accent,
            // @ts-ignore — CSS vars on a style object
            '--tw-ring-color': accent,
          }}
        >
          <svg width="36" height="36" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Thank you for your order!</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          Your order <span className="font-semibold text-gray-800">{order.orderNumber || `#${order._id.slice(-6).toUpperCase()}`}</span> has been received.
          {customerEmail && (
            <> A confirmation has been sent to <span className="font-medium text-gray-800">{customerEmail}</span>.</>
          )}
        </p>
      </div>

      {/* ── Receipt card ─────────────────────────────────────── */}
      <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
        {/* Header strip */}
        <div className="px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Order placed</p>
            <p className="text-sm font-medium">
              {placedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}
              {placedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Order total</p>
            <p className="text-xl font-bold" style={{ color: accent }}>{formatPrice(order.totalAmount)}</p>
          </div>
        </div>

        {/* Items */}
        <div className="px-6 py-4 divide-y">
          {lines.map((item, i) => {
            const productName = item.name || (typeof item.product === 'object' && item.product?.name) || 'Item';
            const productImage = typeof item.product === 'object' ? item.product?.images?.[0] : undefined;
            return (
              <div key={i} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <div className="w-14 h-14 rounded border bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {productImage ? (
                    <img src={productImage} alt={productName} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h17.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 012.25 16.875v-9.75z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{productName}</p>
                  {Array.isArray(item.variantOptions) && item.variantOptions.length > 0 && (
                    <p className="text-xs text-gray-500 truncate">
                      {item.variantOptions.map((o: any) => `${o.name}: ${o.value}`).join(' / ')}
                    </p>
                  )}
                  {(item as any).isPreorder && (
                    <p className="text-xs text-amber-600 font-medium">
                      Pre-order
                      {(item as any).preorderExpectedShipDate
                        ? ` — ships ${new Date((item as any).preorderExpectedShipDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : ''}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">Qty {item.quantity} · {formatPrice(item.price)} each</p>
                </div>
                <p className="text-sm font-semibold whitespace-nowrap">{formatPrice(item.price * item.quantity)}</p>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="px-6 py-4 border-t bg-gray-50/50 space-y-1.5 text-sm">
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
          <div className="flex justify-between text-base font-bold pt-2 mt-2 border-t">
            <span>Total</span>
            <span>{formatPrice(order.totalAmount)}</span>
          </div>
        </div>

        {/* Shipping address + payment */}
        {(order.shippingAddress || order.paymentMethod) && (
          <div className="px-6 py-5 border-t grid sm:grid-cols-2 gap-6 text-sm">
            {order.shippingAddress && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Shipping to</p>
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
            )}
            {order.paymentMethod && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Payment</p>
                <p className="font-medium capitalize">
                  {order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod}
                </p>
                {order.paymentStatus && (
                  <p className="text-gray-600 text-xs mt-0.5">{order.paymentStatus}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Next steps ───────────────────────────────────────── */}
      <div className="mt-8 grid sm:grid-cols-2 gap-3">
        <Link
          to={trackingHref}
          className="px-6 py-3 rounded-lg text-white font-medium text-center hover:opacity-90 transition"
          style={{ backgroundColor: accent }}
        >
          Track your order
        </Link>
        <Link
          to="/products"
          className="px-6 py-3 rounded-lg border font-medium text-center hover:bg-gray-50 transition"
        >
          Continue shopping
        </Link>
      </div>

      {/* Helpful note */}
      <p className="text-center text-xs text-gray-500 mt-8">
        Questions about your order? <Link to="/contact" className="underline">Contact {store?.name || 'us'}</Link>.
      </p>
    </div>
  );
};

export default OrderSuccess;
