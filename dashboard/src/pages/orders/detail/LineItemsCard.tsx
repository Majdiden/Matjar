import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { Package, Clock } from 'lucide-react';
import type { OrderItem } from '../../../types';
import { useOrderDetail } from './context';
import { getEffectiveFulfilledQuantity, getReturnableQuantity } from './lib';

// Order items + totals block.
export const LineItemsCard: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const { order, formatPrice } = useOrderDetail();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-5 w-5" />{t('orders:detail.section.items.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {order.products.map((item: OrderItem, i: number) => {
            const productObj = typeof item.product === 'object' ? item.product : null;
            const name = productObj?.name || item.name || 'Product';
            const sku = productObj?.sku || item.sku;
            // Prefer the order-time snapshot so the row stays stable
            // even after the product's media is edited or removed.
            const productImages = productObj && Array.isArray((productObj as { images?: unknown }).images)
              ? (productObj as { images?: Array<string | { url?: string; src?: string }> }).images
              : undefined;
            const firstImage = productImages && productImages[0];
            const image =
              item.image ||
              (typeof firstImage === 'string'
                ? firstImage
                : firstImage?.url || firstImage?.src) ||
              (productObj as { image?: string } | null)?.image;
            const variantOptions: Array<{ name: string; value: string }> = item.variantOptions || [];
            const variantLabel = variantOptions.length
              ? variantOptions.map((o) => `${o.name}: ${o.value}`).join(' / ')
              : null;
            const qty = Number(item.quantity) || 0;
            const fulfilled = getEffectiveFulfilledQuantity(order, item);
            const refunded = Number(item.refundedQuantity) || 0;
            const isFullyFulfilled = fulfilled >= qty && qty > 0;
            const isPartial = fulfilled > 0 && !isFullyFulfilled;
            const subtotal = (Number(item.price) || 0) * qty;
            const discount = Number(item.discountAllocation) || 0;
            const tax = Number(item.taxAllocation) || 0;
            // Returnable = fulfilled units still eligible for a
            // return (spec §5): fulfilled - refunded.
            const returnable = getReturnableQuantity(order, item);

            return (
              <li key={i} className="flex gap-4 p-4">
                <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {image ? (
                    <img src={image} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-base leading-tight truncate">{name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('orders:detail.item.sku', { sku: sku || '—' })}
                      </p>
                      {variantLabel && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {t('orders:detail.item.variant', { label: variantLabel })}
                        </p>
                      )}
                    </div>
                    <p className="text-base font-semibold tabular-nums whitespace-nowrap">
                      {formatPrice(subtotal)}
                    </p>
                  </div>

                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                    <span>
                      {t('orders:detail.item.qty', { count: qty })}
                    </span>
                    <span>
                      {t('orders:detail.item.fulfilled', { done: fulfilled, total: qty })}
                    </span>
                    <span>
                      {t('orders:detail.item.refunded', { done: refunded, total: qty })}
                    </span>
                    {returnable > 0 && (
                      <span>
                        {t('orders:detail.item.returnable', { count: returnable })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                    <span>
                      {t('orders:detail.item.unit', { price: formatPrice(item.price) })}
                    </span>
                    <span>
                      {t('orders:detail.item.subtotal', { price: formatPrice(subtotal) })}
                    </span>
                    {discount > 0 && (
                      <span className="text-green-600 dark:text-green-500">
                        {t('orders:detail.item.discount', { price: formatPrice(discount) })}
                      </span>
                    )}
                    {tax > 0 && (
                      <span>
                        {t('orders:detail.item.tax', { price: formatPrice(tax) })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center flex-wrap gap-2 mt-2">
                    {isFullyFulfilled && (
                      <Badge variant="success" className="h-5 text-[10px]">{t('common:status.Fulfilled')}</Badge>
                    )}
                    {isPartial && (
                      <Badge variant="secondary" className="h-5 text-[10px]">
                        {t('orders:detail.item.shipped', { done: fulfilled, total: qty })}
                      </Badge>
                    )}
                    {item.isPreorder && (
                      <Badge variant="outline" className="h-5 text-[10px] border-amber-500 text-amber-700 dark:text-amber-400">
                        <Clock className="h-3 w-3 me-0.5" />
                        {t('orders:detail.item.pre_order')}
                        {item.preorderExpectedShipDate && (
                          <>{t('orders:detail.item.ships', { date: new Date(item.preorderExpectedShipDate).toLocaleDateString() })}</>
                        )}
                      </Badge>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Totals */}
        <div className="border-t p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('orders:detail.totals.subtotal')}</span>
            <span>{formatPrice(order.subtotal || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('orders:detail.totals.shipping')}</span>
            <span>{formatPrice(order.shippingCost || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('orders:detail.totals.tax')}</span>
            <span>{formatPrice(order.tax || 0)}</span>
          </div>
          {(order.discount ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>{t('orders:detail.totals.discount')}</span>
              <span>-{formatPrice(order.discount!)}</span>
            </div>
          )}
          {(order.giftCardRedemption?.amount ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>{t('orders:detail.totals.gift_card')}{order.giftCardRedemption?.codeLast4 ? ` (•••• ${order.giftCardRedemption.codeLast4})` : ''}</span>
              <span>-{formatPrice(order.giftCardRedemption!.amount!)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>{t('orders:detail.totals.total')}</span>
            <span>{formatPrice(order.totalAmount)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
