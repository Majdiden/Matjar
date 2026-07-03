import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  CreditCard, DollarSign, RefreshCw, MoreHorizontal, ArrowUpRight,
  ArrowDownLeft, AlertCircle, Loader2, Search, Receipt,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';

interface Payment {
  _id: string;
  orderId: string;
  orderNumber?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
  method: string;
  provider: string;
  transactionId?: string;
  refundedAmount?: number;
  customer?: { name: string; email: string };
  createdAt: string;
}

// Loose api-client response shapes, narrowed locally.
interface PaymentsListResponse {
  responseObject?: { payments?: Payment[] };
  data?: { payments?: Payment[] };
}

interface ApiErrorLike {
  message?: string;
  response?: { data?: { message?: string } };
}

export const Payments: React.FC = () => {
  const { t } = useTranslation(['payments', 'common']);
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; payment: Payment | null }>({
    open: false, payment: null,
  });
  const [refundAmount, setRefundAmount] = useState('');
  const [refunding, setRefunding] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalRevenue: 0, totalRefunded: 0, pendingPayments: 0, successfulPayments: 0,
  });

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/payments', { params: { search } }) as PaymentsListResponse;
      const data: Payment[] =
        response.responseObject?.payments || response.data?.payments || [];
      setPayments(data);

      // Calculate stats
      const successful = data.filter((p) => p.status === 'succeeded');
      const refunded = data.filter((p) => ['refunded', 'partially_refunded'].includes(p.status));
      const pending = data.filter((p) => p.status === 'pending');
      setStats({
        totalRevenue: successful.reduce((s, p) => s + p.amount, 0),
        totalRefunded: refunded.reduce((s, p) => s + (p.refundedAmount || p.amount), 0),
        pendingPayments: pending.length,
        successfulPayments: successful.length,
      });
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || t('payments:list.empty.title'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const handleRefund = async () => {
    if (!refundDialog.payment) return;
    const amount = refundAmount ? parseFloat(refundAmount) : undefined;
    if (amount && amount <= 0) { toast.error(t('payments:refund.form.toast.amount_positive')); return; }
    if (amount && amount > refundDialog.payment.amount) { toast.error(t('payments:refund.form.toast.exceeds_payment')); return; }

    try {
      setRefunding(true);
      await api.payments.refund(refundDialog.payment.orderId, amount);
      toast.success(t('payments:refund.form.toast.success'));
      setRefundDialog({ open: false, payment: null });
      setRefundAmount('');
      await loadPayments();
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || t('payments:refund.form.toast.failed'));
    } finally {
      setRefunding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    // Semantic status colours (audit 3.8.3).
    const map: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'info' | 'outline'; label: string }> = {
      pending: { variant: 'warning', label: t('payments:transaction.detail.status.pending') },
      succeeded: { variant: 'success', label: t('payments:transaction.detail.status.succeeded') },
      failed: { variant: 'destructive', label: t('payments:transaction.detail.status.failed') },
      refunded: { variant: 'info', label: t('payments:transaction.detail.status.refunded') },
      partially_refunded: { variant: 'info', label: t('payments:transaction.detail.status.partial_refund') },
    };
    const s = map[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('payments:list.title')}</h1>
        <p className="text-muted-foreground">{t('payments:list.description')}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('payments:list.stat.total_revenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('payments:list.stat.total_refunded')}</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.totalRefunded)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('payments:list.stat.successful')}</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successfulPayments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('payments:list.stat.pending')}</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPayments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('payments:list.search.placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadPayments()}
            className="ps-9"
          />
        </div>
        <Button variant="outline" onClick={loadPayments}>
          <RefreshCw className="h-4 w-4 me-2" />
          {t('common:action.refresh')}
        </Button>
      </div>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('payments:list.column.order')}</TableHead>
                <TableHead>{t('payments:list.column.customer')}</TableHead>
                <TableHead>{t('payments:list.column.amount')}</TableHead>
                <TableHead>{t('payments:list.column.method')}</TableHead>
                <TableHead>{t('payments:list.column.status')}</TableHead>
                <TableHead>{t('payments:list.column.date')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">{t('payments:list.empty.title')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map(payment => (
                  <TableRow
                    key={payment._id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/dashboard/payments/${payment._id}`)}
                  >
                    <TableCell>
                      <Link
                        to={`/dashboard/orders/${payment.orderId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline font-mono text-sm"
                      >
                        #{payment.orderNumber ? String(payment.orderNumber).replace(/^#+/, '') : payment.orderId.slice(-8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{payment.customer?.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{payment.customer?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount, payment.currency)}
                      {payment.refundedAmount ? (
                        <p className="text-xs text-destructive">
                          {t('payments:list.refunded_badge', { amount: formatCurrency(payment.refundedAmount, payment.currency) })}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm capitalize">{payment.method}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/dashboard/payments/${payment._id}`}>{t('payments:list.dropdown.view_details')}</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/dashboard/orders/${payment.orderId}`}>{t('payments:list.dropdown.view_order')}</Link>
                          </DropdownMenuItem>
                          {payment.status === 'succeeded' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setRefundDialog({ open: true, payment });
                                setRefundAmount('');
                              }}
                              className="text-destructive"
                            >
                              {t('payments:list.dropdown.process_refund')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialog.open} onOpenChange={open => !open && setRefundDialog({ open: false, payment: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payments:refund.form.title')}</DialogTitle>
            <DialogDescription>
              {t('payments:refund.form.description', {
                orderNumber: refundDialog.payment?.orderNumber
                  ? String(refundDialog.payment.orderNumber).replace(/^#+/, '')
                  : refundDialog.payment?.orderId.slice(-8),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('payments:refund.form.field.original_amount.label')}</span>
              <span className="font-medium">
                {refundDialog.payment && formatCurrency(refundDialog.payment.amount, refundDialog.payment.currency)}
              </span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('payments:refund.form.field.refund_amount.label')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={refundDialog.payment?.amount}
                placeholder={refundDialog.payment ? `${refundDialog.payment.amount}` : '0.00'}
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <span className="text-destructive">{t('payments:refund.form.warning')}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog({ open: false, payment: null })} disabled={refunding}>
              {t('common:action.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleRefund} disabled={refunding}>
              {refunding
                ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('payments:refund.form.processing')}</>
                : t('payments:refund.form.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payments;
