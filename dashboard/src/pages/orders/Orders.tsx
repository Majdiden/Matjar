import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getTenantCurrency, getTenantLocale } from '../../lib/format';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { FilterPills } from '../../components/ui/filter-pills';
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
  RefreshCw, GitBranch, LayoutGrid, List, Pin, PinOff, X,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { toCSV, downloadCSV } from '../../lib/utils';
import type { Order, OrderItem, OrderStatus, PaginatedResponse } from '../../types';

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
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(price);

// Stored order numbers already include a leading "#" (e.g. "#1042"), so we
// strip it before re-prefixing in the UI to avoid rendering "##1042".
const displayOrderNumber = (orderNumber?: string | null, fallbackId?: string) => {
  if (orderNumber) return `#${String(orderNumber).replace(/^#+/, '')}`;
  return fallbackId ? `#${fallbackId.slice(-8)}` : '';
};

type StatusTab = '' | 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

// TAB_DEFS labels are resolved inside the component using t()
const TAB_DEFS_META: { id: StatusTab; icon: React.ElementType; labelKey: string }[] = [
  { id: '', labelKey: 'orders.list.filter.all', icon: ShoppingCart },
  { id: 'Pending', labelKey: 'orders.list.filter.pending', icon: Clock },
  { id: 'Processing', labelKey: 'orders.list.filter.processing', icon: PackageIcon },
  { id: 'Shipped', labelKey: 'orders.list.filter.shipped', icon: Truck },
  { id: 'Delivered', labelKey: 'orders.list.filter.delivered', icon: CheckCircle2 },
  { id: 'Cancelled', labelKey: 'orders.list.filter.cancelled', icon: XCircle },
];

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'Delivered': return 'default';
    case 'Shipped':
    case 'Processing': return 'secondary';
    case 'Pending': return 'outline';
    case 'Cancelled': return 'destructive';
    default: return 'outline';
  }
};

type ViewMode = 'cards' | 'table';
const VIEW_PREF_KEY = 'orders.viewMode';

const paymentVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'Paid': return 'default';
    case 'Failed':
    case 'Refunded': return 'destructive';
    case 'Not Paid': return 'outline';
    default: return 'secondary';
  }
};

export const Orders: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<StatusTab>('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [stats, setStats] = useState({ total: 0, pending: 0, revenue: 0, delivered: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'cards';
    return (localStorage.getItem(VIEW_PREF_KEY) as ViewMode) || 'cards';
  });
  const [defaultView, setDefaultView] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'cards';
    return (localStorage.getItem(VIEW_PREF_KEY) as ViewMode) || 'cards';
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o._id)));
  };

  const handleBulkStatus = async (status: OrderStatus) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => api.orders.updateStatus(id, status)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(ok === 1 ? t('orders:list.bulk.selected', { count: ok }) + ` → ${status}` : t('orders:toast.bulk_marked_plural', { count: ok, status }));
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

  const setAsDefault = () => {
    localStorage.setItem(VIEW_PREF_KEY, viewMode);
    setDefaultView(viewMode);
    toast.success(t('orders:toast.view_set_default', { view: viewMode === 'cards' ? t('orders:list.view.cards') : t('orders:list.view.table') }));
  };

  // loadOrders / loadStats are stable closures over setters — redeclaring
  // them on each render would cause the effect to loop. We intentionally
  // only re-fetch on the paging/filter inputs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadOrders(); }, [page, tab, search]);
  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const res = await api.orders.getAll({ page: 1, limit: 1000 }) as PaginatedResponse<Order>;
      const all: Order[] = (res.responseObject.orders as Order[] | undefined) || [];
      setStats({
        total: res.responseObject.pagination?.total || all.length,
        pending: all.filter((o) => o.status === 'Pending' || o.status === 'Processing').length,
        revenue: all.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        delivered: all.filter((o) => o.status === 'Delivered').length,
      });
    } catch {
      // Non-fatal — stats surface as zeroes if the endpoint is offline.
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params: OrdersListParams = { page, limit: 20 };
      if (tab) params.status = tab;
      if (search) params.search = search;
      const response = await api.orders.getAll(params) as PaginatedResponse<Order>;
      setOrders((response.responseObject.orders as Order[] | undefined) || []);
      if (response.responseObject.pagination) setPagination(response.responseObject.pagination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.load_failed'));
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
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.status_update_failed'));
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.orders.getAll({ page: 1, limit: 5000 }) as PaginatedResponse<Order>;
      const all: Order[] = (res.responseObject.orders as Order[] | undefined) || [];
      if (all.length === 0) {
        toast.message(t('orders:toast.no_orders_to_export'));
        return;
      }
      const csv = toCSV(all as OrderForExport[], [
        { key: 'orderNumber', label: 'Order #' },
        { key: 'createdAt', label: 'Date', get: (o: OrderForExport) => o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : '' },
        { key: 'customer', label: 'Customer', get: (o: OrderForExport) => o.customer?.name || `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() || o.customerEmail || 'Guest' },
        { key: 'customerEmail', label: 'Email', get: (o: OrderForExport) => o.customer?.email || o.customerEmail || '' },
        { key: 'status', label: 'Status' },
        { key: 'paymentStatus', label: 'Payment status' },
        { key: 'paymentMethod', label: 'Payment method' },
        { key: 'itemCount', label: 'Items', get: (o: OrderForExport) => (o.products || []).reduce((s: number, p: OrderItem) => s + (p.quantity || 0), 0) },
        { key: 'subtotal', label: 'Subtotal', get: (o: OrderForExport) => (o.subtotal ?? 0).toFixed(2) },
        { key: 'shippingCost', label: 'Shipping', get: (o: OrderForExport) => (o.shippingCost ?? 0).toFixed(2) },
        { key: 'tax', label: 'Tax', get: (o: OrderForExport) => (o.tax ?? 0).toFixed(2) },
        { key: 'discount', label: 'Discount', get: (o: OrderForExport) => (o.discount ?? 0).toFixed(2) },
        { key: 'totalAmount', label: 'Total', get: (o: OrderForExport) => (o.totalAmount ?? 0).toFixed(2) },
      ]);
      downloadCSV(csv, 'orders');
      toast.success(all.length === 1 ? t('orders:toast.export_success', { count: all.length }) : t('orders:toast.export_success_plural', { count: all.length }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.export_failed'));
    }
  };

  const statCards = useMemo(
    () => [
      { label: t('orders:list.stat.total_orders'), value: stats.total.toLocaleString(), icon: ShoppingCart, description: t('orders:list.stat.all_time') },
      { label: t('orders:list.stat.pending'), value: stats.pending.toLocaleString(), icon: Clock, description: t('orders:list.stat.awaiting_fulfillment') },
      { label: t('orders:list.stat.delivered'), value: stats.delivered.toLocaleString(), icon: CheckCircle2, description: t('orders:list.stat.completed_orders') },
      { label: t('orders:list.stat.total_revenue'), value: formatPrice(stats.revenue), icon: DollarSign, description: t('orders:list.stat.gross_sales') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, t]
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('orders:list.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('orders:list.description')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" /> {t('common:action.export')}
        </Button>
      </div>

      {/* Stat strip */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter pills */}
      <FilterPills
        items={TAB_DEFS_META.map((td) => ({ id: td.id || 'all', label: t(td.labelKey as Parameters<typeof t>[0]), icon: td.icon }))}
        value={tab || 'all'}
        onChange={(v) => { setTab(v === 'all' ? '' : (v as StatusTab)); setPage(1); }}
      />

      {/* Search row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('orders:list.search.placeholder')}
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" /> {t('common:action.filter')}
        </Button>
        <div className="ml-auto flex items-center gap-2">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={setAsDefault}
            disabled={viewMode === defaultView}
            title={viewMode === defaultView ? t('orders:list.view.is_default') : t('orders:list.view.set_as', { mode: viewMode })}
          >
            {viewMode === defaultView ? (
              <><Pin className="h-3.5 w-3.5 mr-1.5" /> {t('orders:list.view.default')}</>
            ) : (
              <><PinOff className="h-3.5 w-3.5 mr-1.5" /> {t('orders:list.view.set_default')}</>
            )}
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{t('orders:list.bulk.selected', { count: selected.size })}</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 mr-1.5" />{t('orders:list.bulk.clear')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('Processing')}>
              <PackageIcon className="h-3.5 w-3.5 mr-1.5" />{t('orders:list.bulk.mark_processing')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('Shipped')}>
              <Truck className="h-3.5 w-3.5 mr-1.5" />{t('orders:list.bulk.mark_shipped')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('Delivered')}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />{t('orders:list.bulk.mark_delivered')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />{t('orders:list.bulk.export_csv')}
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
              {tab || search ? t('orders:list.empty.filtered_title') : t('orders:list.empty.title')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {tab || search
                ? t('orders:list.empty.filtered_description')
                : t('orders:list.empty.description')}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    checked={selected.size === orders.length && orders.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead className="w-[120px]">{t('orders:list.column.order')}</TableHead>
                <TableHead>{t('orders:list.column.customer')}</TableHead>
                <TableHead>{t('orders:list.column.date')}</TableHead>
                <TableHead className="text-center">{t('orders:list.column.items')}</TableHead>
                <TableHead>{t('orders:list.column.status')}</TableHead>
                <TableHead>{t('orders:list.column.payment')}</TableHead>
                <TableHead className="text-right">{t('orders:list.column.total')}</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order._id}
                  className={`cursor-pointer ${selected.has(order._id) ? 'bg-primary/5' : ''}`}
                  onClick={() => navigate(`/dashboard/orders/${order._id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(order._id)}
                      onChange={() => toggleSelect(order._id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    <div className="flex items-center gap-2">
                      <span>{displayOrderNumber(order.orderNumber, order._id)}</span>
                      {(order.replacementOf || (order.replacementOrders && order.replacementOrders.length > 0)) && (
                        <span
                          className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30"
                          title={order.replacementOf ? 'Replacement order' : `Has ${order.replacementOrders!.length} replacement(s)`}
                        >
                          <GitBranch className="h-3 w-3" />
                          {order.replacementOf ? 'Replacement' : `${order.replacementOrders!.length}×`}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{order.user?.name || t('orders:list.guest')}</span>
                      {order.user?.email && (
                        <span className="text-xs text-muted-foreground">{order.user.email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {order.products.length}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(order.status)} className="text-[10px] h-5">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentVariant(order.paymentStatus)} className="text-[10px] h-5">
                      {order.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatPrice(order.totalAmount)}
                  </TableCell>
                  <TableCell>
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
                          <Eye className="mr-2 h-4 w-4" /> {t('orders:list.dropdown.view_details')}
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
                                  {s}
                                </DropdownMenuItem>
                              ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            return (
              <Card
                key={order._id}
                className={`hover:shadow-md transition-shadow cursor-pointer group ${selected.has(order._id) ? 'border-primary/50 bg-primary/5' : ''}`}
                onClick={() => navigate(`/dashboard/orders/${order._id}`)}
              >
                <CardContent className="p-4">
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
                          {order.status}
                        </Badge>
                        <Badge variant={paymentVariant(order.paymentStatus)} className="text-[10px] h-5">
                          {order.paymentStatus}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{order.user?.name || t('orders:list.guest')}</span>
                        {order.user?.email && <span className="hidden md:inline">{order.user.email}</span>}
                        <span>•</span>
                        <span>{order.products.length === 1 ? t('orders:list.item_count_one', { count: 1 }) : t('orders:list.item_count_other', { count: order.products.length })}</span>
                        <span>•</span>
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums">{formatPrice(order.totalAmount)}</p>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 opacity-0 group-hover:opacity-100 transition"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>{t('orders:list.dropdown.actions')}</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/orders/${order._id}`); }}
                        >
                          <Eye className="mr-2 h-4 w-4" /> {t('orders:list.dropdown.view_details')}
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
                                  {s}
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

      {/* Pagination */}
      {pagination.pages > 1 && !loading && (
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
