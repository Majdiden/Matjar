import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Package, ChevronDown, FileText, Receipt, ArrowDownLeft } from 'lucide-react';
import type { Order, Payment } from '../../../types';
import { orderDocUrl } from './lib';

// ─── Documents dropdown ───────────────────────────────────────────────
// Lists the printable documents available for an order. Each option
// opens the corresponding dashboard page in a new tab so the user can
// print from there without losing the order detail view. Refund receipt
// entries are generated per-refund so staff can reprint any past refund.
export const DocumentsMenu: React.FC<{ order: Order; payments: Payment[] }> = ({ order, payments }) => {
  const { t: tDM } = useTranslation(['orders', 'common']);
  const refunds = (payments || []).filter((p) => p?.status === 'refunded');
  const open = (doc: string) => window.open(orderDocUrl(order._id, doc), '_blank', 'noopener,noreferrer');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 me-2" />
          {tDM('orders:detail.documents.label')}
          <ChevronDown className="h-3 w-3 ms-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => open('invoice')}>
          <Receipt className="h-4 w-4 me-2" /> {tDM('orders:detail.documents.invoice')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open('packing-slip')}>
          <Package className="h-4 w-4 me-2" /> {tDM('orders:detail.documents.packing_slip')}
        </DropdownMenuItem>
        {refunds.length === 0 ? (
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
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const formatRefundLabel = (r: Payment) => {
  const amt = typeof r.amount === 'number' ? r.amount : 0;
  const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '';
  return `${amt.toFixed(2)}${date ? ` (${date})` : ''}`;
};
