import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';
import { formatAmount, ORDER_TONE, PAYMENT_TONE, type OrderDetail } from '../../lib/api-commerce';
import type { Pagination } from '../../lib/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Horizontal, thumb-scrollable pill strip (mobile) that behaves like a normal row on md+. */
export function PillStrip<T extends string>({
  options,
  value,
  onChange,
  allLabel = 'All',
}: {
  options: readonly T[];
  value: string;
  onChange: (next: T | '') => void;
  allLabel?: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:overflow-visible md:px-0">
      <div className="flex w-max items-center gap-1 rounded-md border bg-card p-1">
        {['', ...options].map((s) => {
          const active = (s || '') === value;
          return (
            <button
              key={s || '__all'}
              type="button"
              onClick={() => onChange(s as T | '')}
              className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs transition-colors ${
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {s || allLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Pager({ pagination, page, loading, onPage }: { pagination: Pagination | null; page: number; loading: boolean; onPage: (n: number) => void }) {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground">
        Page {pagination.page} of {pagination.pages} · {pagination.total} total
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pagination.pages || loading} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export const StatusBadgeOf = ({ value, tone }: { value?: string | null; tone?: Record<string, React.ComponentProps<typeof Badge>['variant']> }) => {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const variant = tone?.[value] ?? 'outline';
  return <Badge variant={variant} className="capitalize">{value}</Badge>;
};

export const TenantLink = ({ id, tenant }: { id: string; tenant?: { name?: string; slug?: string } }) => (
  <Link to={`/tenants/${id}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
    {tenant?.name || tenant?.slug || id.slice(-6)}
  </Link>
);

/** Order detail drawer: header, lines, totals, and the timeline. Reused by the Orders page and the tenant Orders tab. */
export function OrderDetailModal({
  open,
  onClose,
  loading,
  error,
  data,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: OrderDetail | null;
}) {
  const o = data?.order;
  const cur = o?.currency || null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={o ? `Order ${o.orderNumber || o._id.slice(-6)}` : 'Order'}
      description={data?.tenant ? <TenantLink id={data.tenant._id} tenant={data.tenant} /> : undefined}
      className="max-w-3xl"
    >
      {loading ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} />
      ) : o ? (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <StatusBadgeOf value={o.status} tone={ORDER_TONE} />
            <StatusBadgeOf value={o.paymentStatus} tone={PAYMENT_TONE} />
            {o.fulfillmentStatus && <Badge variant="outline">{o.fulfillmentStatus}</Badge>}
            {o.paymentMethod && <Badge variant="secondary">{o.paymentMethod}</Badge>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Customer</div>
              <div className="font-medium">{o.customer?.name || '—'}</div>
              <div className="break-all text-muted-foreground" dir="ltr">{o.customer?.email || '—'}</div>
              {o.customer?.phone && <div className="text-muted-foreground" dir="ltr">{o.customer.phone}</div>}
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Ships to</div>
              <div>{[o.shipTo?.city, o.shipTo?.country].filter(Boolean).join(', ') || '—'}</div>
              {o.trackingNumber && <div className="text-muted-foreground">Tracking: <span className="font-mono">{o.trackingNumber}</span> {o.trackingCarrier ? `(${o.trackingCarrier})` : ''}</div>}
              <div className="text-muted-foreground">Placed {formatDate(o.createdAt)}</div>
            </div>
          </div>

          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">Items</div>
            <ul className="divide-y">
              {o.items.map((p, i) => (
                <li key={`${p.sku || p.name || 'line'}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.sku && <span className="font-mono">{p.sku}</span>}
                      {p.variantOptions?.length ? ` · ${p.variantOptions.map((v) => `${v.name}: ${v.value}`).join(', ')}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <div>{p.quantity} × {formatAmount(p.price, cur)}</div>
                    <div className="text-xs text-muted-foreground">{formatAmount(p.quantity * p.price, cur)}</div>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-y-1 border-t px-3 py-2 text-xs">
              {o.subtotal != null && (<><dt className="text-muted-foreground">Subtotal</dt><dd className="text-end">{formatAmount(o.subtotal, cur)}</dd></>)}
              {!!o.discount && (<><dt className="text-muted-foreground">Discount</dt><dd className="text-end">−{formatAmount(o.discount, cur)}</dd></>)}
              {o.shippingCost != null && (<><dt className="text-muted-foreground">Shipping</dt><dd className="text-end">{formatAmount(o.shippingCost, cur)}</dd></>)}
              {!!o.tax && (<><dt className="text-muted-foreground">Tax</dt><dd className="text-end">{formatAmount(o.tax, cur)}</dd></>)}
              <dt className="font-medium">Total</dt><dd className="text-end font-medium">{formatAmount(o.totalAmount, cur)}</dd>
              {!!o.refundedAmount && (<><dt className="text-muted-foreground">Refunded</dt><dd className="text-end text-destructive">−{formatAmount(o.refundedAmount, cur)}</dd></>)}
            </dl>
          </div>

          <div>
            <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Timeline</div>
            <ol className="relative ms-2 border-s ps-4">
              {data?.timeline.map((t, i) => (
                <li key={i} className="relative mb-3 last:mb-0">
                  <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                  <div className="text-xs text-muted-foreground">{formatDate(t.at)}{t.actor ? ` · ${t.actor}` : ''}</div>
                  <div className="font-medium">{t.label}</div>
                  {t.details && Object.keys(t.details).length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {Object.entries(t.details).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
