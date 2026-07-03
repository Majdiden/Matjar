import type { ComponentType } from 'react';
import {
  Truck, CreditCard, Calendar, Mail, MapPin,
  AlertCircle, PackageCheck, PackagePlus, Ban, RefreshCw, FileText,
  ArrowDownLeft, Tag as TagIcon,
} from 'lucide-react';
import type {
  Order, OrderItem, OrderStatus, PaymentStatus, FulfillmentStatus,
  OrderHistoryEntry, Payment, PaymentMethodDefinition,
  OrderFulfillmentRef, OrderWithExtras,
} from '../../../types';

// Printable-doc links are opened with window.open (a raw URL the router's
// basename does NOT prepend). In the production build the router basename is
// `/dashboard`, so the URL must include it to reach the `/dashboard/orders/...`
// document routes; in dev (basename '/') it must not. Prepend accordingly.
const DOC_URL_PREFIX = import.meta.env.MODE === 'production' ? '/dashboard' : '';
export const orderDocUrl = (orderId: string, doc: string) =>
  `${DOC_URL_PREFIX}/dashboard/orders/${orderId}/${doc}`;

export const getLineId = (line: OrderItem | undefined | null): string => String(line?._id || '');

export const getEffectiveFulfilledQuantity = (order: Order, line: OrderItem): number => {
  const quantity = Number(line?.quantity) || 0;
  const explicit = Number(line?.fulfilledQuantity) || 0;
  if (explicit > 0) return Math.min(quantity, explicit);

  const lineId = getLineId(line);
  const orderExt = order as OrderWithExtras;
  const fulfillments: OrderFulfillmentRef[] = Array.isArray(orderExt.fulfillments)
    ? orderExt.fulfillments
    : [];
  const fromFulfillments = fulfillments
    .filter((f) => f?.status !== 'Cancelled')
    .reduce((sum: number, f) => {
      return sum + (Array.isArray(f?.items) ? f.items : []).reduce((s: number, item) => {
        return String(item?.orderLineId) === lineId ? s + (Number(item?.quantity) || 0) : s;
      }, 0);
    }, 0);
  if (fromFulfillments > 0) return Math.min(quantity, fromFulfillments);

  // Legacy/manual orders may have no fulfillment subdocuments or per-line
  // counters even though the merchant already marked the order fulfilled.
  if (
    ['Shipped', 'Delivered', 'Refunded'].includes(order.status) ||
    ['Fulfilled', 'Returned'].includes(String(order.fulfillmentStatus || ''))
  ) {
    return quantity;
  }

  return 0;
};

export const getReturnableQuantity = (order: Order, line: OrderItem): number => {
  const fulfilled = getEffectiveFulfilledQuantity(order, line);
  const refunded = Number(line?.refundedQuantity) || 0;
  return Math.max(0, fulfilled - refunded);
};

/** Loose envelopes for the /orders/* endpoints — the backend wraps the
 * returned order in either `.data` or `.responseObject` depending on
 * the route and legacy support tier. Kept here (not in the shared types
 * module) because only this screen consumes them. */
export interface OrderEnvelope {
  data?: Order | { order?: Order };
  responseObject?: Order | { order?: Order };
}

export const extractOrder = (res: unknown): Order | null => {
  const env = (res ?? {}) as OrderEnvelope;
  const fromResponseObject =
    (env.responseObject as { order?: Order } | undefined)?.order ||
    (env.responseObject as Order | undefined);
  const fromData =
    (env.data as { order?: Order } | undefined)?.order ||
    (env.data as Order | undefined);
  return (fromResponseObject || fromData || null) as Order | null;
};

/** Envelope for GET /api/payments/order/:id — the totals sit alongside
 * the payments list. Narrow-typed so the consumer can't accidentally
 * depend on an undocumented field. */
export interface PaymentsListEnvelope {
  data?: PaymentsBlock;
  responseObject?: PaymentsBlock;
}
export interface PaymentsBlock {
  payments?: Payment[];
  totalPaid?: number;
  totalRefunded?: number;
  maxRefundable?: number;
}

/** Envelope for GET /api/payment-methods — returns the merchant's list
 * of configured methods so we can resolve the one the order used. */
export interface PaymentMethodsEnvelope {
  data?: { methods?: PaymentMethodDefinition[] };
  responseObject?: { methods?: PaymentMethodDefinition[] };
}

// ─── Status pill + variant helpers ───────────────────────────────────
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

// Semantic status colours (audit 3.8.3) — brand blue is never a status.
export const orderStatusVariant = (s: OrderStatus): BadgeVariant => {
  switch (s) {
    case 'Draft': return 'outline';
    case 'Pending': return 'warning';
    case 'Confirmed':
    case 'Processing':
    case 'Shipped': return 'info';
    case 'Delivered': return 'success';
    case 'Cancelled': return 'destructive';
    case 'Refunded': return 'info';
    case 'Archived': return 'outline';
    default: return 'outline';
  }
};

export const paymentStatusVariant = (s: PaymentStatus): BadgeVariant => {
  switch (s) {
    case 'Not Paid': return 'warning';
    case 'Authorized': return 'info';
    case 'Paid': return 'success';
    case 'Partially Refunded': return 'info';
    case 'Refunded': return 'info';
    case 'Failed': return 'destructive';
    case 'Voided': return 'outline';
    default: return 'outline';
  }
};

export const fulfillmentStatusVariant = (s: FulfillmentStatus): BadgeVariant => {
  switch (s) {
    case 'Unfulfilled': return 'warning';
    case 'Partially Fulfilled': return 'warning';
    case 'Fulfilled': return 'success';
    case 'Returned':
    case 'Cancelled': return 'destructive';
    default: return 'outline';
  }
};

// Fallback when backend hasn't written fulfillmentStatus yet — compute
// from order lines' fulfilledQuantity so the pill always renders something
// sensible even for pre-PR1 orders.
export const deriveFulfillmentStatus = (order: Order): FulfillmentStatus => {
  if (order.status === 'Cancelled') return 'Cancelled';
  const lines: OrderItem[] = order.products || [];
  if (lines.length === 0) return 'Unfulfilled';
  let totalQty = 0;
  let fulfilledQty = 0;
  for (const l of lines) {
    totalQty += Number(l.quantity) || 0;
    fulfilledQty += Number(l.fulfilledQuantity) || 0;
  }
  if (fulfilledQty === 0) return 'Unfulfilled';
  if (fulfilledQty >= totalQty) return 'Fulfilled';
  return 'Partially Fulfilled';
};

// ─── Timeline meta ────────────────────────────────────────────────────
// Renders the order's history array as a vertical timeline. Each event is
// labeled with the *resulting state* ("Order is being processed"), not the
// transition action ("Status changed from X to Y") — the user's mental
// model is "where is my order now", not "what button was pressed".

// Maps the *new* status of a status_changed event (or the event name for
// other event types) to the icon and color that describes the state the
// order is now in. Labels are resolved in the component via t().
const STATE_META_ICONS: Record<string, { icon: ComponentType<{ className?: string }>; color: string }> = {
  Pending:    { icon: PackagePlus,  color: 'bg-amber-500'   },
  Processing: { icon: RefreshCw,    color: 'bg-violet-500'  },
  Shipped:    { icon: Truck,        color: 'bg-sky-500'     },
  Delivered:  { icon: PackageCheck, color: 'bg-emerald-500' },
  Cancelled:  { icon: Ban,          color: 'bg-red-500'     },
  Refunded:   { icon: RefreshCw,    color: 'bg-rose-500'    },
};

const EVENT_META_ICONS: Record<string, { icon: ComponentType<{ className?: string }>; color: string }> = {
  created:                    { icon: PackagePlus,  color: 'bg-blue-500'    },
  tracking_updated:           { icon: Truck,        color: 'bg-sky-500'     },
  note_added:                 { icon: FileText,     color: 'bg-slate-500'   },
  note_deleted:               { icon: FileText,     color: 'bg-slate-400'   },
  fulfillment_created:        { icon: PackagePlus,  color: 'bg-violet-500'  },
  fulfillment_status_changed: { icon: Truck,        color: 'bg-sky-500'     },
  fulfillment_delivered:      { icon: PackageCheck, color: 'bg-emerald-500' },
  refund_issued:              { icon: ArrowDownLeft, color: 'bg-amber-500'   },
  manual_refund:              { icon: ArrowDownLeft, color: 'bg-amber-500'   },
  refund_failed:              { icon: AlertCircle,  color: 'bg-red-500'     },
  replacement_created:        { icon: RefreshCw,    color: 'bg-indigo-500'  },
  return_created:             { icon: ArrowDownLeft, color: 'bg-orange-500'  },
  return_status_changed:      { icon: ArrowDownLeft, color: 'bg-orange-500'  },
  payment_authorized:         { icon: CreditCard,   color: 'bg-indigo-500'  },
  payment_captured:           { icon: CreditCard,   color: 'bg-emerald-500' },
  payment_failed:             { icon: AlertCircle,  color: 'bg-red-500'     },
  payment_status_changed:     { icon: CreditCard,   color: 'bg-slate-500'   },
  status_changed:             { icon: RefreshCw,    color: 'bg-violet-500'  },
  cancelled:                  { icon: Ban,          color: 'bg-red-500'     },
  order_notified:             { icon: Mail,         color: 'bg-sky-500'     },
  address_edited:             { icon: MapPin,       color: 'bg-slate-500'   },
  discount_adjusted:          { icon: TagIcon,      color: 'bg-amber-500'   },
  tag_added:                  { icon: TagIcon,      color: 'bg-slate-500'   },
  tag_removed:                { icon: TagIcon,      color: 'bg-slate-400'   },
};

// Turn "fulfillment_status_changed" payloads into a friendlier label that
// names the new shipment state instead of the raw event.
export const humanizeFulfillmentNote = (entry: OrderHistoryEntry, t: (k: string) => string) => {
  const note = entry.note || '';
  if (entry.event === 'fulfillment_status_changed') {
    if (/shipped/i.test(note)) return t('orders:detail.timeline.shipment_shipped');
    if (/delivered/i.test(note)) return t('orders:detail.timeline.shipment_delivered');
    if (/cancel/i.test(note)) return t('orders:detail.timeline.shipment_cancelled');
  }
  return note;
};

export const resolveMeta = (entry: OrderHistoryEntry, t: (k: string) => string) => {
  // Status transitions describe themselves through the new state.
  if (entry.event === 'status_changed' && entry.status && STATE_META_ICONS[entry.status]) {
    return {
      ...STATE_META_ICONS[entry.status],
      label: t(`orders:detail.timeline.state_${entry.status.toLowerCase()}`),
    };
  }
  // Cancelled is a terminal status transition but emitted as its own event.
  if (entry.event === 'cancelled') return { ...STATE_META_ICONS.Cancelled, label: t('orders:detail.timeline.state_cancelled') };
  const icons = EVENT_META_ICONS[entry.event];
  if (icons) {
    return {
      ...icons,
      label: t(`orders:detail.timeline.event_${entry.event}`),
    };
  }
  return {
    icon: Calendar,
    label: entry.event.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    color: 'bg-slate-400',
  };
};
