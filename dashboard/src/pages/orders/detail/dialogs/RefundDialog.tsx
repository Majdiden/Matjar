import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Loader2 } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { toast } from 'sonner';
import type { PaymentMethodField, PaymentFieldValue } from '../../../../types';
import { useOrderDetail } from '../context';
import { PaymentFieldInput } from './PaymentFieldInput';

// Manual refund applies to COD / bank transfer / store-credit orders
// where there's no Stripe intent. The backend chooses manual mode
// automatically when paymentIntentId is absent, but the UI surfaces
// it explicitly so the merchant sees *what* they're about to do.
export const RefundDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const { t } = useTranslation(['orders', 'common']);
  const {
    order, reload, reloadPayments, formatPrice,
    maxRefundable, totalRefunded, isManualRefund, isManualMethod, customerFields,
  } = useOrderDetail();

  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  // Merchant-filled manual-refund fields (mirror the method's customerFields)
  const [refundDetails, setRefundDetails] = useState<Record<string, PaymentFieldValue>>({});

  // Reset fields at the moment the dialog opens (render-time adjustment —
  // same observable behaviour as the old openRefundDialog() initializer).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setRefundAmount(maxRefundable.toFixed(2));
      setRefundReason('');
      setRefundDetails({});
    }
  }

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
      onOpenChange(false);
      // Reload both — order paymentStatus may have flipped to Refunded
      // and the payments list now has a new refund row.
      await reload();
      await reloadPayments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.refund_failed'));
    } finally {
      setRefunding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={refunding}>
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
  );
};
