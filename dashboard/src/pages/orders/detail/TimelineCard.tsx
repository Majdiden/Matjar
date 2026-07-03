import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Calendar, ChevronDown, GitBranch } from 'lucide-react';
import type { Order, OrderHistoryEntry } from '../../../types';
import { useOrderDetail } from './context';
import { resolveMeta, humanizeFulfillmentNote } from './lib';

// Sidebar timeline card — summary header + the OrderTimeline list.
export const TimelineCard: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const navigate = useNavigate();
  const { order } = useOrderDetail();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-5 w-5" />{t('orders:detail.section.timeline.title')}
        </CardTitle>
        {(order.replacementOf ||
          (order.replacementOrders && order.replacementOrders.length > 0)) && (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => navigate(`/dashboard/orders/${order._id}/lifecycle`)}
          >
            <GitBranch className="h-3.5 w-3.5 me-1.5" />
            {t('orders:detail.action.view_timeline')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <OrderTimeline order={order} />
      </CardContent>
    </Card>
  );
};

const OrderTimeline: React.FC<{ order: Order }> = ({ order }) => {
  const { t: tTL } = useTranslation(['orders', 'common']);
  const events: OrderHistoryEntry[] = (order.history && order.history.length > 0)
    ? [...order.history].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    : [
        {
          event: 'created',
          status: 'Pending',
          note: 'Order placed',
          at: order.createdAt,
        },
      ];

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const hasOverflow = el.scrollHeight - el.clientHeight > 4;
      const atTop = el.scrollTop < 4;
      setShowScrollHint(hasOverflow && atTop);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [events.length]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="relative max-h-[440px] overflow-y-auto scrollbar-hide"
      >
      {events.map((entry, idx) => {
        const meta = resolveMeta(entry, tTL);
        const Icon = meta.icon;
        const isLast = idx === events.length - 1;
        return (
          <div key={idx} className="relative ps-12 pb-5 last:pb-0">
            {!isLast && (
              <span className="absolute start-[17px] top-9 bottom-0 w-px bg-border" aria-hidden />
            )}
            <span
              className={`absolute start-0 top-0 flex h-9 w-9 items-center justify-center rounded-full ${meta.color} text-white shadow-sm ring-4 ring-background`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="pt-1">
              <p className="text-base font-semibold leading-tight">{meta.label}</p>
              {(() => {
                const note = humanizeFulfillmentNote(entry, tTL);
                return note ? (
                  <p className="text-sm text-muted-foreground mt-1">{note}</p>
                ) : null;
              })()}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(entry.at).toLocaleString()}
                {entry.byName && <span> · {entry.byName}</span>}
              </p>
            </div>
          </div>
        );
      })}
      </div>
      {showScrollHint && (
        <div
          className="pointer-events-none absolute bottom-0 start-0 end-0 flex justify-center pb-1"
          aria-hidden
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background/90 border shadow-sm animate-bounce">
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  );
};
