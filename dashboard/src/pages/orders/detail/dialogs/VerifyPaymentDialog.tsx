import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { toast } from 'sonner';
import type { PaymentMethodField } from '../../../../types';
import { PaymentFieldDisplay } from '../../../../components/payments/PaymentFieldDisplay';
import { useOrderDetail } from '../context';

// Verify manual payment — merchant reviews the customer-submitted
// fields (receipt upload, transaction id, etc.) and marks paid.
export const VerifyPaymentDialog: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const {
    order, reload, reloadPayments,
    verifyOpen, setVerifyOpen, customerFields, submittedDetails,
  } = useOrderDetail();

  const [verifyNote, setVerifyNote] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Reset the note at the moment the dialog opens (render-time adjustment —
  // same observable behaviour as the old openVerifyDialog() initializer).
  const [wasOpen, setWasOpen] = useState(false);
  if (verifyOpen !== wasOpen) {
    setWasOpen(verifyOpen);
    if (verifyOpen) setVerifyNote('');
  }

  const submitVerify = async () => {
    if (!order) return;
    try {
      setVerifying(true);
      await api.payments.verifyManual(order._id, { note: verifyNote || undefined });
      toast.success(t('orders:toast.payment_verified'));
      setVerifyOpen(false);
      await reload();
      await reloadPayments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.verify_failed'));
    } finally {
      setVerifying(false);
    }
  };

  return (
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
  );
};
