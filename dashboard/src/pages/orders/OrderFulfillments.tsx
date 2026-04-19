import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import { Truck, Package, Plus, Loader2, Check, X } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import type { Order, OrderItem } from '../../types';

/** Response envelope for /orders/:id/fulfillments. The backend wraps it
 * in either `responseObject` (modern) or `data` (legacy). */
interface FulfillmentsEnvelope {
  responseObject?: {
    fulfillments?: Fulfillment[];
    unfulfilledByLine?: Record<string, number>;
  };
  data?: {
    fulfillments?: Fulfillment[];
    unfulfilledByLine?: Record<string, number>;
  };
}

interface FulfillmentItem {
  orderLineId: string;
  quantity: number;
}
interface Fulfillment {
  _id: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  items: FulfillmentItem[];
  trackingNumber?: string;
  trackingCarrier?: string;
  shippingCost?: number;
  notes?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  createdAt: string;
}

interface Props {
  order: Order;
  onChange?: () => void; // Refresh parent order after a mutation rolls up status
}

const statusVariant = (s: Fulfillment['status']) => {
  switch (s) {
    case 'Delivered': return 'default' as const;
    case 'Shipped':   return 'secondary' as const;
    case 'Cancelled': return 'destructive' as const;
    default:          return 'outline' as const;
  }
};

/**
 * Per-order fulfillments card.
 *
 * Shows existing shipments and lets a manager build a new one by picking
 * unfulfilled quantities from the order's line items. Quantities are bounded
 * by the unfulfilledByLine map returned from the backend so the form can't
 * over-allocate.
 */
export const OrderFulfillments: React.FC<Props> = ({ order, onChange }) => {
  const { t } = useTranslation(['orders', 'common']);
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [unfulfilled, setUnfulfilled] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state — quantities chosen per orderLineId, plus tracking metadata.
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');
  const [markShipped, setMarkShipped] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order._id]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.orders.getFulfillments(order._id) as FulfillmentsEnvelope;
      const data = res.responseObject || res.data || {};
      setFulfillments(data.fulfillments || []);
      setUnfulfilled(data.unfulfilledByLine || {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:fulfillment.toast.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const remaining = (lineId: string) => unfulfilled[lineId] ?? 0;
  const totalRemaining = Object.values(unfulfilled).reduce((a, b) => a + b, 0);

  const startNew = () => {
    // Pre-fill picks with the full remaining quantity per line so the common
    // case (one shipment, ship everything left) is one click.
    const next: Record<string, number> = {};
    for (const line of order.products) {
      const id = line._id;
      if (id) next[id] = remaining(String(id));
    }
    setPicks(next);
    setTracking('');
    setCarrier('');
    setMarkShipped(true);
    setShowForm(true);
  };

  const submit = async () => {
    const items = Object.entries(picks)
      .filter(([, q]) => q > 0)
      .map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
    if (items.length === 0) {
      toast.error(t('orders:fulfillment.card.form.error_no_items'));
      return;
    }
    try {
      setCreating(true);
      await api.orders.createFulfillment(order._id, {
        items,
        trackingNumber: tracking || undefined,
        trackingCarrier: carrier || undefined,
        markShipped,
      });
      toast.success(t('orders:fulfillment.toast.shipment_created'));
      setShowForm(false);
      await load();
      onChange?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:fulfillment.toast.shipment_failed'));
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, status: Fulfillment['status']) => {
    try {
      await api.orders.updateFulfillmentStatus(order._id, id, { status });
      toast.success(t('orders:fulfillment.toast.marked', { status: status.toLowerCase() }));
      await load();
      onChange?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:fulfillment.toast.mark_failed'));
    }
  };

  const lineName = (id: string) => {
    const line = order.products.find((p: OrderItem) => String(p._id) === String(id));
    if (!line) return 'Item';
    return typeof line.product === 'object' ? line.product.name : line.name || 'Item';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-5 w-5" />{t('orders:fulfillment.card.title')}
        </CardTitle>
        {totalRemaining > 0 && !showForm && (
          <Button size="sm" onClick={startNew}>
            <Plus className="h-3.5 w-3.5 mr-1" />{t('orders:fulfillment.card.new_shipment')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('orders:fulfillment.card.loading')}</p>
        ) : (
          <>
            {fulfillments.length === 0 && !showForm && (
              <p className="text-sm text-muted-foreground">
                {t('orders:fulfillment.card.no_shipments')} {totalRemaining > 0 ? t('orders:fulfillment.card.create_to_fulfill') : t('orders:fulfillment.card.fully_fulfilled')}
              </p>
            )}

            {fulfillments.map((f, idx) => (
              <div key={f._id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{t('orders:fulfillment.card.shipment_n', { n: idx + 1 })}</span>
                    <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
                  </div>
                  <div className="flex gap-1">
                    {f.status === 'Pending' && (
                      <Button size="sm" variant="outline" className="h-7" onClick={() => updateStatus(f._id, 'Shipped')}>
                        {t('orders:fulfillment.card.mark_shipped')}
                      </Button>
                    )}
                    {f.status === 'Shipped' && (
                      <Button size="sm" variant="outline" className="h-7" onClick={() => updateStatus(f._id, 'Delivered')}>
                        {t('orders:fulfillment.card.mark_delivered')}
                      </Button>
                    )}
                    {(f.status === 'Pending' || f.status === 'Shipped') && (
                      <Button size="sm" variant="outline" className="h-7" onClick={() => updateStatus(f._id, 'Cancelled')}>
                        {t('orders:fulfillment.card.cancel')}
                      </Button>
                    )}
                  </div>
                </div>
                <ul className="text-sm space-y-0.5 pl-6">
                  {f.items.map((it, i) => (
                    <li key={i} className="text-muted-foreground">
                      {lineName(it.orderLineId)} <span className="text-foreground">× {it.quantity}</span>
                    </li>
                  ))}
                </ul>
                {(f.trackingNumber || f.trackingCarrier) && (
                  <p className="text-xs text-muted-foreground pl-6">
                    {f.trackingCarrier && <span>{f.trackingCarrier} </span>}
                    {f.trackingNumber && <span className="font-mono">{f.trackingNumber}</span>}
                  </p>
                )}
              </div>
            ))}

            {showForm && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">{t('orders:fulfillment.card.form.title')}</p>
                <div className="space-y-2">
                  {order.products.map((line: OrderItem) => {
                    const id = String(line._id);
                    const max = remaining(id);
                    if (max <= 0) return null;
                    const name = typeof line.product === 'object' ? line.product.name : line.name || 'Item';
                    return (
                      <div key={id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex-1 truncate">{name}</span>
                        <span className="text-xs text-muted-foreground">{t('orders:fulfillment.card.form.max', { max })}</span>
                        <Input
                          type="number"
                          min={0}
                          max={max}
                          value={picks[id] ?? 0}
                          onChange={e => {
                            const v = Math.max(0, Math.min(max, parseInt(e.target.value) || 0));
                            setPicks(p => ({ ...p, [id]: v }));
                          }}
                          className="h-8 w-20"
                        />
                      </div>
                    );
                  })}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder={t('orders:fulfillment.card.form.carrier_placeholder')}
                    value={carrier}
                    onChange={e => setCarrier(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder={t('orders:fulfillment.card.form.tracking_placeholder')}
                    value={tracking}
                    onChange={e => setTracking(e.target.value)}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={markShipped}
                    onChange={e => setMarkShipped(e.target.checked)}
                  />
                  {t('orders:fulfillment.card.form.mark_shipped_label')}
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={submit} disabled={creating}>
                    {creating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                    {t('orders:fulfillment.card.form.create')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                    <X className="h-3 w-3 mr-1" />{t('common:action.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
