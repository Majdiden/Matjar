import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import {
  Check, CheckCircle2, Clock, Truck, PackageCheck, Ban, RefreshCw,
  Banknote, CreditCard, Loader2, MoreHorizontal, Trash2, ShieldCheck,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import type { OrderStatus } from '../../../types';
import { useConfirm } from '../../../components/ui/use-confirm';
import { useFeatures } from '../../../contexts/features-context';
import { useOrderDetail } from './context';
import { isCodOrder, getCustomerName, deriveFulfillmentStatus } from './lib';
import { VerifyPaymentDialog } from './dialogs/VerifyPaymentDialog';
import { RecordManualPaymentDialog } from './dialogs/RecordManualPaymentDialog';

// ─── Guided status stepper ────────────────────────────────────────────
// Replaces the old three-pill OperationsCard with a novice-friendly,
// mobile-first guide: a visual New → Confirmed → Shipped → Delivered
// stepper, ONE big primary action for the current state, and a
// plain-language payment line (COD-first). Cancelled/Refunded render as
// an off-path terminal banner; Draft is a pre-state whose actions live
// here too (Complete order / Delete draft — passed down from index.tsx,
// which owns the draft handlers).

const STEPS = [
  { key: 'step_new', icon: Clock },
  { key: 'step_confirmed', icon: PackageCheck },
  { key: 'step_shipped', icon: Truck },
  { key: 'step_delivered', icon: CheckCircle2 },
] as const;

// Draft → -1 (pre-state, everything upcoming). Cancelled/Refunded never
// reach this function (they render the off-path banner instead).
const stepIndexFor = (s: OrderStatus): number => {
  switch (s) {
    case 'Pending': return 0;
    case 'Confirmed':
    case 'Processing': return 1;
    case 'Shipped': return 2;
    case 'Delivered':
    case 'Archived': return 3;
    default: return -1;
  }
};

export const OrderStepperSection: React.FC<{
  onCompleteDraft: () => void;
  onDeleteDraft: () => void;
  draftBusy: boolean;
}> = ({ onCompleteDraft, onDeleteDraft, draftBusy }) => {
  const { t } = useTranslation(['orders', 'common']);
  const confirm = useConfirm();
  const { hasFeature } = useFeatures();
  const {
    order, reload, canWriteOrders, updatingStatus, paymentActionBusy,
    setPaymentActionBusy, isManualMethod, handleStatusChange,
    runPaymentAction, setVerifyOpen, setRecordManualOpen, formatPrice,
  } = useOrderDetail();

  const busy = paymentActionBusy || updatingStatus || draftBusy;
  const status = order.status;
  const paymentStatus = order.paymentStatus;
  const isCod = isCodOrder(order);
  const paymentsAdvanced = hasFeature('payments.transactions');
  const fulfillmentEnabled = hasFeature('orders.fulfillment');
  const fulfillmentStatus = order.fulfillmentStatus || deriveFulfillmentStatus(order);

  const isDraft = status === 'Draft';
  const isOffPath = status === 'Cancelled' || status === 'Refunded';
  const isDelivered = status === 'Delivered' || status === 'Archived';
  const current = stepIndexFor(status);
  const noPermReason = t('orders:detail.action.no_permission');

  // Cancel — always the quiet secondary (never for Delivered / terminal).
  const cancelOrder = async () => {
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
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.cancel_failed'));
    } finally {
      setPaymentActionBusy(false);
    }
  };

  // ── ONE primary action per state ─────────────────────────────────
  let primary: { label: string; onClick: () => void; icon: React.ElementType } | null = null;
  let doneSummary: string | null = null;
  if (isDraft) {
    primary = { label: t('orders:detail.draft.complete_order'), onClick: onCompleteDraft, icon: CheckCircle2 };
  } else if (status === 'Pending') {
    primary = { label: t('orders:detail.stepper.confirm_order'), onClick: () => handleStatusChange('Processing'), icon: PackageCheck };
  } else if (status === 'Processing' || status === 'Confirmed') {
    if (fulfillmentEnabled && fulfillmentStatus === 'Unfulfilled') {
      primary = {
        label: t('orders:detail.action.create_fulfillment'),
        onClick: () => document.getElementById('fulfillment-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        icon: Truck,
      };
    } else if (fulfillmentEnabled && fulfillmentStatus === 'Partially Fulfilled') {
      primary = {
        label: t('orders:detail.next_action.fulfill_remaining'),
        onClick: () => document.getElementById('fulfillment-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        icon: Truck,
      };
    } else {
      primary = { label: t('orders:detail.action.mark_shipped'), onClick: () => handleStatusChange('Shipped'), icon: Truck };
    }
  } else if (status === 'Shipped') {
    primary = { label: t('orders:detail.action.mark_delivered'), onClick: () => handleStatusChange('Delivered'), icon: CheckCircle2 };
  } else if (isDelivered) {
    doneSummary = t('orders:detail.stepper.delivered_summary');
  }

  const showCancel = !isDraft && !isOffPath && !isDelivered;

  // ── Plain-language payment line ──────────────────────────────────
  const paymentLabel = () => {
    if (paymentStatus === 'Paid' || paymentStatus === 'Partially Refunded') {
      return isCod ? t('orders:detail.payment_simple.cod_collected') : t('orders:detail.payment_simple.paid');
    }
    if (paymentStatus === 'Not Paid') {
      if (isCod) return t('orders:detail.payment_simple.cod_pending');
      if (isManualMethod) return t('orders:detail.payment_simple.waiting_verification');
      return t('orders:detail.payment_simple.not_paid');
    }
    if (paymentStatus === 'Failed') return t('orders:detail.payment_simple.failed');
    return t(`common:status.${paymentStatus}`, { defaultValue: paymentStatus });
  };
  const paymentSettled = paymentStatus === 'Paid' || paymentStatus === 'Partially Refunded';

  // The one payment button that matters right now (COD → Mark collected,
  // manual → Verify payment, gateway auth → Capture).
  let paymentAction: { label: string; onClick: () => void } | null = null;
  if (canWriteOrders && !isDraft && !isOffPath) {
    if (paymentStatus === 'Not Paid' || paymentStatus === 'Failed') {
      if (isManualMethod) {
        paymentAction = { label: t('orders:detail.action.verify_payment'), onClick: () => setVerifyOpen(true) };
      } else if (isCod) {
        paymentAction = {
          label: t('orders:detail.payment_simple.mark_collected'),
          onClick: () => runPaymentAction('mark_paid', t('orders:detail.payment_simple.mark_collected')),
        };
      } else {
        paymentAction = {
          label: t('orders:detail.action.mark_paid'),
          onClick: () => runPaymentAction('mark_paid', t('orders:detail.action.mark_paid')),
        };
      }
    } else if (paymentStatus === 'Authorized' && paymentsAdvanced) {
      paymentAction = {
        label: t('orders:detail.action.capture'),
        onClick: () => runPaymentAction('capture', t('orders:detail.action.capture')),
      };
    }
  }

  // Advanced payment transitions stay out of sight unless the
  // payments.transactions feature is on (refunds live in PaymentsCard).
  const advancedActions: { label: string; onClick: () => void; dangerous?: boolean }[] = [];
  if (paymentsAdvanced && canWriteOrders && !isDraft && !isOffPath) {
    if (paymentStatus === 'Not Paid') {
      advancedActions.push({ label: t('orders:detail.action.record_manual_payment'), onClick: () => setRecordManualOpen(true) });
      advancedActions.push({ label: t('orders:detail.action.mark_failed'), onClick: () => runPaymentAction('mark_failed', t('orders:detail.action.mark_failed'), { dangerous: true }), dangerous: true });
    } else if (paymentStatus === 'Authorized') {
      advancedActions.push({ label: t('orders:detail.action.void'), onClick: () => runPaymentAction('void', t('orders:detail.action.void'), { dangerous: true }), dangerous: true });
    } else if (paymentStatus === 'Failed') {
      advancedActions.push({ label: t('orders:detail.action.record_manual_payment'), onClick: () => setRecordManualOpen(true) });
    }
  }

  const customerName = getCustomerName(order) || t('orders:detail.customer.guest');
  const city = order.shippingAddress?.city;
  const itemCount = order.products?.length || 0;

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* ── Stepper (or the off-path terminal banner) ─────────── */}
        {isOffPath ? (
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg border p-4',
              status === 'Cancelled'
                ? 'border-destructive/30 bg-destructive-soft/40'
                : 'border-border bg-muted/50',
            )}
          >
            {status === 'Cancelled'
              ? <Ban className="h-6 w-6 shrink-0 text-destructive" aria-hidden />
              : <RefreshCw className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {status === 'Cancelled'
                  ? t('orders:detail.stepper.cancelled_title')
                  : t('orders:detail.stepper.refunded_title')}
              </p>
              <p className="text-sm text-muted-foreground">
                {status === 'Cancelled'
                  ? t('orders:detail.next_action.cancelled_summary')
                  : t('orders:detail.stepper.refunded_summary')}
              </p>
            </div>
            <Badge variant={status === 'Cancelled' ? 'destructive' : 'info'} className="shrink-0">
              {t(`common:status.${status}`, { defaultValue: status })}
            </Badge>
          </div>
        ) : (
          <ol className="flex items-start" aria-label={t('orders:detail.stepper.aria_label')}>
            {STEPS.map((step, i) => {
              const done = isDelivered || i < current;
              const isCurrent = !isDelivered && i === current;
              const StepIcon = step.icon;
              return (
                <li
                  key={step.key}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="relative flex flex-1 flex-col items-center gap-1.5"
                >
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-4 start-[-50%] h-0.5 w-full transition-colors motion-reduce:transition-none',
                        done ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none',
                      done && 'border-primary bg-primary text-primary-foreground',
                      isCurrent && 'border-primary bg-background text-primary ring-4 ring-primary/15',
                      !done && !isCurrent && 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden /> : <StepIcon className="h-4 w-4" aria-hidden />}
                  </span>
                  <span
                    className={cn(
                      'px-0.5 text-center text-[11px] font-medium leading-tight sm:text-xs',
                      isCurrent ? 'font-semibold text-foreground' : done ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {t(`orders:detail.stepper.${step.key}`)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Draft hint — the pre-state explainer under the muted stepper */}
        {isDraft && (
          <p className="text-center text-sm text-muted-foreground">
            {t('orders:detail.stepper.draft_hint')}
          </p>
        )}

        {/* ── ONE primary action, big and thumb-friendly ─────────── */}
        {(primary || doneSummary || showCancel) && (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
            {doneSummary && (
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-success-soft-foreground">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> {doneSummary}
              </p>
            )}
            {primary && (
              <Button
                size="lg"
                className="h-12 w-full text-base sm:w-auto sm:min-w-64"
                disabled={busy || !canWriteOrders}
                title={!canWriteOrders ? noPermReason : undefined}
                onClick={primary.onClick}
              >
                {busy
                  ? <Loader2 className="h-5 w-5 me-2 animate-spin motion-reduce:animate-none" aria-hidden />
                  : <primary.icon className="h-5 w-5 me-2" aria-hidden />}
                {primary.label}
              </Button>
            )}
            {isDraft && (
              <Button
                variant="ghost"
                size="lg"
                className="h-12 w-full text-muted-foreground hover:text-destructive sm:w-auto"
                disabled={busy || !canWriteOrders}
                title={!canWriteOrders ? noPermReason : undefined}
                onClick={onDeleteDraft}
              >
                <Trash2 className="h-4 w-4 me-2" aria-hidden />
                {t('orders:detail.draft.delete_draft')}
              </Button>
            )}
            {showCancel && (
              <Button
                variant="ghost"
                size="lg"
                className="h-12 w-full text-muted-foreground hover:text-destructive sm:w-auto"
                disabled={busy || !canWriteOrders}
                title={!canWriteOrders ? noPermReason : undefined}
                onClick={cancelOrder}
              >
                {t('orders:detail.action.cancel')}
              </Button>
            )}
          </div>
        )}

        {/* ── Payment, plain language (hidden for drafts — nothing is
            owed until the order is live) ─────────────────────────── */}
        {!isDraft && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
          {isCod
            ? <Banknote className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            : <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              paymentSettled && 'text-success-soft-foreground',
              paymentStatus === 'Failed' && 'text-destructive',
            )}
            >
              {paymentSettled && <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />}
              {paymentLabel()}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {t('orders:detail.status_card.via_method', { method: order.paymentMethod })}
            </p>
          </div>
          {paymentAction && !paymentSettled && (
            <Button
              size="sm"
              variant="outline"
              className="h-10"
              disabled={busy}
              onClick={paymentAction.onClick}
            >
              {paymentAction.label}
            </Button>
          )}
          {advancedActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  disabled={busy}
                  aria-label={t('orders:detail.next_action.more_title')}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {advancedActions.map((a) => (
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
        </div>
        )}

        {/* ── Compact customer + total summary ───────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <p className="min-w-0 truncate text-muted-foreground">
            <span className="font-medium text-foreground">{customerName}</span>
            {city ? ` · ${city}` : ''}
            {' · '}
            {itemCount === 1
              ? t('orders:list.item_count_one', { count: 1 })
              : t('orders:list.item_count_other', { count: itemCount })}
          </p>
          <p className="text-base font-bold tabular-nums">{formatPrice(order.totalAmount)}</p>
        </div>
      </CardContent>

      {/* The verify / record-manual dialogs normally live inside
          PaymentsCard — which only renders when payments.transactions is
          on. Mount them here as a fallback so "Verify payment" and
          "Record manual payment" still work on the simple (flag-off)
          plan. Never mount both copies at once. */}
      {!paymentsAdvanced && (
        <>
          <VerifyPaymentDialog />
          <RecordManualPaymentDialog />
        </>
      )}
    </Card>
  );
};
