import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOrderDetail } from '../context';

// Record-manual-payment dialog — captures amount + reference + note
// and POSTs action=record_manual. Flips paymentStatus to Paid and
// writes a Payment row so the refund cap picks it up.
export const RecordManualPaymentDialog: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const {
    order, recordManualOpen, setRecordManualOpen, paymentActionBusy, runPaymentAction,
  } = useOrderDetail();

  const [recordManualAmount, setRecordManualAmount] = useState('');
  const [recordManualReference, setRecordManualReference] = useState('');
  const [recordManualNote, setRecordManualNote] = useState('');

  // Reset fields at the moment the dialog opens (render-time adjustment —
  // same observable behaviour as the old openRecordManualDialog() initializer).
  const [wasOpen, setWasOpen] = useState(false);
  if (recordManualOpen !== wasOpen) {
    setWasOpen(recordManualOpen);
    if (recordManualOpen) {
      setRecordManualAmount(String(order?.totalAmount ?? ''));
      setRecordManualReference('');
      setRecordManualNote('');
    }
  }

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

  return (
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
  );
};
