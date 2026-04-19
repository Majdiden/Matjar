import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getTenantCurrency, getTenantLocale } from '../../lib/format';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { FilterPills } from '../../components/ui/filter-pills';
import {
  Search, Users, Eye, ChevronLeft, DollarSign, ShoppingCart, TrendingUp,
  Mail, Phone, Calendar, UserCheck, UserX, Download, Filter, X,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { toast } from 'sonner';
import { toCSV, downloadCSV } from '../../lib/utils';
import { useViewMode, ViewToggle } from '../../components/ui/view-toggle';

interface Customer {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  totalOrders?: number;
  totalSpent?: number;
}

interface CustomerOrder {
  _id: string;
  orderNumber?: string | number;
  status?: string;
  totalAmount?: number;
  createdAt: string;
}

interface CustomerDetail {
  customer: Customer;
  recentOrders: CustomerOrder[];
  stats: { totalOrders: number; totalSpent: number; avgOrderValue: number };
}

// Narrow thrown values from api-client. Errors may be the server's JSON
// body, a plain string, or an Axios error.
const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

interface CustomerListResponse {
  data: {
    customers: Customer[];
    pagination: { pages: number; total: number };
  };
}

type StatusTab = 'all' | 'active' | 'inactive';

// TAB_DEFS labels are resolved via t() at render time; keep the id as the key.
const TAB_IDS: { id: StatusTab; icon: React.ElementType }[] = [
  { id: 'all', icon: Users },
  { id: 'active', icon: UserCheck },
  { id: 'inactive', icon: UserX },
];

const formatPrice = (n: number) =>
  new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(n);

export default function Customers() {
  const { t } = useTranslation(['customers', 'common']);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<StatusTab>('all');
  const [stats, setStats] = useState({ total: 0, active: 0, totalSpent: 0, avgLtv: 0 });
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode('customers.viewMode', 'cards');

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === customers.length) setSelected(new Set());
    else setSelected(new Set(customers.map((c) => c._id)));
  };

  const handleBulkActivate = async (isActive: boolean) => {
    if (selected.size === 0) return;
    try {
      await Promise.all([...selected].map((id) =>
        api.patch(`/customers/${id}`, { isActive })
      ));
      if (isActive) {
        toast.success(t('customers.toast.bulk_activated', { count: selected.size }));
      } else {
        toast.success(t('customers.toast.bulk_deactivated', { count: selected.size }));
      }
      setSelected(new Set());
      fetchCustomers();
    } catch (err) {
      toast.error(errMsg(err, t('customers.toast.bulk_update_failed')));
    }
  };

  const handleBulkExport = () => {
    const all = customers.filter((c) => selected.has(c._id));
    if (all.length === 0) {
      toast.message(t('customers.toast.export_empty'));
      return;
    }
    const csv = toCSV(all, [
      { key: 'firstName', label: 'First name' },
      { key: 'lastName', label: 'Last name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'isActive', label: 'Status', get: (c) => (c.isActive === false ? 'inactive' : 'active') },
      { key: 'totalOrders', label: 'Orders', get: (c) => c.totalOrders ?? 0 },
      { key: 'totalSpent', label: 'Total spent', get: (c) => (c.totalSpent ?? 0).toFixed(2) },
      { key: 'createdAt', label: 'Joined', get: (c) => new Date(c.createdAt).toISOString().slice(0, 10) },
    ]);
    downloadCSV(csv, 'customers-selected');
    toast.success(t('customers.toast.exported', { count: all.length }));
  };

  const loadStats = async () => {
    try {
      const res = await api.get<CustomerListResponse>('/customers', { params: { page: 1, limit: 1000 } });
      const all: Customer[] = res.data.customers || [];
      const active = all.filter((c) => c.isActive !== false).length;
      const totalSpent = all.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
      const customersWithOrders = all.filter((c) => (c.totalOrders || 0) > 0).length;
      setStats({
        total: all.length,
        active,
        totalSpent,
        avgLtv: customersWithOrders > 0 ? totalSpent / customersWithOrders : 0,
      });
    } catch {
      // Non-fatal — the header stats strip just stays at its last values.
    }
  };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        limit: number;
        search?: string;
        isActive?: boolean;
      } = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (tab === 'active') params.isActive = true;
      if (tab === 'inactive') params.isActive = false;
      const res = await api.get<CustomerListResponse>('/customers', { params });
      setCustomers(res.data.customers);
      setTotalPages(res.data.pagination.pages);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error(errMsg(err, t('customers.toast.fetch_failed')));
    } finally {
      setLoading(false);
    }
  }, [page, search, tab]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { loadStats(); }, []);

  const viewCustomer = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get<{ data: CustomerDetail }>(`/customers/${id}`);
      setSelectedCustomer(res.data);
    } catch (err) {
      toast.error(errMsg(err, t('customers.toast.detail_failed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      // Pull all customers (capped at 5k) so the export reflects the full
      // dataset, not just the current page.
      const res = await api.get<CustomerListResponse>('/customers', { params: { page: 1, limit: 5000 } });
      const all: Customer[] = res.data?.customers || [];
      if (all.length === 0) {
        toast.message(t('customers.toast.export_empty'));
        return;
      }
      const csv = toCSV(all, [
        { key: 'firstName', label: 'First name' },
        { key: 'lastName', label: 'Last name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'isActive', label: 'Status', get: (c) => (c.isActive === false ? 'inactive' : 'active') },
        { key: 'totalOrders', label: 'Orders', get: (c) => c.totalOrders ?? 0 },
        { key: 'totalSpent', label: 'Total spent', get: (c) => (c.totalSpent ?? 0).toFixed(2) },
        { key: 'createdAt', label: 'Joined', get: (c) => new Date(c.createdAt).toISOString().slice(0, 10) },
      ]);
      downloadCSV(csv, 'customers');
      toast.success(t('customers.toast.exported', { count: all.length }));
    } catch (err) {
      toast.error(errMsg(err, t('customers.toast.export_failed')));
    }
  };

  const statCards = useMemo(
    () => [
      { label: t('customers.stat.total_customers'), value: stats.total.toLocaleString(), icon: Users, description: t('customers.stat.total_customers_desc') },
      { label: t('customers.stat.active'), value: stats.active.toLocaleString(), icon: UserCheck, description: t('customers.stat.active_desc') },
      { label: t('customers.stat.total_revenue'), value: formatPrice(stats.totalSpent), icon: DollarSign, description: t('customers.stat.total_revenue_desc') },
      { label: t('customers.stat.avg_ltv'), value: formatPrice(stats.avgLtv), icon: TrendingUp, description: t('customers.stat.avg_ltv_desc') },
    ],
    [stats, t]
  );

  // ── Customer detail view ──────────────────────────────────────────────
  if (selectedCustomer) {
    const { customer, recentOrders, stats: detailStats } = selectedCustomer;
    const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
    const initials = (customer.firstName?.[0] || customer.email[0]).toUpperCase();

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedCustomer(null)}>
            <ChevronLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t('customers.detail.back')}
          </Button>
        </div>

        {/* Profile header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-muted text-foreground text-2xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
                  <Badge variant={customer.isActive !== false ? 'default' : 'destructive'}>
                    {customer.isActive !== false ? t('customers.status.active') : t('customers.status.inactive')}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>
                  {customer.phone && (
                    <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> {t('customers.detail.joined', { date: new Date(customer.createdAt).toLocaleDateString() })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detail stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: t('customers.detail.stat.total_orders'), value: detailStats.totalOrders, icon: ShoppingCart },
            { label: t('customers.detail.stat.total_spent'), value: formatPrice(detailStats.totalSpent || 0), icon: DollarSign },
            { label: t('customers.detail.stat.avg_order_value'), value: formatPrice(detailStats.avgOrderValue || 0), icon: TrendingUp },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent orders */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{t('customers.detail.section.orders.title')}</h3>
              <span className="text-xs text-muted-foreground">{t('customers.detail.section.orders.count', { count: recentOrders.length })}</span>
            </div>
            {recentOrders.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">{t('customers.detail.section.orders.empty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentOrders.map((order) => (
                  <Link
                    key={order._id}
                    to={`/dashboard/orders/${order._id}`}
                    className="flex items-center justify-between py-3 -mx-2 px-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-semibold group-hover:text-primary">
                        #{order.orderNumber ? String(order.orderNumber).replace(/^#+/, '') : order._id.slice(-8)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary">{t(`common.status.${order.status}`, { ns: 'common', defaultValue: order.status })}</Badge>
                      <span className="text-sm font-semibold tabular-nums">{formatPrice(order.totalAmount || 0)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Customer list view ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('customers.list.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('customers.list.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 me-2" /> {t('common:action.export')}
          </Button>
        </div>
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
        items={TAB_IDS.map((tab) => ({ id: tab.id, label: t(`customers.list.filter.${tab.id}`), icon: tab.icon }))}
        value={tab}
        onChange={(v) => { setTab(v as StatusTab); setPage(1); }}
      />

      {/* Search + filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('customers.list.search_placeholder')}
            className="ps-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 me-2" /> {t('common:action.filter')}
        </Button>
        <div className="ml-auto">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{t('customers.bulk.selected', { count: selected.size })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 me-1.5" />{t('customers.bulk.clear')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkActivate(true)}>
              <UserCheck className="h-3.5 w-3.5 me-1.5" />{t('customers.bulk.activate')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkActivate(false)}>
              <UserX className="h-3.5 w-3.5 me-1.5" />{t('customers.bulk.deactivate')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkExport}>
              <Download className="h-3.5 w-3.5 me-1.5" />{t('customers.bulk.export')}
            </Button>
          </div>
        </div>
      )}

      {/* Customer rows */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : customers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t('customers.list.empty.title')}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {t('customers.list.empty.description')}
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
                    checked={selected.size === customers.length && customers.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead className="w-[180px]">{t('customers.list.column.name')}</TableHead>
                <TableHead className="w-[140px]">{t('customers.list.column.email')}</TableHead>
                <TableHead className="text-center w-[120px]">{t('customers.list.column.orders')}</TableHead>
                <TableHead className="w-[140px]">{t('customers.list.column.total_spent')}</TableHead>
                <TableHead className="w-[120px]">{t('customers.list.column.status')}</TableHead>
                <TableHead className="w-[120px]">{t('customers.list.column.joined')}</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;
                const initials = (c.firstName?.[0] || c.email[0]).toUpperCase();
                const isSel = selected.has(c._id);
                return (
                  <TableRow
                    key={c._id}
                    className={`cursor-pointer ${isSel ? 'bg-primary/5' : ''}`}
                    onClick={() => viewCustomer(c._id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSelect(c._id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm truncate" title={fullName}>{fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-0">
                      <span className="block truncate" title={c.email}>{c.email}</span>
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{c.totalOrders ?? 0}</TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatPrice(c.totalSpent ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.isActive !== false ? 'default' : 'destructive'}
                        className="text-[10px] h-5"
                      >
                        {c.isActive !== false ? t('customers.status.active') : t('customers.status.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); viewCustomer(c._id); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-3 px-4 py-1 text-xs uppercase tracking-wider font-medium text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === customers.length && customers.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>{t('customers.list.select_all')}</span>
          </label>
          {customers.map((c) => {
            const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;
            const initials = (c.firstName?.[0] || c.email[0]).toUpperCase();
            const isSel = selected.has(c._id);
            return (
              <Card
                key={c._id}
                className={`hover:shadow-md transition-shadow cursor-pointer group ${isSel ? 'border-primary/50 bg-primary/5' : ''}`}
                onClick={() => viewCustomer(c._id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(c._id)}
                      className="h-4 w-4 rounded border-gray-300 flex-shrink-0"
                    />
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-muted text-foreground font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{fullName}</p>
                        <Badge
                          variant={c.isActive !== false ? 'default' : 'destructive'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {c.isActive !== false ? t('customers.status.active') : t('customers.status.inactive')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" /> {c.email}
                        </span>
                        {c.phone && (
                          <span className="hidden sm:flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:flex flex-col items-end text-end">
                      <span className="text-xs text-muted-foreground">{t('customers.list.column.joined')}</span>
                      <span className="text-sm font-medium">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 opacity-0 group-hover:opacity-100 transition"
                      onClick={(e) => { e.stopPropagation(); viewCustomer(c._id); }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {t('customers.list.showing', { count: customers.length, total })}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common:action.previous')}
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
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
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('common:action.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
