import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice, formatDate } from '../../lib/format';
import { errMsg } from '../../lib/errors';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { FilterPills } from '../../components/ui/filter-pills';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { StatCardRow } from '../../components/StatCardRow';
import { useFeatures } from '../../contexts/features-context';
import { DataTable, type DataTableColumn, type DataTableSortState } from '../../components/DataTable';
import type { StatCardDelta } from '../../components/StatCard';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Select } from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  ShoppingCart, MoreHorizontal, Eye, DollarSign, Clock, CheckCircle2,
  Truck, Package as PackageIcon, XCircle, Search, Filter, Download,
  RefreshCw, GitBranch, LayoutGrid, List, X, FileText, Plus,
  Phone, MessageCircle, PackageCheck, Banknote,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { toCSV, downloadCSV } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-mobile';
import { getCustomerPhone, getCustomerName, whatsappUrl, isCodOrder } from './detail/lib';
import type { Order, OrderStatus, PaginatedResponse } from '../../types';

// The bulk/full export builders tap into a few "decorated" order fields
// the backend folds in at read time — customer aggregate, email, etc. We
// keep the extension narrow and typed so the `get:` accessors stay safe.
type OrderForExport = Order & {
  customer?: { name?: string; firstName?: string; lastName?: string; email?: string };
  customerEmail?: string;
};

// Parameter bag passed to api.orders.getAll. We re-declare it locally
// (rather than touching api-client) so callers have a real type to build
// against without having to widen to any.
type OrdersListParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  tag?: string;
  from?: string;
  to?: string;
  sort?: string;
};

// Popover filter state (audit 5.4.1). Dates are yyyy-mm-dd strings from
// <input type="date">; empty string means "not set".
type OrderListFilters = {
  from: string;
  to: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  tag: string;
};

const EMPTY_FILTERS: OrderListFilters = {
  from: '',
  to: '',
  paymentStatus: '',
  fulfillmentStatus: '',
  tag: '',
};

// Backend enums (schemas/store/order.js) — labels come from common:status.*.
const PAYMENT_STATUS_OPTIONS = [
  'Not Paid', 'Authorized', 'Paid', 'Partially Refunded', 'Refunded', 'Voided', 'Failed',
] as const;
const FULFILLMENT_STATUS_OPTIONS = [
  'Unfulfilled', 'Partially Fulfilled', 'Fulfilled', 'Returned', 'Cancelled',
] as const;

// GET /orders/stats response (audit 5.4.3). Summary figures respect the
// active filters; the 30d/prev30d pairs are fixed rolling windows.
type OrderStats = {
  totalOrders: number;
  pending: number;
  delivered: number;
  totalRevenue: number;
  orders30d: number;
  ordersPrev30d: number;
  revenue30d: number;
  revenuePrev30d: number;
};

const EMPTY_STATS: OrderStats = {
  totalOrders: 0, pending: 0, delivered: 0, totalRevenue: 0,
  orders30d: 0, ordersPrev30d: 0, revenue30d: 0, revenuePrev30d: 0,
};

// Translate popover filters into query params. `to` is widened to the end
// of the selected day so the range is inclusive of its last date.
const filtersToParams = (f: OrderListFilters): OrdersListParams => {
  const params: OrdersListParams = {};
  if (f.from) params.from = f.from;
  if (f.to) params.to = `${f.to}T23:59:59.999`;
  if (f.paymentStatus) params.paymentStatus = f.paymentStatus;
  if (f.fulfillmentStatus) params.fulfillmentStatus = f.fulfillmentStatus;
  if (f.tag.trim()) params.tag = f.tag.trim();
  return params;
};

// "+12%" delta chip vs the previous period; hidden when there is no
// previous-period baseline to compare against.
const pctDelta = (current: number, previous: number): StatCardDelta | undefined => {
  if (previous <= 0) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    label: `${pct > 0 ? '+' : ''}${pct}%`,
    trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
};

// Stored order numbers already include a leading "#" (e.g. "#1042"), so we
// strip it before re-prefixing in the UI to avoid rendering "##1042".
const displayOrderNumber = (orderNumber?: string | null, fallbackId?: string) => {
  if (orderNumber) return `#${String(orderNumber).replace(/^#+/, '')}`;
  return fallbackId ? `#${fallbackId.slice(-8)}` : '';
};

type StatusTab = '' | 'Draft' | 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

// TAB_DEFS labels are resolved inside the component using t()
const TAB_DEFS_META: { id: StatusTab; icon: React.ElementType; labelKey: string }[] = [
  { id: '', labelKey: 'orders:list.filter.all', icon: ShoppingCart },
  { id: 'Draft', labelKey: 'orders:list.filter.draft', icon: FileText },
  { id: 'Pending', labelKey: 'orders:list.filter.pending', icon: Clock },
  { id: 'Processing', labelKey: 'orders:list.filter.processing', icon: PackageIcon },
  { id: 'Shipped', labelKey: 'orders:list.filter.shipped', icon: Truck },
  { id: 'Delivered', labelKey: 'orders:list.filter.delivered', icon: CheckCircle2 },
  { id: 'Cancelled', labelKey: 'orders:list.filter.cancelled', icon: XCircle },
];

// Semantic status colours (audit 3.8.3): success=green, warning=amber,
// destructive=red, info=neutral gray. Brand blue is never used for status.
const statusVariant = (status: string): 'success' | 'warning' | 'destructive' | 'info' | 'outline' => {
  switch (status) {
    case 'Draft': return 'outline';
    case 'Delivered': return 'success';
    case 'Shipped':
    case 'Processing': return 'info';
    case 'Pending': return 'warning';
    case 'Cancelled': return 'destructive';
    default: return 'outline';
  }
};

type ViewMode = 'cards' | 'table';
const VIEW_PREF_KEY = 'orders.viewMode';

const paymentVariant = (status: string): 'success' | 'warning' | 'destructive' | 'info' | 'outline' => {
  switch (status) {
    case 'Paid': return 'success';
    case 'Failed': return 'destructive';
    case 'Refunded': return 'info';
    case 'Not Paid': return 'warning';
    default: return 'info';
  }
};

export const Orders: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const { hasFeature } = useFeatures();
  const navigate = useNavigate();
  // Phones always get the stacked card view (wide tables are unusable at
  // 360px); the table/card toggle only applies from md up.
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<StatusTab>('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [stats, setStats] = useState<OrderStats>(EMPTY_STATS);
  // Applied popover filters vs the in-popover draft being edited.
  const [filters, setFilters] = useState<OrderListFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<OrderListFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  // Server-side sort; newest-first matches the backend default.
  const [sort, setSort] = useState<DataTableSortState>({ key: 'createdAt', dir: 'desc' });
  // Table is the default view (audit 3.8.5) — cards remain opt-in and the
  // stored preference still wins.
  // View choice persists automatically on change (audit 3.9.11 — the old
  // explicit "Default" pin control is gone).
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'table';
    return (localStorage.getItem(VIEW_PREF_KEY) as ViewMode) || 'table';
  });
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_PREF_KEY, mode);
  };
  const effectiveView: ViewMode = isMobile ? 'cards' : viewMode;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleBulkStatus = async (status: OrderStatus) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => api.orders.updateStatus(id, status)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(ok === 1 ? t('orders:list.bulk.selected', { count: ok }) + ` → ${t(`common:status.${status}`, { defaultValue: status })}` : t('orders:toast.bulk_marked_plural', { count: ok, status: t(`common:status.${status}`, { defaultValue: status }) }));
    if (failed) toast.error(t('orders:toast.bulk_update_failed', { count: failed }));
    setSelected(new Set());
    loadOrders();
    loadStats();
  };

  const handleBulkExport = () => {
    const all = orders.filter((o) => selected.has(o._id));
    if (all.length === 0) {
      toast.message(t('orders:toast.no_orders_to_export'));
      return;
    }
    const csv = toCSV(all as OrderForExport[], [
      { key: 'orderNumber', label: 'Order #' },
      { key: 'createdAt', label: 'Date', get: (o: OrderForExport) => o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : '' },
      { key: 'customer', label: 'Customer', get: (o: OrderForExport) => o.user?.name || 'Guest' },
      { key: 'customerEmail', label: 'Email', get: (o: OrderForExport) => o.user?.email || '' },
      { key: 'status', label: 'Status' },
      { key: 'paymentStatus', label: 'Payment status' },
      { key: 'totalAmount', label: 'Total', get: (o: OrderForExport) => (o.totalAmount ?? 0).toFixed(2) },
    ]);
    downloadCSV(csv, 'orders-selected');
    toast.success(all.length === 1 ? t('orders:toast.export_success', { count: all.length }) : t('orders:toast.export_success_plural', { count: all.length }));
  };


  // loadOrders / loadStats close over current state — the effects
  // intentionally only re-fetch on the paging/filter/sort inputs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadOrders(); }, [page, tab, search, filters, sort]);
  // Stats are scoped to the popover filters (the "filter window") but not
  // to the tab/search — the cards summarise the filtered period as a whole.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats(); }, [filters]);

  const loadStats = async () => {
    try {
      // Single server-side aggregation (audit 5.4.3) — replaces the old
      // 1000-row client-side reduce.
      const res = await api.orders.getStats(filtersToParams(filters)) as { responseObject: OrderStats };
      setStats({ ...EMPTY_STATS, ...res.responseObject });
    } catch {
      // Non-fatal — stats surface as zeroes if the endpoint is offline.
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params: OrdersListParams = { page, limit: 20, ...filtersToParams(filters) };
      if (tab) params.status = tab;
      if (search) params.search = search;
      params.sort = `${sort.dir === 'desc' ? '-' : ''}${sort.key}`;
      const response = await api.orders.getAll(params) as PaginatedResponse<Order>;
      setOrders((response.responseObject.orders as Order[] | undefined) || []);
      if (response.responseObject.pagination) setPagination(response.responseObject.pagination);
    } catch (err: unknown) {
      toast.error(errMsg(err, t('orders:toast.load_failed')));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await api.orders.updateStatus(orderId, newStatus);
      toast.success(t('orders:toast.status_updated', { status: newStatus }));
      setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o)));
      loadStats();
    } catch (err: unknown) {
      toast.error(errMsg(err, t('orders:toast.status_update_failed')));
    }
  };

  // Top-bar export (audit 5.6.2). Selected rows → client-side CSV of just
  // those rows (fast, no round-trip). Otherwise → server-side streaming CSV
  // that respects the active list filters and has no row ceiling (the old
  // limit:5000 client fetch is gone).
  const handleExport = async () => {
    if (selected.size > 0) {
      handleBulkExport();
      return;
    }
    try {
      const params: OrdersListParams = { ...filtersToParams(filters) };
      if (tab) params.status = tab;
      if (search) params.search = search;
      params.sort = `${sort.dir === 'desc' ? '-' : ''}${sort.key}`;
      const blob = await api.orders.exportCsv(params) as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `orders-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('orders:toast.export_started'));
    } catch (err: unknown) {
      toast.error(errMsg(err, t('orders:toast.export_failed')));
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const applyFilters = () => {
    setFilters(draftFilters);
    setPage(1);
    setFilterOpen(false);
  };
  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setFilterOpen(false);
  };

  // Every card carries an honest time-frame label (audit 3.9.9): "All time"
  // when unfiltered, "Filtered results" when the popover filters narrow the
  // window. Delta chips compare the last 30 days to the prior 30 and are
  // only shown unfiltered (they always describe fixed windows, so pairing
  // them with a filtered value would mislead).
  const statCards = useMemo(() => {
    const timeframe = hasActiveFilters
      ? t('orders:list.stat.filtered_results')
      : t('orders:list.stat.all_time');
    const ordersDelta = hasActiveFilters ? undefined : pctDelta(stats.orders30d, stats.ordersPrev30d);
    const revenueDelta = hasActiveFilters ? undefined : pctDelta(stats.revenue30d, stats.revenuePrev30d);
    const withTrend = (base: string, delta?: StatCardDelta) =>
      delta ? `${base} · ${t('orders:list.stat.trend_30d')}` : base;
    return [
      { label: t('orders:list.stat.total_orders'), value: stats.totalOrders.toLocaleString(), icon: ShoppingCart, delta: ordersDelta, description: withTrend(timeframe, ordersDelta) },
      { label: t('orders:list.stat.pending'), value: stats.pending.toLocaleString(), icon: Clock, delta: undefined, description: `${t('orders:list.stat.awaiting_fulfillment')} · ${timeframe}` },
      { label: t('orders:list.stat.delivered'), value: stats.delivered.toLocaleString(), icon: CheckCircle2, delta: undefined, description: `${t('orders:list.stat.completed_orders')} · ${timeframe}` },
      { label: t('orders:list.stat.total_revenue'), value: formatPrice(stats.totalRevenue), icon: DollarSign, delta: revenueDelta, description: withTrend(`${t('orders:list.stat.gross_sales')} · ${timeframe}`, revenueDelta) },
    ];
  }, [stats, hasActiveFilters, t]);

  const tableColumns: DataTableColumn<Order>[] = [
    {
      id: 'order',
      headerKey: 'orders:list.column.order',
      headClassName: 'w-[120px]',
      cellClassName: 'font-semibold tabular-nums',
      cell: (order) => (
        <div className="flex items-center gap-2">
          <span>{displayOrderNumber(order.orderNumber, order._id)}</span>
          {(order.replacementOf || (order.replacementOrders && order.replacementOrders.length > 0)) && (
            <span
              className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30"
              title={order.replacementOf ? t('orders:list.replacement.label') : t('orders:list.replacement.has_replacements_plural', { count: order.replacementOrders!.length })}
            >
              <GitBranch className="h-3 w-3" />
              {order.replacementOf ? t('orders:list.replacement.label') : `${order.replacementOrders!.length}×`}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'customer',
      headerKey: 'orders:list.column.customer',
      cell: (order) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{order.user?.name || t('orders:list.guest')}</span>
          {order.user?.email && (
            <span className="text-xs text-muted-foreground">{order.user.email}</span>
          )}
        </div>
      ),
    },
    {
      id: 'date',
      headerKey: 'orders:list.column.date',
      sortKey: 'createdAt',
      cellClassName: 'text-sm text-muted-foreground whitespace-nowrap',
      cell: (order) => formatDate(order.createdAt),
    },
    {
      id: 'items',
      headerKey: 'orders:list.column.items',
      align: 'center',
      cellClassName: 'text-sm tabular-nums',
      cell: (order) => order.products.length,
    },
    {
      id: 'status',
      headerKey: 'orders:list.column.status',
      cell: (order) => (
        <Badge variant={statusVariant(order.status)} className="text-[10px] h-5">
          {t(`common:status.${order.status}`, { defaultValue: order.status })}
        </Badge>
      ),
    },
    {
      id: 'payment',
      headerKey: 'orders:list.column.payment',
      cell: (order) => (
        <Badge variant={paymentVariant(order.paymentStatus)} className="text-[10px] h-5">
          {t(`common:status.${order.paymentStatus}`, { defaultValue: order.paymentStatus })}
        </Badge>
      ),
    },
    {
      id: 'total',
      headerKey: 'orders:list.column.total',
      sortKey: 'totalAmount',
      align: 'end',
      cellClassName: 'font-semibold tabular-nums',
      cell: (order) => formatPrice(order.totalAmount),
    },
    {
      id: 'actions',
      headClassName: 'w-[50px]',
      cell: (order) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>{t('orders:list.dropdown.actions')}</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/orders/${order._id}`); }}
            >
              <Eye className="me-2 h-4 w-4" /> {t('orders:list.dropdown.view_details')}
            </DropdownMenuItem>
            {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">{t('orders:list.dropdown.update_status')}</DropdownMenuLabel>
                {(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as OrderStatus[])
                  .filter((s) => s !== order.status)
                  .map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(order._id, s); }}
                    >
                      {t(`common:status.${s}`, { defaultValue: s })}
                    </DropdownMenuItem>
                  ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title={t('orders:list.title')}
        description={t('orders:list.description')}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 me-2" /> {t('common:action.export')}
            </Button>
            <Button size="sm" onClick={() => navigate('/dashboard/orders/new')}>
              <Plus className="h-4 w-4 me-2" /> {t('orders:list.create_order')}
            </Button>
          </div>
        )}
      />

      {/* Stat strip — horizontal snap-scroll on phones, grid on desktop */}
      <StatCardRow className="sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} delta={s.delta} description={s.description} />
        ))}
      </StatCardRow>

      {/* Filter pills */}
      <FilterPills
        items={TAB_DEFS_META.map((td) => ({ id: td.id || 'all', label: t(td.labelKey as Parameters<typeof t>[0]), icon: td.icon }))}
        value={tab || 'all'}
        onChange={(v) => { setTab(v === 'all' ? '' : (v as StatusTab)); setPage(1); }}
      />

      {/* Search row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('orders:list.search.placeholder')}
            className="ps-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Popover
          open={filterOpen}
          onOpenChange={(open) => {
            setFilterOpen(open);
            if (open) setDraftFilters(filters); // seed the draft from what's applied
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 me-2" /> {t('common:action.filter')}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ms-2 h-5 px-1.5 text-[10px]" aria-label={t('orders:list.filters.active_count', { count: activeFilterCount })}>
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3">
            <p className="text-sm font-semibold">{t('orders:list.filters.title')}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="orders-filter-from">
                  {t('orders:list.filters.from')}
                </label>
                <Input
                  id="orders-filter-from"
                  type="date"
                  className="h-9"
                  value={draftFilters.from}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="orders-filter-to">
                  {t('orders:list.filters.to')}
                </label>
                <Input
                  id="orders-filter-to"
                  type="date"
                  className="h-9"
                  value={draftFilters.to}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </div>
            </div>
            <Select
              label={t('orders:list.filters.payment_status')}
              className="h-9"
              value={draftFilters.paymentStatus}
              onValueChange={(v) => setDraftFilters((f) => ({ ...f, paymentStatus: v }))}
              options={[
                { value: '', label: t('orders:list.filters.any') },
                ...PAYMENT_STATUS_OPTIONS.map((s) => ({ value: s, label: t(`common:status.${s}`, { defaultValue: s }) })),
              ]}
            />
            {hasFeature('orders.fulfillment') && (
              <Select
                label={t('orders:list.filters.fulfillment_status')}
                className="h-9"
                value={draftFilters.fulfillmentStatus}
                onValueChange={(v) => setDraftFilters((f) => ({ ...f, fulfillmentStatus: v }))}
                options={[
                  { value: '', label: t('orders:list.filters.any') },
                  ...FULFILLMENT_STATUS_OPTIONS.map((s) => ({ value: s, label: t(`common:status.${s}`, { defaultValue: s }) })),
                ]}
              />
            )}
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="orders-filter-tag">
                {t('orders:list.filters.tag')}
              </label>
              <Input
                id="orders-filter-tag"
                className="h-9"
                placeholder={t('orders:list.filters.tag_placeholder')}
                value={draftFilters.tag}
                onChange={(e) => setDraftFilters((f) => ({ ...f, tag: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                {t('common:action.reset')}
              </Button>
              <Button size="sm" onClick={applyFilters}>
                {t('common:action.apply')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <div className="ms-auto hidden items-center gap-2 md:flex">
          <div className="inline-flex rounded-md border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'cards' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={viewMode === 'cards'}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> {t('orders:list.view.cards')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={viewMode === 'table'}
            >
              <List className="h-3.5 w-3.5" /> {t('orders:list.view.table')}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{t('orders:list.bulk.selected', { count: selected.size })}</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 me-1.5" />{t('orders:list.bulk.clear')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('Processing')}>
              <PackageIcon className="h-3.5 w-3.5 me-1.5" />{t('orders:list.bulk.mark_processing')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('Shipped')}>
              <Truck className="h-3.5 w-3.5 me-1.5" />{t('orders:list.bulk.mark_shipped')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('Delivered')}>
              <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />{t('orders:list.bulk.mark_delivered')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkExport}>
              <Download className="h-3.5 w-3.5 me-1.5" />{t('orders:list.bulk.export_csv')}
            </Button>
          </div>
        </div>
      )}

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">
              {tab || search || hasActiveFilters ? t('orders:list.empty.filtered_title') : t('orders:list.empty.title')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {tab || search || hasActiveFilters
                ? t('orders:list.empty.filtered_description')
                : t('orders:list.empty.description')}
            </p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        /* ── Mobile order cards (guided, thumb-friendly) ──────────────
           One card per order: number + status + total up top, customer +
           city + date, a plain-language payment hint, then the SAME next
           step the detail stepper would suggest (Confirm → Ship →
           Deliver) plus Call/WhatsApp shortcuts. Tap anywhere else on
           the card to open the order. */
        <div className="space-y-3">
          {orders.map((order) => {
            const nextStep: { label: string; status: OrderStatus; icon: React.ElementType } | null =
              order.status === 'Pending'
                ? { label: t('orders:detail.stepper.confirm_order'), status: 'Processing', icon: PackageCheck }
                : order.status === 'Processing' || order.status === 'Confirmed'
                  ? { label: t('orders:detail.action.mark_shipped'), status: 'Shipped', icon: Truck }
                  : order.status === 'Shipped'
                    ? { label: t('orders:detail.action.mark_delivered'), status: 'Delivered', icon: CheckCircle2 }
                    : null;
            const isCod = isCodOrder(order);
            const paid = order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Refunded';
            const paymentHint = paid
              ? (isCod ? t('orders:detail.payment_simple.cod_collected') : t('orders:detail.payment_simple.paid'))
              : order.paymentStatus === 'Not Paid'
                ? (isCod ? t('orders:detail.payment_simple.cod_pending') : t('orders:detail.payment_simple.not_paid'))
                : t(`common:status.${order.paymentStatus}`, { defaultValue: order.paymentStatus });
            const phone = getCustomerPhone(order);
            const customerName = order.user?.name || getCustomerName(order) || t('orders:list.guest');
            const number = displayOrderNumber(order.orderNumber, order._id);
            return (
              <Card
                key={order._id}
                role="link"
                tabIndex={0}
                aria-label={t('orders:list.card.open_order', { number })}
                className="cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:bg-muted/50 motion-reduce:transition-none"
                onClick={() => navigate(`/dashboard/orders/${order._id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/dashboard/orders/${order._id}`);
                  }
                }}
              >
                <CardContent className="space-y-3 p-4">
                  {/* Number + status | total */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums">{number}</span>
                      <Badge variant={statusVariant(order.status)} className="h-5 text-[10px]">
                        {t(`common:status.${order.status}`, { defaultValue: order.status })}
                      </Badge>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums">{formatPrice(order.totalAmount)}</span>
                  </div>

                  {/* Customer + city + date */}
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{customerName}</span>
                    {order.shippingAddress?.city ? ` · ${order.shippingAddress.city}` : ''}
                    {` · ${formatDate(order.createdAt)}`}
                  </p>

                  {/* Payment hint, plain language */}
                  <p
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      paid
                        ? 'text-success-soft-foreground'
                        : order.paymentStatus === 'Failed'
                          ? 'text-destructive'
                          : 'text-warning-soft-foreground'
                    }`}
                  >
                    <Banknote className="h-3.5 w-3.5 shrink-0" aria-hidden /> {paymentHint}
                  </p>

                  {/* Next step + contact shortcuts */}
                  {(nextStep || phone) && (
                    <div className="flex items-center gap-2 pt-0.5">
                      {nextStep && (
                        <Button
                          size="sm"
                          className="h-10 flex-1"
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(order._id, nextStep.status); }}
                        >
                          <nextStep.icon className="h-4 w-4 me-2" aria-hidden />
                          {nextStep.label}
                        </Button>
                      )}
                      {phone && (
                        <>
                          <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0">
                            <a
                              href={`tel:${phone}`}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={t('orders:detail.contact.call_aria', { name: customerName })}
                            >
                              <Phone className="h-4 w-4" aria-hidden />
                            </a>
                          </Button>
                          <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0">
                            <a
                              href={whatsappUrl(phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={t('orders:detail.contact.whatsapp_aria', { name: customerName })}
                            >
                              <MessageCircle className="h-4 w-4" aria-hidden />
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : effectiveView === 'table' ? (
        <DataTable<Order>
          columns={tableColumns}
          rows={orders}
          rowKey={(order) => order._id}
          onRowClick={(order) => navigate(`/dashboard/orders/${order._id}`)}
          selected={selected}
          onSelectedChange={setSelected}
          pagination={{ ...pagination, page }}
          onPageChange={setPage}
          sort={sort}
          onSortChange={(next) => { setSort(next); setPage(1); }}
        />
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            return (
              <Card
                key={order._id}
                className={`hover:shadow-md transition-shadow cursor-pointer group ${selected.has(order._id) ? 'border-primary/50 bg-primary/5' : ''}`}
                onClick={() => navigate(`/dashboard/orders/${order._id}`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selected.has(order._id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(order._id)}
                      className="h-4 w-4 rounded border-gray-300 flex-shrink-0"
                    />
                    {/* Order icon */}
                    <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-lg bg-muted flex-shrink-0">
                      <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      {(order.replacementOf || (order.replacementOrders && order.replacementOrders.length > 0)) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/orders/${order._id}/lifecycle`);
                          }}
                          className="mb-1.5 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30 dark:hover:bg-indigo-500/20 transition-colors"
                        >
                          {order.replacementOf ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5" />
                              {t('orders:list.replacement.label')}
                            </>
                          ) : (
                            <>
                              <GitBranch className="h-3.5 w-3.5" />
                              {order.replacementOrders!.length === 1
                                ? t('orders:list.replacement.has_replacements', { count: 1 })
                                : t('orders:list.replacement.has_replacements_plural', { count: order.replacementOrders!.length })}
                            </>
                          )}
                          <span className="opacity-70">{t('orders:list.replacement.view_timeline')}</span>
                        </button>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">
                          {displayOrderNumber(order.orderNumber, order._id)}
                        </p>
                        <Badge variant={statusVariant(order.status)} className="text-[10px] h-5">
                          {t(`common:status.${order.status}`, { defaultValue: order.status })}
                        </Badge>
                        <Badge variant={paymentVariant(order.paymentStatus)} className="text-[10px] h-5">
                          {t(`common:status.${order.paymentStatus}`, { defaultValue: order.paymentStatus })}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{order.user?.name || t('orders:list.guest')}</span>
                        {order.user?.email && <span className="hidden md:inline">{order.user.email}</span>}
                        <span>•</span>
                        <span>{order.products.length === 1 ? t('orders:list.item_count_one', { count: 1 }) : t('orders:list.item_count_other', { count: order.products.length })}</span>
                        <span>•</span>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="text-end">
                      <p className="text-lg font-bold tabular-nums">{formatPrice(order.totalAmount)}</p>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 opacity-100 transition md:opacity-0 md:group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>{t('orders:list.dropdown.actions')}</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/orders/${order._id}`); }}
                        >
                          <Eye className="me-2 h-4 w-4" /> {t('orders:list.dropdown.view_details')}
                        </DropdownMenuItem>
                        {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs">{t('orders:list.dropdown.update_status')}</DropdownMenuLabel>
                            {(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as OrderStatus[])
                              .filter((s) => s !== order.status)
                              .map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={(e) => { e.stopPropagation(); handleStatusChange(order._id, s); }}
                                >
                                  {t(`common:status.${s}`, { defaultValue: s })}
                                </DropdownMenuItem>
                              ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination (cards view — the table view's pagination is integrated in DataTable) */}
      {effectiveView !== 'table' && pagination.pages > 1 && !loading && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {t('common:pagination.showing', { from: ((page - 1) * pagination.limit) + 1, to: Math.min(page * pagination.limit, pagination.total), total: pagination.total })}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common:action.previous')}
            </Button>
            {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={page === p ? 'default' : 'outline'}
                size="sm"
                className="w-9"
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common:action.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
