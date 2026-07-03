import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { CreditCard, Receipt, ArrowDownLeft } from 'lucide-react';
import { useOrderDetail } from './context';
import { RefundDialog } from './dialogs/RefundDialog';
import { VerifyPaymentDialog } from './dialogs/VerifyPaymentDialog';
import { RecordManualPaymentDialog } from './dialogs/RecordManualPaymentDialog';

// Payments & Refunds card — totals, payment/refund history, and all of the
// payment dialogs (refund / verify / record-manual). Verify + record-manual
// are opened from the Operations card via the shared context.
export const PaymentsCard: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const {
    payments, paymentsLoading, totalPaid, totalRefunded, maxRefundable,
    isManualRefund, formatPrice,
  } = useOrderDetail();

  const [refundOpen, setRefundOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-5 w-5" /> {t('orders:detail.section.payments.title')}
          </CardTitle>
          {maxRefundable > 0 && (
            <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
              <ArrowDownLeft className="h-4 w-4 me-2" />
              {isManualRefund ? t('orders:detail.action.record_manual_refund') : t('orders:detail.action.refund')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-muted-foreground text-sm">{t('orders:detail.payment.paid')}</p>
              <p className="font-semibold text-base">{formatPrice(totalPaid)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">{t('orders:detail.payment.refunded')}</p>
              <p className="font-semibold text-base">{formatPrice(totalRefunded)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">{t('orders:detail.payment.refundable')}</p>
              <p className="font-semibold text-base">{formatPrice(maxRefundable)}</p>
            </div>
          </div>
          {paymentsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('orders:detail.payment.no_records')}
            </p>
          ) : (
            <div className="border rounded-md divide-y">
              {[...payments]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((p) => (
                <div key={p._id} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-2">
                    {p.status === 'refunded' ? (
                      <ArrowDownLeft className="h-5 w-5 text-amber-600" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-green-600" />
                    )}
                    <div>
                      <p className="font-semibold capitalize text-base">
                        {p.status === 'refunded' ? t('orders:detail.payment.record_type_refund') : t('orders:detail.payment.record_type_payment')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {p.provider} · {new Date(p.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className={`font-semibold ${p.status === 'refunded' ? 'text-amber-600' : ''}`}>
                      {p.status === 'refunded' ? '−' : ''}{formatPrice(p.amount || 0)}
                    </p>
                    {p.providerTransactionId && (
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                        {p.providerTransactionId}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RefundDialog open={refundOpen} onOpenChange={setRefundOpen} />
      <VerifyPaymentDialog />
      <RecordManualPaymentDialog />
    </>
  );
};
