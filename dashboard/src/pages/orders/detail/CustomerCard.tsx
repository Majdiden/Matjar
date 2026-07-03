import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { Skeleton } from '../../../components/ui/skeleton';
import { User, Mail, Phone, ExternalLink } from 'lucide-react';
import { useOrderDetail } from './context';

// §8 — Customer context card. Lifetime stats + consent, plus
// quick links to the full customer profile and order list.
export const CustomerCard: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const { order, customerContext, customerContextLoading, formatPrice } = useOrderDetail();

  // Join defensively — draft/manual guest orders may carry an email-only
  // guestCustomer (no names), which a naive template would render as
  // "undefined undefined".
  const customerName = order.user?.name
    || [order.guestCustomer?.firstName, order.guestCustomer?.lastName].filter(Boolean).join(' ')
    || (order.shippingAddress?.firstName ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}` : t('orders:detail.customer.guest'));
  const customerEmail = order.user?.email || order.guestCustomer?.email || t('orders:detail.customer.not_available');
  const customerPhone = order.user?.phone || order.guestCustomer?.phone || order.shippingAddress?.phone || t('orders:detail.customer.not_available');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-5 w-5" />{t('orders:detail.section.customer.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium">{customerName}</p>
          <div className="mt-1 flex items-center gap-2">
            {(() => {
              const isGuest = customerContext
                ? customerContext.type === 'guest'
                : !order.user;
              return (
                <Badge variant={isGuest ? 'secondary' : 'info'} className="text-xs">
                  {isGuest ? t('orders:detail.customer.guest') : t('orders:detail.customer.customer')}
                </Badge>
              );
            })()}
          </div>
        </div>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="break-all">{customerEmail}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4 shrink-0" />
          <span>{customerPhone}</span>
        </div>

        <Separator />

        {customerContextLoading && !customerContext ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : customerContext ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('orders:detail.customer.lifetime_orders')}</dt>
            <dd className="text-end font-medium">{customerContext.lifetimeOrderCount}</dd>
            <dt className="text-muted-foreground">{t('orders:detail.customer.lifetime_spend')}</dt>
            <dd className="text-end font-medium">{formatPrice(customerContext.lifetimeSpend)}</dd>
            <dt className="text-muted-foreground">{t('orders:detail.customer.previous_refunds')}</dt>
            <dd className="text-end font-medium">{customerContext.previousRefunds}</dd>
            <dt className="text-muted-foreground">{t('orders:detail.customer.previous_cancellations')}</dt>
            <dd className="text-end font-medium">{customerContext.previousCancellations}</dd>
            <dt className="text-muted-foreground">{t('orders:detail.customer.last_order')}</dt>
            <dd className="text-end">
              {customerContext.lastOrderDate
                ? new Date(customerContext.lastOrderDate).toLocaleDateString()
                : '—'}
            </dd>
            <dt className="text-muted-foreground">{t('orders:detail.customer.customer_since')}</dt>
            <dd className="text-end">
              {customerContext.customerSince
                ? new Date(customerContext.customerSince).toLocaleDateString()
                : '—'}
            </dd>
            <dt className="text-muted-foreground">{t('orders:detail.customer.marketing_consent')}</dt>
            <dd className="text-end">
              {customerContext.marketingConsent === true
                ? t('orders:detail.customer.yes')
                : customerContext.marketingConsent === false
                ? t('orders:detail.customer.no')
                : t('orders:detail.customer.unknown')}
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t('orders:detail.customer.no_context')}</p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {(() => {
            const ctx = customerContext;
            const linkParam = ctx?.customerId
              ? ctx.customerId
              : ctx?.email
              ? ctx.email
              : order.user?._id || order.guestCustomer?.email || '';
            return (
              <Link
                to={`/dashboard/orders?customer=${encodeURIComponent(linkParam)}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('orders:detail.action.view_all_orders')}
              </Link>
            );
          })()}
          {customerContext?.type === 'customer' && customerContext.customerId && (
            <Link
              to={`/dashboard/customers/${customerContext.customerId}`}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <User className="h-3.5 w-3.5" />
              {t('orders:detail.action.view_profile')}
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
