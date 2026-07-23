import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Package, Truck, CreditCard, Loader2, ChevronDown } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { toast } from 'sonner';
import type { Order, OrderStatus } from '../../../types';
import { useConfirm } from '../../../components/ui/use-confirm';
import { useFeatures } from '../../../contexts/features-context';
import { useOrderDetail } from './context';
import {
  orderDocUrl, orderStatusVariant, paymentStatusVariant,
  fulfillmentStatusVariant, deriveFulfillmentStatus,
} from './lib';

const STATUS_OPTIONS: OrderStatus[] = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];

// ─── Wired section ────────────────────────────────────────────────────
// Supplies the presentational OperationsCard below with handlers built
// from the shared OrderDetailContext (order, reload, api-status).
export const OperationsSection: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const confirm = useConfirm();
  const { hasFeature } = useFeatures();
  const {
    order, reload, canWriteOrders, updatingStatus, paymentActionBusy,
    setPaymentActionBusy, isManualMethod, handleStatusChange,
    setVerifyOpen, setRecordManualOpen,
  } = useOrderDetail();

  return (
    <OperationsCard
      order={order}
      canWrite={canWriteOrders}
      fulfillmentEnabled={hasFeature('orders.fulfillment')}
      updatingStatus={updatingStatus}
      paymentActionBusy={paymentActionBusy}
      isManualMethod={isManualMethod}
      onStatusChange={handleStatusChange}
      onVerifyPayment={() => setVerifyOpen(true)}
      onRecordManual={() => setRecordManualOpen(true)}
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
          await reload();
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
          await reload();
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
  );
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
  fulfillmentEnabled: boolean;
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
  fulfillmentEnabled,
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

  if (orderStatus === 'Draft') {
    // Draft orders (audit 5.2): the banner above the card owns the two
    // primary actions (Complete / Delete) — the operations strip only
    // explains the state and offers no payment/fulfillment shortcuts.
    summary = tOC('orders:detail.draft.next_action_summary');
  } else if (orderStatus === 'Cancelled') {
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
  } else if (paymentSettled && !fulfillmentEnabled) {
    // Fulfillment feature is off (COD/simple flow) — never suggest creating a
    // fulfillment. Advance the ORDER STATUS toward Delivered with plain marks.
    if (orderStatus === 'Shipped') {
      primary = { label: tOC('orders:detail.action.mark_delivered'), onClick: onMarkDelivered, disabled: !canWrite, disabledReason: noPermReason };
    } else if (orderStatus !== 'Delivered') {
      primary = { label: tOC('orders:detail.action.mark_shipped', { defaultValue: 'Mark as shipped' }), onClick: () => onStatusChange('Shipped'), disabled: !canWrite, disabledReason: noPermReason };
    } else {
      summary = tOC('orders:detail.next_action.no_pending');
    }
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
  if (canWrite && orderStatus !== 'Draft') {
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

  // Draft hides the normal transition dropdown — leaving a draft goes
  // through "Complete order" / "Delete draft" only (audit 5.2.7).
  const canChangeStatus =
    orderStatus !== 'Draft' && orderStatus !== 'Delivered' && orderStatus !== 'Cancelled' && canWrite;
  const showVerify =
    orderStatus !== 'Draft' &&
    isManualMethod &&
    (paymentStatus === 'Not Paid' || paymentStatus === 'Failed') &&
    canWrite;

  const hasActions = primary || secondary.length > 0 || moreActions.length > 0;

  const statusCardCls = 'flex flex-col gap-3 p-5';

  return (
    <div className="space-y-4">
      {/* ── Status cards (fulfillment card hidden when the feature is off) ── */}
      <div className={`grid gap-4 ${fulfillmentEnabled ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
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

        {/* Fulfillment — only when the fulfillment feature is enabled */}
        {fulfillmentEnabled && (
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
        )}
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
