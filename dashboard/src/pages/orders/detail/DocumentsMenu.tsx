import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from '../../../components/ui/dropdown-menu';
import { Package, ChevronDown, FileText, Receipt, ArrowDownLeft, Mail, Loader2 } from 'lucide-react';
import type { Order, Payment } from '../../../types';
import { orderDocUrl } from './lib';
import { formatDate } from '../../../lib/format';
import { api } from '../../../lib/api-client';
import { toast } from 'sonner';
import { errMsg } from '../../../lib/errors';
import { useAuth } from '../../../contexts/auth-context';
import { useFeatures } from '../../../contexts/features-context';

// Customer-notification templates the backend can resend (audit 5.6.1) —
// these mirror ORDER_NOTIFICATION_STATUSES in services/orderNotifications.js.
const RESEND_TEMPLATES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'] as const;

// ─── Documents dropdown ───────────────────────────────────────────────
// Lists the printable documents available for an order plus a "Resend
// email" submenu (audit 5.6.1). Each document option opens the
// corresponding dashboard page in a new tab so the user can print from
// there without losing the order detail view. Refund receipt entries are
// generated per-refund so staff can reprint any past refund.
export const DocumentsMenu: React.FC<{ order: Order; payments: Payment[]; className?: string }> = ({ order, payments, className }) => {
  const { t: tDM } = useTranslation(['orders', 'common']);
  const { can } = useAuth();
  const { hasFeature } = useFeatures();
  const refunds = (payments || []).filter((p) => p?.status === 'refunded');
  const open = (doc: string) => window.open(orderDocUrl(order._id, doc), '_blank', 'noopener,noreferrer');

  const [resending, setResending] = useState('');
  const canWrite = can('orders.write');
  const isDraft = order.status === 'Draft';

  const resend = async (template: string) => {
    try {
      setResending(template);
      await api.orders.resendNotification(order._id, template);
      toast.success(tDM('orders:detail.resend.success', {
        template: tDM(`common:status.${template}`, { defaultValue: template }),
      }));
    } catch (err: unknown) {
      toast.error(errMsg(err, tDM('orders:detail.resend.failed')));
    } finally {
      setResending('');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <FileText className="h-4 w-4 me-2" />
          {tDM('orders:detail.documents.label')}
          <ChevronDown className="h-3 w-3 ms-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => open('invoice')}>
          <Receipt className="h-4 w-4 me-2" /> {tDM('orders:detail.documents.invoice')}
        </DropdownMenuItem>
        {hasFeature('orders.fulfillment') && (
          <DropdownMenuItem onClick={() => open('packing-slip')}>
            <Package className="h-4 w-4 me-2" /> {tDM('orders:detail.documents.packing_slip')}
          </DropdownMenuItem>
        )}
        {hasFeature('payments.transactions') && (
          refunds.length === 0 ? (
            <DropdownMenuItem disabled>
              <ArrowDownLeft className="h-4 w-4 me-2" /> {tDM('orders:detail.documents.refund_receipt')}
            </DropdownMenuItem>
          ) : (
            refunds.map((r) => (
              <DropdownMenuItem
                key={r._id}
                onClick={() => open(`refund-receipt/${r._id}`)}
              >
                <ArrowDownLeft className="h-4 w-4 me-2" />
                {tDM('orders:detail.documents.refund_receipt')} · {formatRefundLabel(r)}
              </DropdownMenuItem>
            ))
          )
        )}
        {canWrite && !isDraft && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {resending
                  ? <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  : <Mail className="h-4 w-4 me-2" />}
                {tDM('orders:detail.resend.label')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {RESEND_TEMPLATES.map((tpl) => (
                  <DropdownMenuItem
                    key={tpl}
                    disabled={Boolean(resending)}
                    onSelect={(e) => { e.preventDefault(); resend(tpl); }}
                  >
                    {tDM(`common:status.${tpl}`, { defaultValue: tpl })}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const formatRefundLabel = (r: Payment) => {
  const amt = typeof r.amount === 'number' ? r.amount : 0;
  const date = r.createdAt ? formatDate(r.createdAt) : '';
  return `${amt.toFixed(2)}${date ? ` (${date})` : ''}`;
};
