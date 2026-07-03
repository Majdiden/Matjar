import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { getTenantCurrency, getTenantLocale } from '../../../lib/format';
import { useSetBreadcrumbs } from '../../../contexts/breadcrumb-context';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { ArrowLeft, Printer, AlertCircle } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { toast } from 'sonner';
import type { Order, OrderStatus, CustomerContext, Payment } from '../../../types';
import { OrderFulfillments } from '../OrderFulfillments';
import { useAuth } from '../../../contexts/auth-context';
import { useConfirm } from '../../../components/ui/use-confirm';
import { OrderDetailContext, usePaymentMethodMeta, type PaymentActionKey } from './context';
import {
  orderDocUrl, extractOrder,
  type PaymentsListEnvelope, type PaymentsBlock,
} from './lib';
import { OperationsSection } from './OperationsCard';
import { DocumentsMenu } from './DocumentsMenu';
import { LineItemsCard } from './LineItemsCard';
import { PaymentsCard } from './PaymentsCard';
import { ReturnsCard } from './ReturnsCard';
import { AddressCards } from './AddressCards';
import { CustomerCard } from './CustomerCard';
import { TimelineCard } from './TimelineCard';
import { NotesAndTagsCards } from './NotesAndTagsCards';

export const OrderDetails: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const confirm = useConfirm();
  const [paymentActionBusy, setPaymentActionBusy] = useState(false);
  const [recordManualOpen, setRecordManualOpen] = useState(false);
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

  // Payment-method meta (manual/COD derivations) — see usePaymentMethodMeta.
  const { isManualMethod, customerFields, submittedDetails } = usePaymentMethodMeta(order);
  const [verifyOpen, setVerifyOpen] = useState(false);

  // §8 — Customer context card (lifetime stats + consent).
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [customerContextLoading, setCustomerContextLoading] = useState(false);

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

  // Shared payment-action runner — confirms dangerous actions, calls the
  // backend, reloads the order on success, toasts on failure. Used by the
  // record-manual-payment dialog.
  const runPaymentAction = async (
    action: PaymentActionKey,
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

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(price);

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

  return (
    <OrderDetailContext.Provider
      value={{
        order,
        setOrder,
        reload: () => loadOrder(order._id),
        reloadPayments: () => loadPayments(order._id),
        payments, paymentsLoading, totalPaid, totalRefunded, maxRefundable,
        customerContext, customerContextLoading,
        isManualMethod, isManualRefund, customerFields, submittedDetails,
        paymentActionBusy, setPaymentActionBusy, updatingStatus,
        handleStatusChange, runPaymentAction,
        verifyOpen, setVerifyOpen, recordManualOpen, setRecordManualOpen,
        canWriteOrders: can('orders.write'),
        formatPrice,
      }}
    >
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
        <OperationsSection />

        <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <LineItemsCard />
            <PaymentsCard />
            <div id="fulfillment-card">
              <OrderFulfillments order={order} onChange={() => loadOrder(order._id)} />
            </div>
            <ReturnsCard />
            <AddressCards />
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
              <CustomerCard />
              <TimelineCard />
              <NotesAndTagsCards />
            </div>
          </div>
        </div>
      </div>
    </OrderDetailContext.Provider>
  );
};
