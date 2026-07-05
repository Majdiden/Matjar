import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { RefreshCw, ArrowDownLeft } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { toast } from 'sonner';
import type { Order, OrderReturn } from '../../../types';
import { useOrderDetail } from './context';
import { ReplacementDialog } from './dialogs/ReplacementDialog';
import { ReturnDialog } from './dialogs/ReturnDialog';

// Wired section — owns the return-lifecycle handler plus the new-return /
// new-replacement dialogs, and renders the verbatim card below.
export const ReturnsCard: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const { order, reload, formatPrice } = useOrderDetail();

  // Replacement / Return (RMA) dialogs
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  // Per-return inline action loading flags (by return _id)
  const [returnBusy, setReturnBusy] = useState<string | null>(null);

  const advanceReturn = async (returnId: string, nextStatus: string, refundAmt?: number) => {
    if (!order) return;
    try {
      setReturnBusy(returnId);
      await api.orders.updateReturnStatus(order._id, returnId, {
        status: nextStatus,
        refundAmount: refundAmt,
      });
      toast.success(t('orders:toast.return_updated', { status: t(`common:status.${nextStatus}`, { defaultValue: nextStatus }) }));
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.return_update_failed'));
    } finally {
      setReturnBusy(null);
    }
  };

  return (
    <>
      <ReturnsAndReplacements
        order={order}
        onNewReplacement={() => setReplacementOpen(true)}
        onNewReturn={() => setReturnOpen(true)}
        onAdvanceReturn={advanceReturn}
        busyReturnId={returnBusy}
        formatPrice={formatPrice}
      />
      <ReplacementDialog open={replacementOpen} onOpenChange={setReplacementOpen} />
      <ReturnDialog open={returnOpen} onOpenChange={setReturnOpen} />
    </>
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
      {/* Stack the title above the actions on phones; the two action
          buttons overflowed the card when forced onto one row. */}
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-5 w-5 shrink-0" /> {tR('orders:detail.section.returns.title')}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
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
