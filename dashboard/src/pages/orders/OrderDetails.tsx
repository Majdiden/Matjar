import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTenantCurrency, getTenantLocale } from '../../lib/format';

// Printable-doc links are opened with window.open (a raw URL the router's
// basename does NOT prepend). In the production build the router basename is
// `/dashboard`, so the URL must include it to reach the `/dashboard/orders/...`
// document routes; in dev (basename '/') it must not. Prepend accordingly.
const DOC_URL_PREFIX = import.meta.env.MODE === 'production' ? '/dashboard' : '';
const orderDocUrl = (orderId: string, doc: string) =>
  `${DOC_URL_PREFIX}/dashboard/orders/${orderId}/${doc}`;
import { useSetBreadcrumbs } from '../../contexts/breadcrumb-context';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  ArrowLeft, Package, Truck, CreditCard, Calendar, User, Mail, Phone, MapPin,
  Printer, Loader2, ChevronDown, AlertCircle,
  PackageCheck, PackagePlus, Ban, RefreshCw, FileText, Clock, Receipt, ArrowDownLeft,
  GitBranch, Tag as TagIcon, Pin, StickyNote, X, Trash2,
  Pencil, ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { Textarea } from '../../components/ui/textarea';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import type {
  Order, OrderItem, OrderStatus, PaymentStatus, FulfillmentStatus,
  OrderHistoryEntry, OrderReturn, CustomerContext, Address,
  Payment, PaymentMethodField, PaymentMethodDefinition,
  PaymentFieldValue,
  OrderFulfillmentRef, OrderWithExtras,
} from '../../types';
import { OrderFulfillments } from './OrderFulfillments';
import { PaymentFieldDisplay } from '../../components/payments/PaymentFieldDisplay';
import { useAuth } from '../../contexts/auth-context';
import { useConfirm } from '../../components/ui/use-confirm';

const STATUS_OPTIONS: OrderStatus[] = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];

const getLineId = (line: OrderItem | undefined | null): string => String(line?._id || '');

const getEffectiveFulfilledQuantity = (order: Order, line: OrderItem): number => {
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

const getReturnableQuantity = (order: Order, line: OrderItem): number => {
  const fulfilled = getEffectiveFulfilledQuantity(order, line);
  const refunded = Number(line?.refundedQuantity) || 0;
  return Math.max(0, fulfilled - refunded);
};

/** Loose envelopes for the /orders/* endpoints — the backend wraps the
 * returned order in either `.data` or `.responseObject` depending on
 * the route and legacy support tier. Kept here (not in the shared types
 * module) because only this screen consumes them. */
interface OrderEnvelope {
  data?: Order | { order?: Order };
  responseObject?: Order | { order?: Order };
}

const extractOrder = (res: unknown): Order | null => {
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
interface PaymentsListEnvelope {
  data?: PaymentsBlock;
  responseObject?: PaymentsBlock;
}
interface PaymentsBlock {
  payments?: Payment[];
  totalPaid?: number;
  totalRefunded?: number;
  maxRefundable?: number;
}

/** Envelope for GET /api/payment-methods — returns the merchant's list
 * of configured methods so we can resolve the one the order used. */
interface PaymentMethodsEnvelope {
  data?: { methods?: PaymentMethodDefinition[] };
  responseObject?: { methods?: PaymentMethodDefinition[] };
}

export const OrderDetails: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const confirm = useConfirm();
  const [paymentActionBusy, setPaymentActionBusy] = useState(false);

  // Record-manual-payment dialog state. Used by the Payment actions panel
  // to capture amount / reference / note before hitting the paymentAction
  // endpoint with action=record_manual.
  const [recordManualOpen, setRecordManualOpen] = useState(false);
  const [recordManualAmount, setRecordManualAmount] = useState('');
  const [recordManualReference, setRecordManualReference] = useState('');
  const [recordManualNote, setRecordManualNote] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  useSetBreadcrumbs(
    order
      ? [
          { label: t('orders:list.title'), href: '/dashboard/orders' },
          { label: `#${String(order.orderNumber || order._id).replace(/^#+/, '')}` },
        ]
      : null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Payments / refunds — loaded once the order is in hand. Refund history
  // and the refund dialog both read from this; the dialog re-fetches after
  // a successful refund so the cap and history stay in sync.
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [maxRefundable, setMaxRefundable] = useState(0);
  const [totalRefunded, setTotalRefunded] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  // Merchant-filled manual-refund fields (mirror the method's customerFields)
  const [refundDetails, setRefundDetails] = useState<Record<string, PaymentFieldValue>>({});

  // Payment-method definition resolved from the order's paymentMethodCode.
  // Drives the manual "Verify payment" dialog and the manual-refund form.
  const [paymentMethodDef, setPaymentMethodDef] = useState<PaymentMethodDefinition | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Replacement order dialog
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [replacementPicks, setReplacementPicks] = useState<Record<string, number>>({});
  const [replacementReason, setReplacementReason] = useState('');
  const [creatingReplacement, setCreatingReplacement] = useState(false);

  // Return (RMA) dialog
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnPicks, setReturnPicks] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [creatingReturn, setCreatingReturn] = useState(false);

  // Per-return inline action loading flags (by return _id)
  const [returnBusy, setReturnBusy] = useState<string | null>(null);

  // §8 — Customer context card (lifetime stats + consent).
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [customerContextLoading, setCustomerContextLoading] = useState(false);

  // §9 — Shipping/billing address edit dialog.
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressDialogKind, setAddressDialogKind] = useState<'shipping' | 'billing'>('shipping');
  const EMPTY_ADDRESS_FORM: Address = {
    firstName: '', lastName: '', addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: '', phone: '',
    deliveryInstructions: '',
  };
  const [addressForm, setAddressForm] = useState<Address>(EMPTY_ADDRESS_FORM);
  const [savingAddress, setSavingAddress] = useState(false);

  // loadOrder / loadPayments are local closures — the linter can't see
  // that they're stable. Retrigger only on the identifier inputs.
  useEffect(() => { if (id) loadOrder(id); }, [id]);
  useEffect(() => { if (order?._id) loadPayments(order._id); }, [order?._id]);
  useEffect(() => {
    if (!order?._id) { setCustomerContext(null); return; }
    let cancelled = false;
    (async () => {
      try {
        setCustomerContextLoading(true);
        const res = await api.orders.customerContext(order._id) as
          { responseObject?: CustomerContext; data?: CustomerContext };
        const data = res?.responseObject || res?.data;
        if (!cancelled) setCustomerContext(data || null);
      } catch {
        if (!cancelled) setCustomerContext(null);
      } finally {
        if (!cancelled) setCustomerContextLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [order?._id]);
  // Stash paymentMethodCode in a stable variable so the effect deps are
  // literal property accesses rather than the `(order as X).x` casts the
  // exhaustive-deps linter can't statically parse.
  const paymentMethodCode = order?.paymentMethodCode;
  useEffect(() => {
    // Resolve the PaymentMethod definition so we can render its
    // customerFields schema in the verify/refund dialogs.
    if (!paymentMethodCode) { setPaymentMethodDef(null); return; }
    (async () => {
      try {
        const res = await api.paymentMethods.list() as PaymentMethodsEnvelope;
        const methods: PaymentMethodDefinition[] =
          res?.data?.methods || res?.responseObject?.methods || [];
        const match = methods.find((m) => m.code === paymentMethodCode);
        setPaymentMethodDef(match || null);
      } catch {
        setPaymentMethodDef(null);
      }
    })();
  }, [order?._id, paymentMethodCode]);

  // A "manual" method is one the merchant settles outside of a gateway
  // AND requires reviewing customer-supplied proof (bank transfer receipt,
  // crypto tx hash, etc.). COD is explicitly excluded — there's nothing to
  // verify up-front because the cash is only exchanged on delivery, so COD
  // skips the Verify flow and goes straight through the Mark-as-paid path.
  const isCodMethod =
    paymentMethodDef?.type === 'cod' ||
    (order?.paymentMethod || '').toLowerCase().includes('cash on delivery') ||
    (order?.paymentMethod || '').toLowerCase() === 'cod';
  const orderExtras = order as OrderWithExtras | null;
  const isManualMethod =
    !isCodMethod &&
    (paymentMethodDef?.type === 'manual' ||
      (!paymentMethodDef && !orderExtras?.paymentIntentId));
  const customerFields: PaymentMethodField[] = Array.isArray(paymentMethodDef?.customerFields)
    ? paymentMethodDef.customerFields
    : [];
  const submittedDetails: Record<string, PaymentFieldValue> =
    orderExtras?.paymentDetails || {};

  const openVerifyDialog = () => {
    setVerifyNote('');
    setVerifyOpen(true);
  };

  const submitVerify = async () => {
    if (!order) return;
    try {
      setVerifying(true);
      await api.payments.verifyManual(order._id, { note: verifyNote || undefined });
      toast.success(t('orders:toast.payment_verified'));
      setVerifyOpen(false);
      await loadOrder(order._id);
      await loadPayments(order._id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.verify_failed'));
    } finally {
      setVerifying(false);
    }
  };

  const loadOrder = async (orderId: string) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.orders.getById(orderId);
      setOrder(extractOrder(response));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      setError(msg || t('orders:toast.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async (orderId: string) => {
    try {
      setPaymentsLoading(true);
      const res = await api.payments.listForOrder(orderId) as PaymentsListEnvelope;
      const data: PaymentsBlock = res.data || res.responseObject || {};
      setPayments(data.payments || []);
      setTotalPaid(data.totalPaid || 0);
      setTotalRefunded(data.totalRefunded || 0);
      setMaxRefundable(data.maxRefundable || 0);
    } catch {
      // Non-fatal — order detail still works without refund history.
      // Likely Stripe isn't configured or no payment intent exists yet.
    } finally {
      setPaymentsLoading(false);
    }
  };

  // Manual refund applies to COD / bank transfer / store-credit orders
  // where there's no Stripe intent. The backend chooses manual mode
  // automatically when paymentIntentId is absent, but the UI surfaces
  // it explicitly so the merchant sees *what* they're about to do.
  const isManualRefund = !payments.some((p) => p.provider === 'stripe' && p.status === 'completed');

  const openRefundDialog = () => {
    setRefundAmount(maxRefundable.toFixed(2));
    setRefundReason('');
    setRefundDetails({});
    setRefundOpen(true);
  };

  const submitRefund = async () => {
    if (!order) return;
    const amt = Number(refundAmount);
    if (!amt || amt <= 0) {
      toast.error(t('orders:validation.refund_amount_invalid'));
      return;
    }
    if (amt > maxRefundable) {
      toast.error(t('orders:dialog.refund.error_exceeds', { max: formatPrice(maxRefundable) }));
      return;
    }
    try {
      setRefunding(true);
      await api.payments.refund(order._id, amt, {
        manual: isManualRefund,
        reason: refundReason || undefined,
        refundDetails:
          isManualRefund && Object.keys(refundDetails).length
            ? refundDetails
            : undefined,
      });
      toast.success(
        isManualRefund
          ? t('orders:toast.refund_success_manual', { amount: formatPrice(amt) })
          : t('orders:toast.refund_success_gateway', { amount: formatPrice(amt) }),
      );
      setRefundOpen(false);
      // Reload both — order paymentStatus may have flipped to Refunded
      // and the payments list now has a new refund row.
      await loadOrder(order._id);
      await loadPayments(order._id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.refund_failed'));
    } finally {
      setRefunding(false);
    }
  };

  // Replacement order — duplicates chosen lines at $0, linked to this order.
  const openReplacementDialog = () => {
    if (!order) return;
    const initial: Record<string, number> = {};
    for (const line of order.products) {
      if (line?._id) initial[String(line._id)] = 0;
    }
    setReplacementPicks(initial);
    setReplacementReason('');
    setReplacementOpen(true);
  };

  const submitReplacement = async () => {
    if (!order) return;
    const items = Object.entries(replacementPicks)
      .filter(([, q]) => q > 0)
      .map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
    if (items.length === 0) {
      toast.error(t('orders:dialog.replacement.error_no_items'));
      return;
    }
    try {
      setCreatingReplacement(true);
      const res = await api.orders.createReplacement(order._id, {
        items,
        reason: replacementReason || undefined,
      }) as { responseObject?: { replacement?: { _id?: string } } };
      const replacementId = res?.responseObject?.replacement?._id;
      toast.success(t('orders:toast.replacement_created'));
      setReplacementOpen(false);
      await loadOrder(order._id);
      if (replacementId) {
        // Offer the merchant a one-click jump to the replacement.
        setTimeout(() => navigate(`/dashboard/orders/${replacementId}`), 400);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.replacement_failed'));
    } finally {
      setCreatingReplacement(false);
    }
  };

  // Return (RMA) — creates a return request for chosen lines.
  const openReturnDialog = () => {
    if (!order) return;
    const initial: Record<string, number> = {};
    for (const line of order.products) {
      if (line?._id) initial[String(line._id)] = 0;
    }
    setReturnPicks(initial);
    setReturnReason('');
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!order) return;
    const items = Object.entries(returnPicks)
      .filter(([, q]) => q > 0)
      .map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
    if (items.length === 0) {
      toast.error(t('orders:dialog.return.error_no_items'));
      return;
    }
    try {
      setCreatingReturn(true);
      await api.orders.createReturn(order._id, {
        items,
        reason: returnReason || undefined,
      });
      toast.success(t('orders:toast.return_requested'));
      setReturnOpen(false);
      await loadOrder(order._id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.return_failed'));
    } finally {
      setCreatingReturn(false);
    }
  };

  const advanceReturn = async (returnId: string, nextStatus: string, refundAmt?: number) => {
    if (!order) return;
    try {
      setReturnBusy(returnId);
      await api.orders.updateReturnStatus(order._id, returnId, {
        status: nextStatus,
        refundAmount: refundAmt,
      });
      toast.success(t('orders:toast.return_updated', { status: t(`common:status.${nextStatus}`, { defaultValue: nextStatus }) }));
      await loadOrder(order._id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.return_update_failed'));
    } finally {
      setReturnBusy(null);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;
    try {
      setUpdatingStatus(true);
      const res = await api.orders.updateStatus(order._id, newStatus) as { responseObject?: Order };
      // Backend returns the full updated order including the new history
      // entry — prefer it over a local merge so the timeline reflects truth.
      const updated = res?.responseObject;
      setOrder(updated || { ...order, status: newStatus });
      toast.success(t('orders:toast.status_updated', { status: t(`common:status.${newStatus}`, { defaultValue: newStatus }) }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.status_update_failed'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Internal notes & tags ─────────────────────────────────────
  const canWriteOrders = can('orders.write');
  const [noteDraft, setNoteDraft] = useState('');
  const [notePinned, setNotePinned] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagBusy, setTagBusy] = useState<string | null>(null);
  const [noteBusy, setNoteBusy] = useState<string | null>(null);

  const handleAddNote = async () => {
    if (!order) return;
    const body = noteDraft.trim();
    if (!body) {
      toast.error(t('orders:validation.note_empty'));
      return;
    }
    if (body.length > 2000) {
      toast.error(t('orders:validation.note_too_long'));
      return;
    }
    try {
      setNoteSubmitting(true);
      const res = await api.orders.addNote(order._id, body, notePinned) as { responseObject?: Order };
      setOrder(res?.responseObject || order);
      setNoteDraft('');
      setNotePinned(false);
      toast.success(t('orders:toast.note_added'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.note_add_failed'));
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!order) return;
    const ok = await confirm({
      title: t('orders:dialog.delete_note.title'),
      description: t('orders:dialog.delete_note.description'),
      confirmText: t('orders:dialog.delete_note.confirm'),
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      setNoteBusy(noteId);
      const res = await api.orders.deleteNote(order._id, noteId) as { responseObject?: Order };
      setOrder(res?.responseObject || order);
      toast.success(t('orders:toast.note_deleted'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.note_delete_failed'));
    } finally {
      setNoteBusy(null);
    }
  };

  const handleAddTag = async () => {
    if (!order) return;
    const tag = tagDraft.trim();
    if (!tag) {
      toast.error(t('orders:validation.tag_empty'));
      return;
    }
    if (tag.length > 32) {
      toast.error(t('orders:validation.tag_too_long'));
      return;
    }
    try {
      setTagSubmitting(true);
      const res = await api.orders.addTags(order._id, [tag]) as { responseObject?: Order };
      setOrder(res?.responseObject || order);
      setTagDraft('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.tag_add_failed'));
    } finally {
      setTagSubmitting(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!order) return;
    try {
      setTagBusy(tag);
      const res = await api.orders.removeTag(order._id, tag) as { responseObject?: Order };
      setOrder(res?.responseObject || order);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.tag_remove_failed'));
    } finally {
      setTagBusy(null);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(price);

  // §9 — Address helpers.
  const ADDRESS_COMPARE_KEYS: (keyof Address)[] = [
    'firstName', 'lastName', 'addressLine1', 'addressLine2',
    'city', 'state', 'postalCode', 'country', 'phone',
  ];
  const addressesMatch = (a?: Address, b?: Address): boolean => {
    if (!a || !b) return false;
    return ADDRESS_COMPARE_KEYS.every(
      (k) => ((a[k] as string | undefined) || '').trim() === ((b[k] as string | undefined) || '').trim()
    );
  };
  const openAddressDialog = (kind: 'shipping' | 'billing') => {
    const src: Partial<Address> = (kind === 'shipping' ? order?.shippingAddress : order?.billingAddress) || {};
    setAddressDialogKind(kind);
    setAddressForm({
      firstName: src.firstName || '',
      lastName: src.lastName || '',
      addressLine1: src.addressLine1 || '',
      addressLine2: src.addressLine2 || '',
      city: src.city || '',
      state: src.state || '',
      postalCode: src.postalCode || '',
      country: src.country || '',
      phone: src.phone || '',
      deliveryInstructions: src.deliveryInstructions || '',
    });
    setAddressDialogOpen(true);
  };
  const submitAddress = async () => {
    if (!order) return;
    try {
      setSavingAddress(true);
      const key = addressDialogKind === 'shipping' ? 'shippingAddress' : 'billingAddress';
      const payload: { shippingAddress?: Address; billingAddress?: Address } = {
        [key]: { ...addressForm },
      };
      const res = await api.orders.updateAddresses(
        order._id,
        payload as Parameters<typeof api.orders.updateAddresses>[1],
      ) as OrderEnvelope;
      toast.success(addressDialogKind === 'shipping' ? t('orders:toast.address_shipping_updated') : t('orders:toast.address_billing_updated'));
      setAddressDialogOpen(false);
      const updated = extractOrder(res);
      if (updated) setOrder(updated);
      else await loadOrder(order._id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.address_save_failed'));
    } finally {
      setSavingAddress(false);
    }
  };

  // §9 — Render a single address card. Defined inline so it can close
  // over order state and the edit handlers.
  const renderAddressCard = (
    kind: 'shipping' | 'billing',
    addr: Address | undefined,
    opts: { sameAsShipping?: boolean } = {}
  ) => {
    const title = kind === 'shipping' ? t('orders:detail.address.shipping') : t('orders:detail.address.billing');
    const hasAny = !!(
      addr && (addr.addressLine1 || addr.city || addr.postalCode || addr.firstName)
    );
    const editButton = (
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={!canWriteOrders}
        onClick={() => openAddressDialog(kind)}
      >
        <Pencil className="h-3.5 w-3.5 me-1.5" />
        {t('common:action.edit')}
      </Button>
    );
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-5 w-5" />{title}
          </CardTitle>
          {canWriteOrders ? (
            editButton
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><span>{editButton}</span></TooltipTrigger>
                <TooltipContent>{t('orders:detail.address.needs_write')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardHeader>
        <CardContent>
          {opts.sameAsShipping ? (
            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
              {t('orders:detail.address.same_as_shipping')}
            </div>
          ) : !hasAny ? (
            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
              {t('orders:detail.address.none_on_file', { kind })}
            </div>
          ) : (
            <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-1">
              {(addr?.firstName || addr?.lastName) && (
                <p className="font-medium">{addr?.firstName} {addr?.lastName}</p>
              )}
              {addr?.addressLine1 && <p>{addr.addressLine1}</p>}
              {addr?.addressLine2 && <p>{addr.addressLine2}</p>}
              <p>
                {[addr?.city, addr?.state, addr?.postalCode].filter(Boolean).join(', ')}
              </p>
              {addr?.country && <p>{addr.country}</p>}
              {addr?.phone && (
                <p className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />{addr.phone}
                </p>
              )}
              {addr?.deliveryInstructions && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    {t('orders:detail.address.delivery_instructions')}
                  </p>
                  <p className="whitespace-pre-wrap">{addr.deliveryInstructions}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate('/dashboard/orders')}>
          <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />{t('orders:detail.back')}
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Shared payment-action runner — confirms dangerous actions, calls the
  // backend, reloads the order on success, toasts on failure. Shared by
  // the NextActionStrip and the Payment actions panel below.
  const runPaymentAction = async (
    action: 'mark_paid' | 'mark_failed' | 'capture' | 'void' | 'record_manual',
    label: string,
    opts: { dangerous?: boolean; amount?: number; reference?: string; note?: string } = {},
  ) => {
    if (!order) return;
    if (opts.dangerous) {
      const ok = await confirm({
        title: `${label}?`,
        description: 'This action cannot be undone.',
        variant: 'destructive',
        confirmText: label,
      });
      if (!ok) return;
    }
    try {
      setPaymentActionBusy(true);
      await api.orders.paymentAction(order._id, {
        action,
        amount: opts.amount,
        reference: opts.reference,
        note: opts.note,
      });
      toast.success(t('orders:toast.payment_action_updated', { label }));
      await loadOrder(order._id);
      await loadPayments(order._id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.payment_action_failed', { label }));
    } finally {
      setPaymentActionBusy(false);
    }
  };

  const openRecordManualDialog = () => {
    setRecordManualAmount(String(order?.totalAmount ?? ''));
    setRecordManualReference('');
    setRecordManualNote('');
    setRecordManualOpen(true);
  };

  const submitRecordManual = async () => {
    const amt = Number(recordManualAmount);
    if (!amt || amt <= 0) {
      toast.error(t('orders:validation.refund_amount_positive'));
      return;
    }
    await runPaymentAction('record_manual', 'Record manual payment', {
      amount: amt,
      reference: recordManualReference || undefined,
      note: recordManualNote || undefined,
    });
    setRecordManualOpen(false);
  };

  const customerName = order.user?.name
    || (order.guestCustomer ? `${order.guestCustomer.firstName} ${order.guestCustomer.lastName}` : '')
    || (order.shippingAddress?.firstName ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}` : t('orders:detail.customer.guest'));
  const customerEmail = order.user?.email || order.guestCustomer?.email || t('orders:detail.customer.not_available');
  const customerPhone = order.user?.phone || order.guestCustomer?.phone || order.shippingAddress?.phone || t('orders:detail.customer.not_available');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/orders')}>
            <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />{t('orders:detail.back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('orders:detail.order_title', { number: order.orderNumber || `#${order._id.slice(-6).toUpperCase()}` })}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('orders:detail.placed', { date: new Date(order.createdAt).toLocaleString() })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(orderDocUrl(order._id, 'packing-slip'), '_blank', 'noopener,noreferrer')}
          >
            <Printer className="h-4 w-4 me-2" />{t('orders:detail.action.print')}
          </Button>
          <DocumentsMenu order={order} payments={payments} />
        </div>
      </div>

      {/* Unified operations card — statuses + next action + payment transitions */}
      <OperationsCard
        order={order}
        canWrite={can('orders.write')}
        updatingStatus={updatingStatus}
        paymentActionBusy={paymentActionBusy}
        isManualMethod={isManualMethod}
        onStatusChange={handleStatusChange}
        onVerifyPayment={openVerifyDialog}
        onRecordManual={openRecordManualDialog}
        onPaymentAction={async (action, label, dangerous) => {
          if (dangerous) {
            const ok = await confirm({
              title: `${label}?`,
              description: t('orders:detail.action.cannot_be_undone'),
              variant: 'destructive',
              confirmText: label,
            });
            if (!ok) return;
          }
          try {
            setPaymentActionBusy(true);
            await api.orders.paymentAction(order._id, { action });
            toast.success(t('orders:toast.payment_action_updated', { label }));
            await loadOrder(order._id);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : null;
            toast.error(msg || t('orders:toast.payment_action_failed', { label }));
          } finally {
            setPaymentActionBusy(false);
          }
        }}
        onCancelOrder={async () => {
          const ok = await confirm({
            title: t('orders:dialog.cancel_order.title'),
            description: t('orders:dialog.cancel_order.description'),
            variant: 'destructive',
            confirmText: t('orders:dialog.cancel_order.confirm'),
            cancelText: t('orders:dialog.cancel_order.keep'),
          });
          if (!ok) return;
          try {
            setPaymentActionBusy(true);
            await api.orders.cancel(order._id);
            toast.success(t('orders:toast.order_cancelled'));
            await loadOrder(order._id);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : null;
            toast.error(msg || t('orders:toast.cancel_failed'));
          } finally {
            setPaymentActionBusy(false);
          }
        }}
        onCreateFulfillment={() => {
          const el = document.getElementById('fulfillment-card');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onPrintPackingSlip={() => window.open(orderDocUrl(order._id, 'packing-slip'), '_blank', 'noopener,noreferrer')}
        onMarkDelivered={() => handleStatusChange('Delivered')}
      />

      {/* Record-manual-payment dialog — captures amount + reference + note
          and POSTs action=record_manual. Flips paymentStatus to Paid and
          writes a Payment row so the refund cap picks it up. */}
      <Dialog open={recordManualOpen} onOpenChange={setRecordManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('orders:dialog.record_manual_payment.title')}</DialogTitle>
            <DialogDescription>
              {t('orders:dialog.record_manual_payment.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="record-manual-amount">{t('orders:dialog.record_manual_payment.amount_label')}</Label>
              <Input
                id="record-manual-amount"
                type="number"
                min="0"
                step="0.01"
                value={recordManualAmount}
                onChange={(e) => setRecordManualAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="record-manual-reference">{t('orders:dialog.record_manual_payment.reference_label')}</Label>
              <Input
                id="record-manual-reference"
                placeholder={t('orders:dialog.record_manual_payment.reference_placeholder')}
                value={recordManualReference}
                onChange={(e) => setRecordManualReference(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="record-manual-note">{t('orders:dialog.record_manual_payment.note_label')}</Label>
              <Textarea
                id="record-manual-note"
                value={recordManualNote}
                onChange={(e) => setRecordManualNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRecordManualOpen(false)}
              disabled={paymentActionBusy}
            >
              {t('common:action.cancel')}
            </Button>
            <Button onClick={submitRecordManual} disabled={paymentActionBusy}>
              {paymentActionBusy && <Loader2 className="h-3 w-3 me-2 animate-spin" />}
              {t('orders:dialog.record_manual_payment.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5" />{t('orders:detail.section.items.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {order.products.map((item: OrderItem, i: number) => {
                  const productObj = typeof item.product === 'object' ? item.product : null;
                  const name = productObj?.name || item.name || 'Product';
                  const sku = productObj?.sku || item.sku;
                  // Prefer the order-time snapshot so the row stays stable
                  // even after the product's media is edited or removed.
                  const productImages = productObj && Array.isArray((productObj as { images?: unknown }).images)
                    ? (productObj as { images?: Array<string | { url?: string; src?: string }> }).images
                    : undefined;
                  const firstImage = productImages && productImages[0];
                  const image =
                    item.image ||
                    (typeof firstImage === 'string'
                      ? firstImage
                      : firstImage?.url || firstImage?.src) ||
                    (productObj as { image?: string } | null)?.image;
                  const variantOptions: Array<{ name: string; value: string }> = item.variantOptions || [];
                  const variantLabel = variantOptions.length
                    ? variantOptions.map((o) => `${o.name}: ${o.value}`).join(' / ')
                    : null;
                  const qty = Number(item.quantity) || 0;
                  const fulfilled = getEffectiveFulfilledQuantity(order, item);
                  const refunded = Number(item.refundedQuantity) || 0;
                  const isFullyFulfilled = fulfilled >= qty && qty > 0;
                  const isPartial = fulfilled > 0 && !isFullyFulfilled;
                  const subtotal = (Number(item.price) || 0) * qty;
                  const discount = Number(item.discountAllocation) || 0;
                  const tax = Number(item.taxAllocation) || 0;
                  // Returnable = fulfilled units still eligible for a
                  // return (spec §5): fulfilled - refunded.
                  const returnable = getReturnableQuantity(order, item);

                  return (
                    <li key={i} className="flex gap-4 p-4">
                      <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {image ? (
                          <img src={image} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-base leading-tight truncate">{name}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {t('orders:detail.item.sku', { sku: sku || '—' })}
                            </p>
                            {variantLabel && (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {t('orders:detail.item.variant', { label: variantLabel })}
                              </p>
                            )}
                          </div>
                          <p className="text-base font-semibold tabular-nums whitespace-nowrap">
                            {formatPrice(subtotal)}
                          </p>
                        </div>

                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                          <span>
                            {t('orders:detail.item.qty', { count: qty })}
                          </span>
                          <span>
                            {t('orders:detail.item.fulfilled', { done: fulfilled, total: qty })}
                          </span>
                          <span>
                            {t('orders:detail.item.refunded', { done: refunded, total: qty })}
                          </span>
                          {returnable > 0 && (
                            <span>
                              {t('orders:detail.item.returnable', { count: returnable })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                          <span>
                            {t('orders:detail.item.unit', { price: formatPrice(item.price) })}
                          </span>
                          <span>
                            {t('orders:detail.item.subtotal', { price: formatPrice(subtotal) })}
                          </span>
                          {discount > 0 && (
                            <span className="text-green-600 dark:text-green-500">
                              {t('orders:detail.item.discount', { price: formatPrice(discount) })}
                            </span>
                          )}
                          {tax > 0 && (
                            <span>
                              {t('orders:detail.item.tax', { price: formatPrice(tax) })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center flex-wrap gap-2 mt-2">
                          {isFullyFulfilled && (
                            <Badge variant="success" className="h-5 text-[10px]">{t('common:status.Fulfilled')}</Badge>
                          )}
                          {isPartial && (
                            <Badge variant="secondary" className="h-5 text-[10px]">
                              {t('orders:detail.item.shipped', { done: fulfilled, total: qty })}
                            </Badge>
                          )}
                          {item.isPreorder && (
                            <Badge variant="outline" className="h-5 text-[10px] border-amber-500 text-amber-700 dark:text-amber-400">
                              <Clock className="h-3 w-3 me-0.5" />
                              {t('orders:detail.item.pre_order')}
                              {item.preorderExpectedShipDate && (
                                <>{t('orders:detail.item.ships', { date: new Date(item.preorderExpectedShipDate).toLocaleDateString() })}</>
                              )}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Totals */}
              <div className="border-t p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('orders:detail.totals.subtotal')}</span>
                  <span>{formatPrice(order.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('orders:detail.totals.shipping')}</span>
                  <span>{formatPrice(order.shippingCost || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('orders:detail.totals.tax')}</span>
                  <span>{formatPrice(order.tax || 0)}</span>
                </div>
                {(order.discount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{t('orders:detail.totals.discount')}</span>
                    <span>-{formatPrice(order.discount!)}</span>
                  </div>
                )}
                {(order.giftCardRedemption?.amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{t('orders:detail.totals.gift_card')}{order.giftCardRedemption?.codeLast4 ? ` (•••• ${order.giftCardRedemption.codeLast4})` : ''}</span>
                    <span>-{formatPrice(order.giftCardRedemption!.amount!)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('orders:detail.totals.total')}</span>
                  <span>{formatPrice(order.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments & Refunds */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-5 w-5" /> {t('orders:detail.section.payments.title')}
              </CardTitle>
              {maxRefundable > 0 && (
                <Button size="sm" variant="outline" onClick={openRefundDialog}>
                  <ArrowDownLeft className="h-4 w-4 me-2" />
                  {isManualRefund ? t('orders:detail.action.record_manual_refund') : t('orders:detail.action.refund')}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-muted-foreground text-sm">{t('orders:detail.payment.paid')}</p>
                  <p className="font-semibold text-base">{formatPrice(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">{t('orders:detail.payment.refunded')}</p>
                  <p className="font-semibold text-base">{formatPrice(totalRefunded)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">{t('orders:detail.payment.refundable')}</p>
                  <p className="font-semibold text-base">{formatPrice(maxRefundable)}</p>
                </div>
              </div>
              {paymentsLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('orders:detail.payment.no_records')}
                </p>
              ) : (
                <div className="border rounded-md divide-y">
                  {[...payments]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((p) => (
                    <div key={p._id} className="flex items-center justify-between p-3 text-sm">
                      <div className="flex items-center gap-2">
                        {p.status === 'refunded' ? (
                          <ArrowDownLeft className="h-5 w-5 text-amber-600" />
                        ) : (
                          <CreditCard className="h-5 w-5 text-green-600" />
                        )}
                        <div>
                          <p className="font-semibold capitalize text-base">
                            {p.status === 'refunded' ? t('orders:detail.payment.record_type_refund') : t('orders:detail.payment.record_type_payment')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {p.provider} · {new Date(p.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-end">
                        <p className={`font-semibold ${p.status === 'refunded' ? 'text-amber-600' : ''}`}>
                          {p.status === 'refunded' ? '−' : ''}{formatPrice(p.amount || 0)}
                        </p>
                        {p.providerTransactionId && (
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                            {p.providerTransactionId}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fulfillments */}
          <div id="fulfillment-card">
            <OrderFulfillments order={order} onChange={() => loadOrder(order._id)} />
          </div>

          {/* Returns & Replacements */}
          <ReturnsAndReplacements
            order={order}
            onNewReplacement={openReplacementDialog}
            onNewReturn={openReturnDialog}
            onAdvanceReturn={advanceReturn}
            busyReturnId={returnBusy}
            formatPrice={formatPrice}
          />

          {/* §9 — Shipping + Billing address cards (side-by-side on lg). */}
          <div className="grid gap-4 lg:grid-cols-2">
            {renderAddressCard('shipping', order.shippingAddress as Address | undefined)}
            {renderAddressCard(
              'billing',
              (order.billingAddress || order.shippingAddress) as Address | undefined,
              {
                sameAsShipping: addressesMatch(
                  order.shippingAddress as Address | undefined,
                  order.billingAddress as Address | undefined
                ),
              }
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t('orders:detail.section.order_notes.title')}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — on lg+, fill the main column's height and scroll
            internally so long notes/timelines don't push the page. */}
        <div className="lg:relative lg:min-h-0">
         <div className="space-y-6 lg:absolute lg:inset-0 lg:overflow-y-auto scrollbar-hide">
          {/* §8 — Customer context card. Lifetime stats + consent, plus
              quick links to the full customer profile and order list. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-5 w-5" />{t('orders:detail.section.customer.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">{customerName}</p>
                <div className="mt-1 flex items-center gap-2">
                  {(() => {
                    const isGuest = customerContext
                      ? customerContext.type === 'guest'
                      : !order.user;
                    return (
                      <Badge variant={isGuest ? 'secondary' : 'info'} className="text-xs">
                        {isGuest ? t('orders:detail.customer.guest') : t('orders:detail.customer.customer')}
                      </Badge>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="break-all">{customerEmail}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{customerPhone}</span>
              </div>

              <Separator />

              {customerContextLoading && !customerContext ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ) : customerContext ? (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t('orders:detail.customer.lifetime_orders')}</dt>
                  <dd className="text-end font-medium">{customerContext.lifetimeOrderCount}</dd>
                  <dt className="text-muted-foreground">{t('orders:detail.customer.lifetime_spend')}</dt>
                  <dd className="text-end font-medium">{formatPrice(customerContext.lifetimeSpend)}</dd>
                  <dt className="text-muted-foreground">{t('orders:detail.customer.previous_refunds')}</dt>
                  <dd className="text-end font-medium">{customerContext.previousRefunds}</dd>
                  <dt className="text-muted-foreground">{t('orders:detail.customer.previous_cancellations')}</dt>
                  <dd className="text-end font-medium">{customerContext.previousCancellations}</dd>
                  <dt className="text-muted-foreground">{t('orders:detail.customer.last_order')}</dt>
                  <dd className="text-end">
                    {customerContext.lastOrderDate
                      ? new Date(customerContext.lastOrderDate).toLocaleDateString()
                      : '—'}
                  </dd>
                  <dt className="text-muted-foreground">{t('orders:detail.customer.customer_since')}</dt>
                  <dd className="text-end">
                    {customerContext.customerSince
                      ? new Date(customerContext.customerSince).toLocaleDateString()
                      : '—'}
                  </dd>
                  <dt className="text-muted-foreground">{t('orders:detail.customer.marketing_consent')}</dt>
                  <dd className="text-end">
                    {customerContext.marketingConsent === true
                      ? t('orders:detail.customer.yes')
                      : customerContext.marketingConsent === false
                      ? t('orders:detail.customer.no')
                      : t('orders:detail.customer.unknown')}
                  </dd>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">{t('orders:detail.customer.no_context')}</p>
              )}

              <div className="flex flex-col gap-2 pt-1">
                {(() => {
                  const ctx = customerContext;
                  const linkParam = ctx?.customerId
                    ? ctx.customerId
                    : ctx?.email
                    ? ctx.email
                    : order.user?._id || order.guestCustomer?.email || '';
                  return (
                    <Link
                      to={`/dashboard/orders?customer=${encodeURIComponent(linkParam)}`}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('orders:detail.action.view_all_orders')}
                    </Link>
                  );
                })()}
                {customerContext?.type === 'customer' && customerContext.customerId && (
                  <Link
                    to={`/dashboard/customers/${customerContext.customerId}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <User className="h-3.5 w-3.5" />
                    {t('orders:detail.action.view_profile')}
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5" />{t('orders:detail.section.timeline.title')}
              </CardTitle>
              {(order.replacementOf ||
                (order.replacementOrders && order.replacementOrders.length > 0)) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => navigate(`/dashboard/orders/${order._id}/lifecycle`)}
                >
                  <GitBranch className="h-3.5 w-3.5 me-1.5" />
                  {t('orders:detail.action.view_timeline')}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <OrderTimeline order={order} />
            </CardContent>
          </Card>

          {/* Tags Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TagIcon className="h-5 w-5" />{t('orders:detail.section.tags.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(order.tags && order.tags.length > 0) ? (
                  order.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                    >
                      {t}
                      {canWriteOrders && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          disabled={tagBusy === t}
                          className="ms-0.5 rounded-full p-0.5 hover:bg-background/60 disabled:opacity-50"
                          aria-label={`Remove tag ${t}`}
                        >
                          {tagBusy === t ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t('orders:detail.tags.none')}</p>
                )}
              </div>
              {canWriteOrders && (
                <div className="flex gap-2">
                  <Input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    placeholder={t('orders:detail.tags.add_placeholder')}
                    maxLength={32}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !tagSubmitting) {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddTag}
                    disabled={tagSubmitting || !tagDraft.trim()}
                  >
                    {tagSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('orders:detail.tags.add')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal Notes Card — staff-only */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <StickyNote className="h-5 w-5" />{t('orders:detail.section.notes.title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('orders:detail.section.notes.subtitle')}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {canWriteOrders && (
                <div className="space-y-2">
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={t('orders:detail.notes.add_placeholder')}
                    maxLength={2000}
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notePinned}
                        onChange={(e) => setNotePinned(e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      {t('orders:detail.notes.pin_to_top')}
                    </label>
                    <Button
                      size="sm"
                      onClick={handleAddNote}
                      disabled={noteSubmitting || !noteDraft.trim()}
                    >
                      {noteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('orders:detail.notes.add_button')}
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {(() => {
                  const visible = (order.internalNotes || []).filter((n) => !n.deletedAt);
                  if (visible.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground">{t('orders:detail.notes.none')}</p>
                    );
                  }
                  const sorted = [...visible].sort((a, b) => {
                    if (Boolean(b.pinned) !== Boolean(a.pinned)) {
                      return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
                    }
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  });
                  return sorted.map((n) => (
                    <div
                      key={n._id}
                      className="rounded-md border p-2.5 text-sm space-y-1 bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {n.pinned && <Pin className="h-3 w-3 text-amber-500" />}
                          <span className="font-medium text-foreground">
                            {n.createdByName || t('orders:detail.notes.staff')}
                          </span>
                          <span>·</span>
                          <span>{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        {canWriteOrders && (
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(n._id)}
                            disabled={noteBusy === n._id}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                            aria-label={t('orders:detail.notes.delete_note_aria')}
                          >
                            {noteBusy === n._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap break-words">{n.body}</p>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
         </div>
        </div>
      </div>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isManualRefund ? t('orders:dialog.refund.title_manual') : t('orders:dialog.refund.title_gateway')}
            </DialogTitle>
            <DialogDescription>
              {isManualRefund ? (
                t('orders:dialog.refund.desc_manual', { method: order.paymentMethod })
              ) : (
                t('orders:dialog.refund.desc_gateway', { max: formatPrice(maxRefundable) })
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">{t('orders:dialog.refund.order_total')}</p>
                <p className="font-semibold">{formatPrice(order.totalAmount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('orders:dialog.refund.already_refunded')}</p>
                <p className="font-semibold">{formatPrice(totalRefunded)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-amount">{t('orders:dialog.refund.amount_label')}</Label>
              <Input
                id="refund-amount"
                type="number"
                min="0"
                max={maxRefundable}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('orders:dialog.refund.max_refundable', { amount: formatPrice(maxRefundable) })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-reason">{t('orders:dialog.refund.reason_label')}</Label>
              <Input
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={t('orders:dialog.refund.reason_placeholder')}
              />
            </div>
            {isManualRefund && isManualMethod && customerFields.length > 0 && (
              <div className="space-y-3 pt-3 border-t">
                <div>
                  <p className="text-sm font-medium">{t('orders:dialog.refund.details_title')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('orders:dialog.refund.details_desc')}
                  </p>
                </div>
                {customerFields.map((f: PaymentMethodField) => (
                  <PaymentFieldInput
                    key={f.name}
                    field={f}
                    value={refundDetails[f.name]}
                    onChange={(v) =>
                      setRefundDetails((prev) => ({ ...prev, [f.name]: v }))
                    }
                  />
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={refunding}>
              {t('common:action.cancel')}
            </Button>
            <Button onClick={submitRefund} disabled={refunding}>
              {refunding && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {isManualRefund ? t('orders:dialog.refund.submit_manual') : t('orders:dialog.refund.submit_gateway')}{' '}
              {refundAmount && Number(refundAmount) > 0 ? formatPrice(Number(refundAmount)) : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replacement dialog */}
      <Dialog open={replacementOpen} onOpenChange={setReplacementOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('orders:dialog.replacement.title')}</DialogTitle>
            <DialogDescription>
              {t('orders:dialog.replacement.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <LinePicker
              order={order}
              picks={replacementPicks}
              onChange={setReplacementPicks}
              maxOf={(line: OrderItem) => Number(line.quantity) || 0}
              labelMax={t('orders:detail.line_picker.label_max_ordered')}
            />
            <div className="space-y-2">
              <Label htmlFor="replacement-reason">{t('orders:dialog.replacement.reason_label')}</Label>
              <Textarea
                id="replacement-reason"
                value={replacementReason}
                onChange={(e) => setReplacementReason(e.target.value)}
                placeholder={t('orders:dialog.replacement.reason_placeholder')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplacementOpen(false)}
              disabled={creatingReplacement}
            >
              {t('common:action.cancel')}
            </Button>
            <Button onClick={submitReplacement} disabled={creatingReplacement}>
              {creatingReplacement && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t('orders:dialog.replacement.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('orders:dialog.return.title')}</DialogTitle>
            <DialogDescription>
              {t('orders:dialog.return.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <LinePicker
              order={order}
              picks={returnPicks}
              onChange={setReturnPicks}
              maxOf={(line: OrderItem) => getReturnableQuantity(order, line)}
              labelMax={t('orders:detail.line_picker.label_max_received')}
            />
            <div className="space-y-2">
              <Label htmlFor="return-reason">{t('orders:dialog.return.reason_label')}</Label>
              <Textarea
                id="return-reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={t('orders:dialog.return.reason_placeholder')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnOpen(false)}
              disabled={creatingReturn}
            >
              {t('common:action.cancel')}
            </Button>
            <Button onClick={submitReturn} disabled={creatingReturn}>
              {creatingReturn && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t('orders:dialog.return.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify manual payment — merchant reviews the customer-submitted
          fields (receipt upload, transaction id, etc.) and marks paid. */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('orders:dialog.verify.title')}</DialogTitle>
            <DialogDescription>
              {t('orders:dialog.verify.description', { method: order.paymentMethod })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {typeof submittedDetails.providerLabel === 'string' && submittedDetails.providerLabel && (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">{t('orders:dialog.verify.provider')}</span>
                <span className="text-sm font-medium">{submittedDetails.providerLabel}</span>
              </div>
            )}
            {customerFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('orders:dialog.verify.no_fields')}
              </p>
            ) : (
              customerFields.map((f: PaymentMethodField) => (
                <PaymentFieldDisplay
                  key={f.name}
                  field={f}
                  value={submittedDetails[f.name]}
                />
              ))
            )}
            <div className="space-y-2 pt-3 border-t">
              <Label htmlFor="verify-note">{t('orders:dialog.verify.note_label')}</Label>
              <Textarea
                id="verify-note"
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                placeholder={t('orders:dialog.verify.note_placeholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)} disabled={verifying}>
              {t('common:action.cancel')}
            </Button>
            <Button onClick={submitVerify} disabled={verifying}>
              {verifying && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t('orders:dialog.verify.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* §9 — Address edit dialog (shipping OR billing). */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {addressDialogKind === 'shipping' ? t('orders:dialog.address_edit.title_shipping') : t('orders:dialog.address_edit.title_billing')}
            </DialogTitle>
            <DialogDescription>
              {t('orders:dialog.address_edit.description')}
            </DialogDescription>
          </DialogHeader>

          {order && order.fulfillmentStatus && order.fulfillmentStatus !== 'Unfulfilled' && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('orders:dialog.address_edit.fulfillment_warning', { status: String(order.fulfillmentStatus).toLowerCase() })}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="addr-firstName">{t('orders:dialog.address_edit.field.first_name')}</Label>
              <Input
                id="addr-firstName"
                value={addressForm.firstName || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-lastName">{t('orders:dialog.address_edit.field.last_name')}</Label>
              <Input
                id="addr-lastName"
                value={addressForm.lastName || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-line1">{t('orders:dialog.address_edit.field.line1')}</Label>
              <Input
                id="addr-line1"
                value={addressForm.addressLine1 || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-line2">{t('orders:dialog.address_edit.field.line2')}</Label>
              <Input
                id="addr-line2"
                value={addressForm.addressLine2 || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, addressLine2: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-city">{t('orders:dialog.address_edit.field.city')}</Label>
              <Input
                id="addr-city"
                value={addressForm.city || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-state">{t('orders:dialog.address_edit.field.state')}</Label>
              <Input
                id="addr-state"
                value={addressForm.state || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-postal">{t('orders:dialog.address_edit.field.postal')}</Label>
              <Input
                id="addr-postal"
                value={addressForm.postalCode || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-country">{t('orders:dialog.address_edit.field.country')}</Label>
              <Input
                id="addr-country"
                value={addressForm.country || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-phone">{t('orders:dialog.address_edit.field.phone')}</Label>
              <Input
                id="addr-phone"
                value={addressForm.phone || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-delivery">{t('orders:dialog.address_edit.field.delivery_instructions')}</Label>
              <Textarea
                id="addr-delivery"
                value={addressForm.deliveryInstructions || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, deliveryInstructions: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)} disabled={savingAddress}>
              {t('common:action.cancel')}
            </Button>
            <Button onClick={submitAddress} disabled={savingAddress || !canWriteOrders}>
              {savingAddress && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t('orders:dialog.address_edit.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Payment field input / display ────────────────────────────────────
// Mirrors the shape used by the storefront PaymentMethodPicker so the
// verify dialog (read-only) and the manual-refund dialog (editable) render
// the same schema — text / textarea / number / email / tel / select / file.

const PaymentFieldInput: React.FC<{
  field: PaymentMethodField;
  value: PaymentFieldValue | undefined;
  onChange: (v: PaymentFieldValue) => void;
}> = ({ field, value, onChange }) => {
  // Narrow the polymorphic field value once per render. The field schema
  // already constrains the type, but the stored value can be any of the
  // unioned shapes depending on `field.type`.
  const stringValue =
    typeof value === 'string' ? value
    : typeof value === 'number' ? String(value)
    : '';
  const fileValue = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as { name?: string; size?: number })
    : null;
  const label = (
    <Label htmlFor={`pf-${field.name}`}>
      {field.label}
      {field.required && <span className="text-destructive ms-0.5">*</span>}
    </Label>
  );
  if (field.type === 'textarea') {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea
          id={`pf-${field.name}`}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      </div>
    );
  }
  if (field.type === 'select') {
    const opts = Array.isArray(field.options) ? field.options : [];
    return (
      <div className="space-y-1.5">
        {label}
        <select
          id={`pf-${field.name}`}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">{field.placeholder || 'Select…'}</option>
          {opts.map((o, i) => (
            <option key={i} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === 'file') {
    return (
      <div className="space-y-1.5">
        {label}
        <Input
          id={`pf-${field.name}`}
          type="file"
          accept={field.accept}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return onChange(null);
            const max = Number(field.maxSize) || 5 * 1024 * 1024;
            if (file.size > max) {
              toast.error(`File exceeds ${(max / 1024 / 1024).toFixed(1)}MB`);
              return;
            }
            const reader = new FileReader();
            reader.onload = () =>
              onChange({
                name: file.name,
                size: file.size,
                type: file.type,
                dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
              });
            reader.readAsDataURL(file);
          }}
        />
        {fileValue?.name && (
          <p className="text-xs text-muted-foreground">
            {fileValue.name} ({Math.round((fileValue.size || 0) / 1024)} KB)
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {label}
      <Input
        id={`pf-${field.name}`}
        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </div>
  );
};


// ─── Line picker (shared by replacement + return dialogs) ────────────
// Both flows pick a subset of order lines with quantities. The bounds
// differ — replacement is capped by the ordered quantity, return is
// capped by the fulfilled (received) quantity — so the parent passes
// `maxOf` as an accessor.
const LinePicker: React.FC<{
  order: Order;
  picks: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  maxOf: (line: OrderItem) => number;
  labelMax: string;
}> = ({ order, picks, onChange, maxOf, labelMax }) => {
  const { t: tLP } = useTranslation(['orders', 'common']);
  const rows = order.products
    .map((line) => ({ line, id: String(line._id), max: maxOf(line) }))
    .filter((row) => row.id && row.max > 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {tLP('orders:validation.no_eligible_items')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map(({ line, id, max }) => {
        const name = typeof line.product === 'object' ? line.product.name : line.name || 'Item';
        const current = picks[id] ?? 0;
        return (
          <div
            key={id}
            className="flex items-center justify-between gap-3 text-sm border rounded-md p-2.5"
          >
            <span className="flex-1 truncate">{name}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {tLP('orders:detail.line_picker.max_label', { max, labelMax })}
            </span>
            <Input
              type="number"
              min={0}
              max={max}
              value={current}
              onChange={(e) => {
                const v = Math.max(0, Math.min(max, parseInt(e.target.value) || 0));
                onChange({ ...picks, [id]: v });
              }}
              className="h-8 w-20"
            />
          </div>
        );
      })}
    </div>
  );
};

// ─── Returns & Replacements card ─────────────────────────────────────
const ReturnsAndReplacements: React.FC<{
  order: Order;
  onNewReplacement: () => void;
  onNewReturn: () => void;
  onAdvanceReturn: (returnId: string, nextStatus: string, refundAmount?: number) => void;
  busyReturnId: string | null;
  formatPrice: (n: number) => string;
}> = ({ order, onNewReplacement, onNewReturn, onAdvanceReturn, busyReturnId, formatPrice }) => {
  const { t: tR } = useTranslation(['orders', 'common']);
  const returns: OrderReturn[] = (order.returns || []) as OrderReturn[];
  const replacements = order.replacementOrders || [];
  const replacementOf = order.replacementOf;

  // Refund-amount dialog state (replaces window.prompt)
  const [refundDialog, setRefundDialog] = useState<{ returnId: string; amount: string } | null>(null);

  const openRefundAmountDialog = (ret: OrderReturn) => {
    const suggested = ret.items.reduce((sum, it) => {
      const line = order.products.find(
        (p) => String(p._id) === String(it.orderLineId),
      );
      const unitPrice = Number(line?.price) || 0;
      return sum + unitPrice * it.quantity;
    }, 0);
    setRefundDialog({ returnId: ret._id, amount: suggested.toFixed(2) });
  };

  const confirmRefundAmount = () => {
    if (!refundDialog) return;
    const amt = Number(refundDialog.amount);
    if (isNaN(amt) || amt < 0) {
      toast.error(tR('orders:validation.refund_amount_invalid'));
      return;
    }
    onAdvanceReturn(refundDialog.returnId, 'Refunded', amt);
    setRefundDialog(null);
  };

  const returnStatusVariant = (s: string) => {
    switch (s) {
      case 'Refunded':
        return 'default' as const;
      case 'Approved':
      case 'Received':
        return 'secondary' as const;
      case 'Rejected':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  const lineName = (id: string) => {
    const line = order.products.find((p) => String(p._id) === String(id));
    if (!line) return 'Item';
    return typeof line.product === 'object' ? line.product.name : line.name || 'Item';
  };

  // Hide the card entirely for replacement orders without their own returns
  // — they're the "other side" of the case and have nothing to show here.
  const showCard =
    returns.length > 0 || replacements.length > 0 || replacementOf || order.status !== 'Cancelled';
  if (!showCard) return null;

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-5 w-5" /> {tR('orders:detail.section.returns.title')}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onNewReturn}>
            {tR('orders:detail.action.new_return')}
          </Button>
          <Button size="sm" variant="outline" onClick={onNewReplacement}>
            {tR('orders:detail.action.new_replacement')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {replacementOf && (
          <div className="rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 p-3 text-sm">
            <p className="font-medium text-indigo-900 dark:text-indigo-200">
              {tR('orders:detail.replacement_info.is_replacement')}
            </p>
            <Link
              to={`/dashboard/orders/${replacementOf}`}
              className="text-xs text-indigo-700 dark:text-indigo-300 underline"
            >
              {tR('orders:detail.action.view_original_order')}
            </Link>
          </div>
        )}

        {replacements.length > 0 && (
          <div className="rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 p-3 text-sm space-y-1">
            <p className="font-medium text-indigo-900 dark:text-indigo-200">
              {replacements.length === 1
                ? tR('orders:detail.replacement_info.has_one')
                : tR('orders:detail.replacement_info.has_many', { count: replacements.length })}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {replacements.map((r, i) => (
                <Link
                  key={String(r)}
                  to={`/dashboard/orders/${String(r)}`}
                  className="text-xs text-indigo-700 dark:text-indigo-300 underline"
                >
                  {replacements.length === 1 ? tR('orders:detail.action.view_replacement_order') : tR('orders:detail.action.view_replacement_n', { n: i + 1 })}
                </Link>
              ))}
            </div>
          </div>
        )}

        {returns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tR('orders:detail.returns.none')}
          </p>
        ) : (
          <div className="space-y-3">
            {returns.map((ret) => (
              <div key={ret._id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{tR('orders:detail.returns.return_label')}</span>
                    <Badge variant={returnStatusVariant(ret.status)}>{tR(`common:status.${ret.status}`, { defaultValue: ret.status })}</Badge>
                    {typeof ret.refundAmount === 'number' && ret.refundAmount > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {formatPrice(ret.refundAmount)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {ret.status === 'Requested' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          disabled={busyReturnId === ret._id}
                          onClick={() => onAdvanceReturn(ret._id, 'Approved')}
                        >
                          {tR('orders:detail.returns.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          disabled={busyReturnId === ret._id}
                          onClick={() => onAdvanceReturn(ret._id, 'Rejected')}
                        >
                          {tR('orders:detail.returns.reject')}
                        </Button>
                      </>
                    )}
                    {ret.status === 'Approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={busyReturnId === ret._id}
                        onClick={() => onAdvanceReturn(ret._id, 'Received')}
                      >
                        {tR('orders:detail.returns.mark_received')}
                      </Button>
                    )}
                    {(ret.status === 'Approved' || ret.status === 'Received') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={busyReturnId === ret._id}
                        onClick={() => openRefundAmountDialog(ret)}
                      >
                        {tR('orders:detail.returns.mark_refunded')}
                      </Button>
                    )}
                  </div>
                </div>
                <ul className="text-sm space-y-0.5 ps-6">
                  {ret.items.map((it, i) => (
                    <li key={i} className="text-muted-foreground">
                      {lineName(it.orderLineId)}{' '}
                      <span className="text-foreground">× {it.quantity}</span>
                    </li>
                  ))}
                </ul>
                {ret.reason && (
                  <p className="text-xs text-muted-foreground ps-6 italic">"{ret.reason}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={!!refundDialog} onOpenChange={(open) => { if (!open) setRefundDialog(null); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tR('orders:dialog.return_refund_amount.title')}</DialogTitle>
          <DialogDescription>
            {tR('orders:detail.returns.refund_amount_desc')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={refundDialog?.amount ?? ''}
            onChange={(e) => setRefundDialog((prev) => prev ? { ...prev, amount: e.target.value } : prev)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRefundDialog(null)}>{tR('common:action.cancel')}</Button>
          <Button onClick={confirmRefundAmount}>{tR('orders:dialog.return_refund_amount.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

// ─── Timeline ─────────────────────────────────────────────────────────
// Renders the order's history array as a vertical timeline. Each event is
// labeled with the *resulting state* ("Order is being processed"), not the
// transition action ("Status changed from X to Y") — the user's mental
// model is "where is my order now", not "what button was pressed".

// Maps the *new* status of a status_changed event (or the event name for
// other event types) to the icon and color that describes the state the
// order is now in. Labels are resolved in the component via t().
const STATE_META_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  Pending:    { icon: PackagePlus,  color: 'bg-amber-500'   },
  Processing: { icon: RefreshCw,    color: 'bg-violet-500'  },
  Shipped:    { icon: Truck,        color: 'bg-sky-500'     },
  Delivered:  { icon: PackageCheck, color: 'bg-emerald-500' },
  Cancelled:  { icon: Ban,          color: 'bg-red-500'     },
  Refunded:   { icon: RefreshCw,    color: 'bg-rose-500'    },
};

const EVENT_META_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
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
const humanizeFulfillmentNote = (entry: OrderHistoryEntry, t: (k: string) => string) => {
  const note = entry.note || '';
  if (entry.event === 'fulfillment_status_changed') {
    if (/shipped/i.test(note)) return t('orders:detail.timeline.shipment_shipped');
    if (/delivered/i.test(note)) return t('orders:detail.timeline.shipment_delivered');
    if (/cancel/i.test(note)) return t('orders:detail.timeline.shipment_cancelled');
  }
  return note;
};

const resolveMeta = (entry: OrderHistoryEntry, t: (k: string) => string) => {
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

// ─── Documents dropdown ───────────────────────────────────────────────
// Lists the printable documents available for an order. Each option
// opens the corresponding dashboard page in a new tab so the user can
// print from there without losing the order detail view. Refund receipt
// entries are generated per-refund so staff can reprint any past refund.
const DocumentsMenu: React.FC<{ order: Order; payments: Payment[] }> = ({ order, payments }) => {
  const { t: tDM } = useTranslation(['orders', 'common']);
  const refunds = (payments || []).filter((p) => p?.status === 'refunded');
  const open = (doc: string) => window.open(orderDocUrl(order._id, doc), '_blank', 'noopener,noreferrer');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 me-2" />
          {tDM('orders:detail.documents.label')}
          <ChevronDown className="h-3 w-3 ms-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => open('invoice')}>
          <Receipt className="h-4 w-4 me-2" /> {tDM('orders:detail.documents.invoice')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open('packing-slip')}>
          <Package className="h-4 w-4 me-2" /> {tDM('orders:detail.documents.packing_slip')}
        </DropdownMenuItem>
        {refunds.length === 0 ? (
          <DropdownMenuItem disabled>
            <ArrowDownLeft className="h-4 w-4 me-2" /> {tDM('orders:detail.documents.refund_receipt')}
          </DropdownMenuItem>
        ) : (
          refunds.map((r) => (
            <DropdownMenuItem
              key={r._id}
              onClick={() => open(`refund-receipt/${r._id}`)}
            >
              <ArrowDownLeft className="h-4 w-4 me-2" />
              {tDM('orders:detail.documents.refund_receipt')} · {formatRefundLabel(r)}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const formatRefundLabel = (r: Payment) => {
  const amt = typeof r.amount === 'number' ? r.amount : 0;
  const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '';
  return `${amt.toFixed(2)}${date ? ` (${date})` : ''}`;
};

const OrderTimeline: React.FC<{ order: Order }> = ({ order }) => {
  const { t: tTL } = useTranslation(['orders', 'common']);
  const events: OrderHistoryEntry[] = (order.history && order.history.length > 0)
    ? [...order.history].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    : [
        {
          event: 'created',
          status: 'Pending',
          note: 'Order placed',
          at: order.createdAt,
        },
      ];

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const hasOverflow = el.scrollHeight - el.clientHeight > 4;
      const atTop = el.scrollTop < 4;
      setShowScrollHint(hasOverflow && atTop);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [events.length]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="relative max-h-[440px] overflow-y-auto scrollbar-hide"
      >
      {events.map((entry, idx) => {
        const meta = resolveMeta(entry, tTL);
        const Icon = meta.icon;
        const isLast = idx === events.length - 1;
        return (
          <div key={idx} className="relative ps-12 pb-5 last:pb-0">
            {!isLast && (
              <span className="absolute start-[17px] top-9 bottom-0 w-px bg-border" aria-hidden />
            )}
            <span
              className={`absolute start-0 top-0 flex h-9 w-9 items-center justify-center rounded-full ${meta.color} text-white shadow-sm ring-4 ring-background`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="pt-1">
              <p className="text-base font-semibold leading-tight">{meta.label}</p>
              {(() => {
                const note = humanizeFulfillmentNote(entry, tTL);
                return note ? (
                  <p className="text-sm text-muted-foreground mt-1">{note}</p>
                ) : null;
              })()}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(entry.at).toLocaleString()}
                {entry.byName && <span> · {entry.byName}</span>}
              </p>
            </div>
          </div>
        );
      })}
      </div>
      {showScrollHint && (
        <div
          className="pointer-events-none absolute bottom-0 start-0 end-0 flex justify-center pb-1"
          aria-hidden
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background/90 border shadow-sm animate-bounce">
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Status pill + variant helpers ───────────────────────────────────
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

// Semantic status colours (audit 3.8.3) — brand blue is never a status.
const orderStatusVariant = (s: OrderStatus): BadgeVariant => {
  switch (s) {
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

const paymentStatusVariant = (s: PaymentStatus): BadgeVariant => {
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

const fulfillmentStatusVariant = (s: FulfillmentStatus): BadgeVariant => {
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
const deriveFulfillmentStatus = (order: Order): FulfillmentStatus => {
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

// ─── Unified Operations card ─────────────────────────────────────────
// Consolidates three previously-separate panels (status pills, next-action
// strip, payment action panel) into a single card so the operational
// header stays compact and scannable. Layout:
//   ┌─────────────────────────────────────────────────────────┐
//   │  [ ORDER: pill ]  [ PAYMENT: pill ]  [ FULFILLMENT: p ]│
//   │  payment method · change status · verify (if manual)    │
//   ├─────────────────────────────────────────────────────────┤
//   │  NEXT: primary action  + secondary   [ more ▾ ]         │
//   └─────────────────────────────────────────────────────────┘
type NextAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
};

type PaymentActionKey = 'mark_paid' | 'capture' | 'void' | 'mark_failed' | 'record_manual';

const OperationsCard: React.FC<{
  order: Order;
  canWrite: boolean;
  updatingStatus: boolean;
  paymentActionBusy: boolean;
  isManualMethod: boolean;
  onStatusChange: (status: OrderStatus) => void;
  onVerifyPayment: () => void;
  onRecordManual: () => void;
  onPaymentAction: (
    action: PaymentActionKey,
    label: string,
    dangerous?: boolean,
  ) => void;
  onCancelOrder: () => void;
  onCreateFulfillment: () => void;
  onPrintPackingSlip: () => void;
  onMarkDelivered: () => void;
}> = ({
  order,
  canWrite,
  updatingStatus,
  paymentActionBusy,
  isManualMethod,
  onStatusChange,
  onVerifyPayment,
  onRecordManual,
  onPaymentAction,
  onCancelOrder,
  onCreateFulfillment,
  onPrintPackingSlip,
  onMarkDelivered,
}) => {
  const { t: tOC } = useTranslation(['orders', 'common']);
  const busy = paymentActionBusy || updatingStatus;
  const orderStatus = order.status;
  const paymentStatus = order.paymentStatus;
  const fulfillmentStatus = order.fulfillmentStatus || deriveFulfillmentStatus(order);
  const paymentMethodLc = (order.paymentMethod || '').toLowerCase();
  const isCod = paymentMethodLc === 'cod' || paymentMethodLc.includes('cash on delivery');

  const noPermReason = tOC('orders:detail.action.no_permission');

  // ── Next-action decision tree ────────────────────────────────────
  let summary: string | null = null;
  let primary: NextAction | null = null;
  const secondary: NextAction[] = [];

  // Decision tree follows the spec's lifecycle order: payment must settle
  // before fulfillment, fulfillment before delivery. Each branch returns
  // early so a non-terminal payment status cannot fall through to the
  // fulfillment actions.
  const paymentSettled = paymentStatus === 'Paid' || paymentStatus === 'Partially Refunded';

  if (orderStatus === 'Cancelled') {
    summary = tOC('orders:detail.next_action.cancelled_summary');
  } else if (paymentStatus === 'Not Paid') {
    // Manual transfer methods (bank transfer, etc.) must be verified against
    // the customer-supplied proof before marking paid — surface Verify as the
    // primary action so admins don't short-circuit the review step.
    if (isManualMethod) {
      primary = {
        label: tOC('orders:detail.action.verify_payment'),
        onClick: onVerifyPayment,
        disabled: !canWrite,
        disabledReason: noPermReason,
      };
    } else {
      primary = {
        label: tOC('orders:detail.action.mark_paid'),
        onClick: () => onPaymentAction('mark_paid', tOC('orders:detail.action.mark_paid')),
        disabled: !canWrite,
        disabledReason: noPermReason,
      };
    }
    secondary.push({ label: tOC('orders:detail.action.cancel'), onClick: onCancelOrder, variant: 'outline', disabled: !canWrite, disabledReason: noPermReason });
  } else if (paymentStatus === 'Authorized') {
    primary = { label: tOC('orders:detail.action.capture'), onClick: () => onPaymentAction('capture', tOC('orders:detail.action.capture')), disabled: !canWrite, disabledReason: noPermReason };
    secondary.push({ label: tOC('orders:detail.action.void'), onClick: () => onPaymentAction('void', tOC('orders:detail.action.void'), true), variant: 'outline', disabled: !canWrite, disabledReason: noPermReason });
  } else if (paymentStatus === 'Failed') {
    primary = isManualMethod
      ? { label: tOC('orders:detail.action.verify_payment'), onClick: onVerifyPayment, disabled: !canWrite, disabledReason: noPermReason }
      : { label: tOC('orders:detail.next_action.retry_mark_paid'), onClick: () => onPaymentAction('mark_paid', tOC('orders:detail.action.mark_paid')), disabled: !canWrite, disabledReason: noPermReason };
    secondary.push({ label: tOC('orders:detail.action.cancel'), onClick: onCancelOrder, variant: 'outline', disabled: !canWrite, disabledReason: noPermReason });
  } else if (paymentStatus === 'Voided') {
    summary = tOC('orders:detail.next_action.voided_summary');
    secondary.push({ label: tOC('orders:detail.action.cancel'), onClick: onCancelOrder, variant: 'outline', disabled: !canWrite, disabledReason: noPermReason });
  } else if (paymentSettled && fulfillmentStatus === 'Unfulfilled') {
    primary = { label: tOC('orders:detail.action.create_fulfillment'), onClick: onCreateFulfillment, disabled: !canWrite, disabledReason: noPermReason };
    secondary.push({ label: tOC('orders:detail.action.print_packing_slip'), onClick: onPrintPackingSlip, variant: 'outline' });
  } else if (paymentSettled && fulfillmentStatus === 'Partially Fulfilled') {
    primary = { label: tOC('orders:detail.next_action.fulfill_remaining'), onClick: onCreateFulfillment, disabled: !canWrite, disabledReason: noPermReason };
  } else if (fulfillmentStatus === 'Fulfilled' && orderStatus !== 'Delivered') {
    primary = { label: tOC('orders:detail.action.mark_delivered'), onClick: onMarkDelivered, disabled: !canWrite, disabledReason: noPermReason };
  } else {
    summary = tOC('orders:detail.next_action.no_pending');
  }

  // ── Overflow payment transitions (everything legal from the current
  //    paymentStatus, minus whatever is already surfaced as primary).
  const moreActions: { label: string; onClick: () => void; dangerous?: boolean }[] = [];
  if (canWrite) {
    if (paymentStatus === 'Not Paid') {
      if (!isCod) moreActions.push({ label: tOC('orders:detail.action.mark_paid'), onClick: () => onPaymentAction('mark_paid', tOC('orders:detail.action.mark_paid')) });
      moreActions.push({ label: tOC('orders:detail.action.mark_failed'), onClick: () => onPaymentAction('mark_failed', tOC('orders:detail.action.mark_failed'), true), dangerous: true });
      moreActions.push({ label: tOC('orders:detail.action.record_manual_payment'), onClick: onRecordManual });
    } else if (paymentStatus === 'Authorized') {
      moreActions.push({ label: tOC('orders:detail.action.mark_failed'), onClick: () => onPaymentAction('mark_failed', tOC('orders:detail.action.mark_failed'), true), dangerous: true });
    } else if (paymentStatus === 'Failed') {
      moreActions.push({ label: tOC('orders:detail.action.record_manual_payment'), onClick: onRecordManual });
    }
  }

  const renderButton = (a: NextAction, isPrimary: boolean) => (
    <Button
      key={a.label}
      variant={isPrimary ? (a.variant || 'default') : (a.variant || 'outline')}
      size="sm"
      disabled={a.disabled || busy}
      onClick={a.onClick}
      title={a.disabled ? a.disabledReason : undefined}
    >
      {busy && isPrimary && <Loader2 className="h-3 w-3 me-2 animate-spin" />}
      {a.label}
    </Button>
  );

  const canChangeStatus = orderStatus !== 'Delivered' && orderStatus !== 'Cancelled' && canWrite;
  const showVerify =
    isManualMethod &&
    (paymentStatus === 'Not Paid' || paymentStatus === 'Failed') &&
    canWrite;

  const hasActions = primary || secondary.length > 0 || moreActions.length > 0;

  const statusCardCls = 'flex flex-col gap-3 p-5';

  return (
    <div className="space-y-4">
      {/* ── Three separate status cards ─────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Order */}
        <Card>
          <CardContent className={statusCardCls}>
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Package className="h-5 w-5" /> {tOC('orders:detail.status_card.order')}
            </span>
            <Badge
              variant={orderStatusVariant(orderStatus)}
              className="justify-center min-w-[120px] self-start text-xs font-medium px-2.5 py-1"
            >
              {tOC(`common:status.${orderStatus}`, { defaultValue: orderStatus })}
            </Badge>
            {canChangeStatus && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={updatingStatus} className="self-start">
                    {updatingStatus && <Loader2 className="h-3 w-3 me-2 animate-spin" />}
                    {tOC('orders:detail.action.change_status')}
                    <ChevronDown className="h-3 w-3 ms-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {STATUS_OPTIONS.filter(s => s !== orderStatus).map(status => (
                    <DropdownMenuItem key={status} onClick={() => onStatusChange(status)}>
                      {tOC('orders:detail.action.move_to_status', { status: tOC(`common:status.${status}`, { defaultValue: status }) })}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardContent className={statusCardCls}>
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> {tOC('orders:detail.status_card.payment')}
            </span>
            <Badge
              variant={paymentStatusVariant(paymentStatus)}
              className="justify-center min-w-[120px] self-start text-xs font-medium px-2.5 py-1"
            >
              {tOC(`common:status.${paymentStatus}`, { defaultValue: paymentStatus })}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {tOC('orders:detail.status_card.via_method', { method: order.paymentMethod })}
            </p>
            {showVerify && (
              <Button size="sm" variant="outline" onClick={onVerifyPayment} disabled={busy} className="self-start">
                {tOC('orders:detail.action.verify_payment')}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Fulfillment */}
        <Card>
          <CardContent className={statusCardCls}>
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Truck className="h-5 w-5" /> {tOC('orders:detail.status_card.fulfillment')}
            </span>
            <Badge
              variant={fulfillmentStatusVariant(fulfillmentStatus)}
              className="justify-center min-w-[120px] self-start text-xs font-medium px-2.5 py-1"
            >
              {tOC(`common:status.${fulfillmentStatus}`, { defaultValue: fulfillmentStatus })}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* ── Next action card ────────────────────────────────────── */}
      {(hasActions || summary) && (
        <Card>
          <CardContent className="flex items-center flex-wrap gap-3 px-5 py-4">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {tOC('orders:detail.next_action.label')}
            </span>
            <span className="h-4 w-px bg-border" aria-hidden />
            {summary && <span className="text-sm text-muted-foreground">{summary}</span>}
            {primary && renderButton(primary, true)}
            {secondary.map((a) => renderButton(a, false))}
            {moreActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={busy} title={tOC('orders:detail.next_action.more_title')}>
                    {tOC('orders:detail.next_action.more')} <ChevronDown className="h-3 w-3 ms-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {moreActions.map((a) => (
                    <DropdownMenuItem
                      key={a.label}
                      onClick={a.onClick}
                      className={a.dangerous ? 'text-destructive focus:text-destructive' : undefined}
                    >
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
