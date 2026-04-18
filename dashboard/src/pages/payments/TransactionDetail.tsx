import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import {
  ArrowLeft, CreditCard, Receipt, User, ExternalLink, ArrowDownLeft,
  Hash, Calendar, Building2, ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { PaymentFieldDisplay } from '../../components/payments/PaymentFieldDisplay';

// Local view-model for the transaction-detail endpoint. These schemas are
// much richer server-side (see schemas/store/payment.js), but the detail
// page only reads a handful of fields — so model those explicitly and keep
// the rest as unknown to force narrowing.
interface PaymentCustomerField {
  name: string;
  label?: string;
  type?: string;
}

interface PaymentOrder {
  _id?: string;
  orderNumber?: string;
  totalAmount?: number;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  status?: string;
  paymentStatus?: string;
  paymentIntentId?: string;
  paymentDetails?: Record<string, unknown> & { providerLabel?: string };
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  customerEmail?: string;
  customerPhone?: string;
}

interface PaymentRecord {
  _id: string;
  amount: number;
  refundAmount?: number;
  currency?: string;
  status: string;
  provider?: string;
  paymentMethod?: string;
  providerTransactionId?: string;
  eventId?: string;
  createdAt: string;
  refundedAt?: string;
  metadata?: {
    reason?: string;
    note?: string;
    refundDetails?: Record<string, unknown>;
  };
  order?: PaymentOrder;
}

interface PaymentMethodDef {
  code?: string;
  label?: string;
  type?: 'gateway' | 'manual' | 'cod' | string;
  instructions?: string;
  customerFields?: PaymentCustomerField[];
}

interface RelatedTransaction {
  _id: string;
  amount: number;
  currency?: string;
  status: string;
  providerTransactionId?: string;
  createdAt: string;
}

interface TransactionPayload {
  payment: PaymentRecord;
  paymentMethodDef: PaymentMethodDef | null;
  related: RelatedTransaction[];
}

interface ApiEnvelope<T> {
  responseObject?: T;
  data?: T;
}

interface ApiErrorLike {
  message?: string;
  response?: { data?: { message?: string } };
}

export const TransactionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TransactionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/payments/${id}`);
        const envelope = res as ApiEnvelope<TransactionPayload> | undefined;
        const payload = envelope?.responseObject || envelope?.data;
        if (!cancelled) setData(payload ?? null);
      } catch (err) {
        const e = err as ApiErrorLike;
        if (!cancelled) toast.error(e?.message || 'Failed to load transaction');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);

  const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (status === 'completed' || status === 'succeeded') return 'default';
    if (status === 'refunded' || status === 'partially_refunded') return 'secondary';
    if (status === 'failed') return 'destructive';
    return 'outline';
  };

  const statusLabel = (s: string) =>
    (({ completed: 'Succeeded', succeeded: 'Succeeded', refunded: 'Refunded', partially_refunded: 'Partial Refund', pending: 'Pending', failed: 'Failed' } as Record<string, string>)[s] || s);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/dashboard/payments')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <p className="text-muted-foreground">Transaction not found.</p>
      </div>
    );
  }

  const { payment, paymentMethodDef, related } = data;
  const order: PaymentOrder = payment.order || {};
  const isManual =
    paymentMethodDef?.type === 'manual' ||
    paymentMethodDef?.type === 'cod' ||
    payment.provider === 'manual';
  const isRefund = payment.status === 'refunded';
  const customerFields: PaymentCustomerField[] = Array.isArray(paymentMethodDef?.customerFields)
    ? paymentMethodDef.customerFields
    : [];
  const submittedDetails: Record<string, unknown> & { providerLabel?: string } =
    order.paymentDetails || {};
  // Manual refunds persist the merchant-filled refund fields in metadata.
  const refundDetails: Record<string, unknown> =
    payment.metadata?.refundDetails || {};
  const shipping = order.shippingAddress || {};
  const customerName =
    [shipping.firstName, shipping.lastName].filter(Boolean).join(' ').trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/payments')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Transactions
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {isRefund ? <ArrowDownLeft className="h-5 w-5 text-destructive" /> : <Receipt className="h-5 w-5" />}
              {isRefund ? 'Refund' : 'Payment'} {formatCurrency(payment.amount, payment.currency)}
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              {payment._id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(payment.status)}>{statusLabel(payment.status)}</Badge>
          {order._id && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/dashboard/orders/${order._id}`}>
                <ExternalLink className="h-4 w-4 mr-2" /> View order
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(payment.amount, payment.currency)}
            </div>
            {(payment.refundAmount ?? 0) > 0 && (
              <p className="text-xs text-destructive mt-1">
                -{formatCurrency(payment.refundAmount ?? 0, payment.currency)} refunded
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold capitalize">
              {paymentMethodDef?.label || payment.paymentMethod || payment.provider}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {submittedDetails.providerLabel
                ? <>via <span className="font-medium">{submittedDetails.providerLabel}</span></>
                : <span className="capitalize">{paymentMethodDef?.type || payment.provider}</span>}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold">
              {new Date(payment.createdAt).toLocaleString()}
            </div>
            {payment.refundedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Refunded: {new Date(payment.refundedAt).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: details + customer fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction identifiers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="h-4 w-4" /> Transaction details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Transaction ID" value={payment.providerTransactionId} mono />
              {payment.eventId && <DetailRow label="Event ID" value={payment.eventId} mono />}
              <DetailRow label="Status" value={statusLabel(payment.status)} />
              <DetailRow
                label="Payment method"
                value={paymentMethodDef?.label || payment.paymentMethod || '—'}
              />
              {paymentMethodDef?.code && (
                <DetailRow label="Method code" value={paymentMethodDef.code} mono />
              )}
              {submittedDetails.providerLabel ? (
                <DetailRow label="Provider" value={submittedDetails.providerLabel} />
              ) : (
                <DetailRow label="Provider" value={payment.provider} />
              )}
              <DetailRow
                label="Currency"
                value={(payment.currency || 'USD').toUpperCase()}
              />
              {order.paymentIntentId && (
                <DetailRow label="Payment intent" value={order.paymentIntentId} mono />
              )}
              {payment.metadata?.reason && (
                <DetailRow label="Reason" value={payment.metadata.reason} />
              )}
              {payment.metadata?.note && (
                <DetailRow label="Note" value={payment.metadata.note} />
              )}
            </CardContent>
          </Card>

          {/* Customer-submitted fields (manual payments) */}
          {isManual && !isRefund && customerFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Customer payment details
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Submitted by the customer at checkout for{' '}
                  <span className="font-medium">{paymentMethodDef?.label}</span>.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {submittedDetails.providerLabel && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Provider</span>
                    <span className="text-sm font-medium">{submittedDetails.providerLabel}</span>
                  </div>
                )}
                {customerFields.map((f) => (
                  <PaymentFieldDisplay
                    key={f.name}
                    field={f}
                    value={submittedDetails[f.name]}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Refund-specific merchant-filled details */}
          {isRefund && isManual && customerFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4" /> Refund payment details
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Captured by the merchant when recording this manual refund.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {customerFields.map((f) => (
                  <PaymentFieldDisplay
                    key={f.name}
                    field={f}
                    value={refundDetails[f.name]}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Related transactions for this order */}
          {related.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Related transactions</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Other payment or refund records on the same order.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {related.map((r) => (
                    <li key={r._id}>
                      <Link
                        to={`/dashboard/payments/${r._id}`}
                        className="flex items-center justify-between p-4 hover:bg-muted/40 transition"
                      >
                        <div className="flex items-center gap-3">
                          {r.status === 'refunded' ? (
                            <ArrowDownLeft className="h-4 w-4 text-destructive" />
                          ) : (
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {formatCurrency(r.amount, r.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {r.providerTransactionId || r._id}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <Badge variant={statusVariant(r.status)}>
                            {statusLabel(r.status)}
                          </Badge>
                          <span className="text-muted-foreground">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: order + customer */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.orderNumber && (
                <DetailRow label="Number" value={`#${String(order.orderNumber).replace(/^#+/, '')}`} mono />
              )}
              <DetailRow
                label="Total"
                value={formatCurrency(order.totalAmount ?? 0, payment.currency)}
              />
              {typeof order.subtotal === 'number' && (
                <DetailRow
                  label="Subtotal"
                  value={formatCurrency(order.subtotal, payment.currency)}
                />
              )}
              {typeof order.shippingCost === 'number' && (
                <DetailRow
                  label="Shipping"
                  value={formatCurrency(order.shippingCost, payment.currency)}
                />
              )}
              {typeof order.tax === 'number' && order.tax > 0 && (
                <DetailRow
                  label="Tax"
                  value={formatCurrency(order.tax, payment.currency)}
                />
              )}
              <Separator className="my-2" />
              <DetailRow label="Order status" value={order.status || '—'} />
              <DetailRow label="Payment status" value={order.paymentStatus || '—'} />
              {order._id && (
                <Button asChild variant="outline" size="sm" className="w-full mt-2">
                  <Link to={`/dashboard/orders/${order._id}`}>
                    Open order
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <DetailRow label="Name" value={customerName || '—'} />
              <DetailRow label="Email" value={order.customerEmail || '—'} />
              {order.customerPhone && (
                <DetailRow label="Phone" value={order.customerPhone} />
              )}
              {shipping?.addressLine1 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Shipping address</p>
                  <p className="text-sm">
                    {shipping.addressLine1}
                    {shipping.addressLine2 ? `, ${shipping.addressLine2}` : ''}
                  </p>
                  <p className="text-sm">
                    {[shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(', ')}
                  </p>
                  {shipping.country && (
                    <p className="text-sm">{shipping.country}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {paymentMethodDef?.instructions && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Method instructions</CardTitle>
                <p className="text-xs text-muted-foreground">
                  What the customer saw at checkout.
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {paymentMethodDef.instructions}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value?: string | number; mono?: boolean }> = ({
  label, value, mono,
}) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
    <span
      className={`text-right break-all ${mono ? 'font-mono text-xs' : 'text-sm font-medium'}`}
    >
      {value || '—'}
    </span>
  </div>
);

export default TransactionDetail;
