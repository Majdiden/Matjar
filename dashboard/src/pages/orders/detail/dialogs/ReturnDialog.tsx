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
import type { OrderItem } from '../../../../types';
import { getReturnableQuantity } from '../lib';
import { useOrderDetail } from '../context';
import { LinePicker } from './LinePicker';

// Return (RMA) — creates a return request for chosen lines.
export const ReturnDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const { t } = useTranslation(['orders', 'common']);
  const { order, reload } = useOrderDetail();

  const [returnPicks, setReturnPicks] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [creatingReturn, setCreatingReturn] = useState(false);

  // Reset picks at the moment the dialog opens (render-time adjustment —
  // same observable behaviour as the old openReturnDialog() initializer).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && order) {
      const initial: Record<string, number> = {};
      for (const line of order.products) {
        if (line?._id) initial[String(line._id)] = 0;
      }
      setReturnPicks(initial);
      setReturnReason('');
    }
  }

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
      onOpenChange(false);
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.return_failed'));
    } finally {
      setCreatingReturn(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onClick={() => onOpenChange(false)}
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
  );
};
