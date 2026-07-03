import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import { useOrderDetail } from '../context';
import { LinePicker } from './LinePicker';

// Replacement order — duplicates chosen lines at $0, linked to this order.
export const ReplacementDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const { t } = useTranslation(['orders', 'common']);
  const navigate = useNavigate();
  const { order, reload } = useOrderDetail();

  const [replacementPicks, setReplacementPicks] = useState<Record<string, number>>({});
  const [replacementReason, setReplacementReason] = useState('');
  const [creatingReplacement, setCreatingReplacement] = useState(false);

  // Reset picks at the moment the dialog opens (render-time adjustment —
  // same observable behaviour as the old openReplacementDialog() initializer).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && order) {
      const initial: Record<string, number> = {};
      for (const line of order.products) {
        if (line?._id) initial[String(line._id)] = 0;
      }
      setReplacementPicks(initial);
      setReplacementReason('');
    }
  }

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
      onOpenChange(false);
      await reload();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onClick={() => onOpenChange(false)}
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
  );
};
