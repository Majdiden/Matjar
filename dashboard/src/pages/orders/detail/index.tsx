import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { getTenantCurrency, getTenantLocale, formatDateTime } from '../../../lib/format';
import { useSetBreadcrumbs } from '../../../contexts/breadcrumb-context';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { ArrowLeft, Printer, AlertCircle, FileText, Pencil, Phone, MessageCircle } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { toast } from 'sonner';
import type { Order, OrderStatus, CustomerContext, Payment } from '../../../types';
import { OrderFulfillments } from '../OrderFulfillments';
import { useAuth } from '../../../contexts/auth-context';
import { useFeatures } from '../../../contexts/features-context';
import { useConfirm } from '../../../components/ui/use-confirm';
import { OrderDetailContext, usePaymentMethodMeta, type PaymentActionKey } from './context';
import {
  orderDocUrl, extractOrder, getCustomerPhone, getCustomerName, whatsappUrl,
  type PaymentsListEnvelope, type PaymentsBlock,
} from './lib';
import { OrderStepperSection } from './OrderStepper';
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
  const { hasFeature } = useFeatures();
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
  // Draft banner actions (audit 5.2.7) — busy flag shared by Complete/Delete.
  const [draftActionBusy, setDraftActionBusy] = useState(false);

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
        description: t('common:toast.action_irreversible'),
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

  // Draft → Pending: stock decrements + notifications fire server-side.
  const handleCompleteDraft = async () => {
    if (!order) return;
    const ok = await confirm({
      title: t('orders:detail.draft.complete_confirm_title'),
      description: t('orders:detail.draft.complete_confirm_description'),
      confirmText: t('orders:detail.draft.complete_order'),
    });
    if (!ok) return;
    try {
      setDraftActionBusy(true);
      const res = await api.orders.completeDraft(order._id) as { responseObject?: Order };
      setOrder(res?.responseObject || null);
      if (!res?.responseObject) await loadOrder(order._id);
      toast.success(t('orders:toast.draft_completed'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.draft_complete_failed'));
    } finally {
      setDraftActionBusy(false);
    }
  };

  // Hard delete — only legal while the order is still a Draft.
  const handleDeleteDraft = async () => {
    if (!order) return;
    const ok = await confirm({
      title: t('orders:detail.draft.delete_confirm_title'),
      description: t('orders:detail.draft.delete_confirm_description'),
      variant: 'destructive',
      confirmText: t('orders:detail.draft.delete_draft'),
    });
    if (!ok) return;
    try {
      setDraftActionBusy(true);
      await api.orders.deleteDraft(order._id);
      toast.success(t('orders:toast.draft_deleted'));
      navigate('/dashboard/orders');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.draft_delete_failed'));
      setDraftActionBusy(false);
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
        {/* Header stacks on phones: back + title, then the actions on their
            own wrapping row, so Print/Documents don't collide with the title. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button variant="outline" size="sm" className="shrink-0 px-2" onClick={() => navigate('/dashboard/orders')}>
              <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />{t('orders:detail.back')}
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
                {t('orders:detail.order_title', { number: order.orderNumber || `#${order._id.slice(-6).toUpperCase()}` })}
              </h1>
              <p className="text-muted-foreground text-sm truncate">
                {t('orders:detail.placed', { date: formatDateTime(order.createdAt) })}
              </p>
            </div>
          </div>
          {/* Phones: Call + WhatsApp share row 1 (each flex-1); Documents (and
              Print) drop to their own full-width row below. Natural widths, all
              inline, from sm up. */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            {(() => {
              // Call / WhatsApp — the merchant's actual workflow in a
              // COD + WhatsApp market: confirm the order by phone first.
              const phone = getCustomerPhone(order);
              if (!phone) return null;
              const name = getCustomerName(order) || t('orders:detail.customer.guest');
              return (
                <>
                  <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
                    <a href={`tel:${phone}`} aria-label={t('orders:detail.contact.call_aria', { name })}>
                      <Phone className="h-4 w-4 me-2" />{t('orders:detail.contact.call')}
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
                    <a
                      href={whatsappUrl(phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('orders:detail.contact.whatsapp_aria', { name })}
                    >
                      <MessageCircle className="h-4 w-4 me-2" />{t('orders:detail.contact.whatsapp')}
                    </a>
                  </Button>
                </>
              );
            })()}
            {hasFeature('orders.fulfillment') && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => window.open(orderDocUrl(order._id, 'packing-slip'), '_blank', 'noopener,noreferrer')}
              >
                <Printer className="h-4 w-4 me-2" />{t('orders:detail.action.print')}
              </Button>
            )}
            <DocumentsMenu order={order} payments={payments} className="w-full sm:w-auto" />
          </div>
        </div>

        {/* Draft banner (audit 5.2.7) — a draft is not a live order yet:
            no stock held, no notifications sent. Primary actions live
            here; the status card below hides its transition dropdown. */}
        {order.status === 'Draft' && (
          <Card className="border-dashed border-primary/40 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 px-5 py-4">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-52">
                <p className="text-sm font-semibold">{t('orders:detail.draft.banner_title')}</p>
                <p className="text-sm text-muted-foreground">{t('orders:detail.draft.banner_description')}</p>
              </div>
              {/* Complete / Delete moved into the guided stepper below —
                  the banner keeps only the explanation and Edit. */}
              <Button
                variant="outline"
                size="sm"
                disabled={draftActionBusy || !can('orders.write')}
                onClick={() => navigate(`/dashboard/orders/new?draft=${order._id}`)}
              >
                <Pencil className="h-4 w-4 me-2" />{t('orders:detail.draft.edit_draft')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Guided status stepper — visual progress + ONE primary action +
            plain-language payment line (replaces the old operations card) */}
        <OrderStepperSection
          onCompleteDraft={handleCompleteDraft}
          onDeleteDraft={handleDeleteDraft}
          draftBusy={draftActionBusy}
        />

        <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {/* Main Content — min-w-0 so wide/unbreakable children (currency
              amounts, ids) shrink to the column instead of forcing the whole
              page to scroll sideways on phones. */}
          <div className="lg:col-span-2 space-y-6 min-w-0">
            <LineItemsCard />
            {hasFeature('payments.transactions') && <PaymentsCard />}
            {hasFeature('orders.fulfillment') && (
              <div id="fulfillment-card">
                <OrderFulfillments order={order} onChange={() => loadOrder(order._id)} />
              </div>
            )}
            {hasFeature('orders.returns') && <ReturnsCard />}
            <AddressCards />
            {hasFeature('orders.notes') && order.notes && (
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
          <div className="min-w-0 lg:relative lg:min-h-0">
            <div className="space-y-6 lg:absolute lg:inset-0 lg:overflow-y-auto scrollbar-hide">
              <CustomerCard />
              {hasFeature('orders.timeline') && <TimelineCard />}
              {hasFeature('orders.notes') && <NotesAndTagsCards />}
            </div>
          </div>
        </div>
      </div>
    </OrderDetailContext.Provider>
  );
};
