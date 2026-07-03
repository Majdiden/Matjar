import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../components/ui/card';
import { PageHeader } from '../../components/PageHeader';
import { errMsg } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { useListPage } from '../../hooks/useListPage';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { FilterPills } from '../../components/ui/filter-pills';
import {
  Truck, Package, Search, X, CheckCircle2, Clock, PackageCheck, XCircle, Inbox,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useViewMode, ViewToggle } from '../../components/ui/view-toggle';

interface Fulfillment {
  _id: string;
  order: string | { _id: string; orderNumber?: string };
  status: string;
  lineItems: Array<{
    product: string;
    name?: string;
    quantity: number;
  }>;
  trackingNumber?: string;
  carrier?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

// Semantic status colours (audit 3.8.3): success=green, warning=amber,
// destructive=red, info=neutral gray. Brand blue is never used for status.
const statusVariant = (status: string) => {
  switch (status) {
    case 'delivered': return 'success' as const;
    case 'shipped': return 'info' as const;
    case 'in_progress': return 'info' as const;
    case 'pending': return 'warning' as const;
    case 'cancelled': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

export const Fulfillments: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode('fulfillments.viewMode', 'table');

  const {
    items: fulfillments,
    setItems: setFulfillments,
    loading,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilter,
    pagination,
    reload,
  } = useListPage<Fulfillment, { status: string }>({
    initialFilters: { status: '' },
    fetcher: async ({ page, limit, search, filters }) => {
      const params: { page: number; limit: number; status?: string; search?: string } = {
        page,
        limit,
      };
      if (filters.status) params.status = filters.status;
      if (search) params.search = search;
      const res = (await api.fulfillments.getAll(params)) as {
        responseObject?: {
          fulfillments?: Fulfillment[];
          pagination?: { total: number; pages: number };
        };
        data?: {
          fulfillments?: Fulfillment[];
          pagination?: { total: number; pages: number };
        };
      };
      return {
        items: res.responseObject?.fulfillments || res.data?.fulfillments || [],
        pagination: res.responseObject?.pagination || res.data?.pagination || { total: 0, pages: 1 },
      };
    },
    onError: (err) => toast.error(errMsg(err, t('orders:fulfillment.toast.load_failed'))),
  });

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await api.fulfillments.updateStatus(id, newStatus);
      toast.success(t('orders:fulfillment.toast.status_updated'));
      setFulfillments(prev => prev.map(f => f._id === id ? { ...f, status: newStatus } : f));
    } catch (err) {
      toast.error(errMsg(err, t('orders:fulfillment.toast.status_update_failed')));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === fulfillments.length) setSelected(new Set());
    else setSelected(new Set(fulfillments.map(f => f._id)));
  };

  const handleBulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map(id => api.fulfillments.updateStatus(id, status)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(t('orders:fulfillment.toast.bulk_updated_other', { count: ok, status }));
    if (failed) toast.error(t('orders:fulfillment.toast.bulk_failed', { count: failed }));
    setSelected(new Set());
    reload();
  };

  const getOrderNumber = (order: Fulfillment['order']) => {
    if (typeof order === 'string') return order.slice(0, 8);
    return order.orderNumber || order._id.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('orders:fulfillment.list.title')}
        description={t('orders:fulfillment.list.description')}
      />

      <FilterPills
        items={[
          { id: '', label: t('orders:fulfillment.list.filter.all'), icon: Inbox },
          { id: 'pending', label: t('orders:fulfillment.list.filter.pending'), icon: Clock },
          { id: 'shipped', label: t('orders:fulfillment.list.filter.shipped'), icon: Truck },
          { id: 'delivered', label: t('orders:fulfillment.list.filter.delivered'), icon: CheckCircle2 },
          { id: 'cancelled', label: t('orders:fulfillment.list.filter.cancelled'), icon: XCircle },
        ]}
        value={filters.status}
        onChange={(v) => setFilter('status', v)}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('orders:fulfillment.list.search.placeholder')}
            className="ps-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ms-auto">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{t('orders:fulfillment.list.bulk.selected', { count: selected.size })}</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 me-1.5" />{t('orders:fulfillment.list.bulk.clear')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('shipped')}>
              <Truck className="h-3.5 w-3.5 me-1.5" />{t('orders:fulfillment.list.bulk.mark_shipped')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('delivered')}>
              <PackageCheck className="h-3.5 w-3.5 me-1.5" />{t('orders:fulfillment.list.bulk.mark_delivered')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('cancelled')}>
              <XCircle className="h-3.5 w-3.5 me-1.5" />{t('orders:fulfillment.list.bulk.cancel')}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : fulfillments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t('orders:fulfillment.list.empty.title')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('orders:fulfillment.list.empty.description')}
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
                    checked={selected.size === fulfillments.length && fulfillments.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>{t('orders:fulfillment.list.column.order')}</TableHead>
                <TableHead>{t('orders:fulfillment.list.column.items')}</TableHead>
                <TableHead>{t('orders:fulfillment.list.column.status')}</TableHead>
                <TableHead>{t('orders:fulfillment.list.column.tracking')}</TableHead>
                <TableHead>{t('orders:fulfillment.list.column.carrier')}</TableHead>
                <TableHead>{t('orders:fulfillment.list.column.date')}</TableHead>
                <TableHead className="text-end">{t('orders:fulfillment.list.column.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fulfillments.map((f) => (
                <TableRow key={f._id} className={selected.has(f._id) ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(f._id)}
                      onChange={() => toggleSelect(f._id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    #{getOrderNumber(f.order)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {f.lineItems.length === 1
                          ? t('orders:fulfillment.list.item_count_one', { count: f.lineItems.length })
                          : t('orders:fulfillment.list.item_count_other', { count: f.lineItems.length })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(f.status)}>
                      {f.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {f.trackingNumber || '-'}
                  </TableCell>
                  <TableCell>{f.carrier || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(f.createdAt)}
                  </TableCell>
                  <TableCell className="text-end">
                    {f.status !== 'delivered' && f.status !== 'cancelled' && (
                      <Select
                        value={f.status}
                        onChange={(e) => handleStatusUpdate(f._id, e.target.value)}
                        options={[
                          { value: 'pending', label: t('orders:fulfillment.list.filter.pending') },
                          { value: 'shipped', label: t('orders:fulfillment.list.filter.shipped') },
                          { value: 'delivered', label: t('orders:fulfillment.list.filter.delivered') },
                          { value: 'cancelled', label: t('orders:fulfillment.list.filter.cancelled') },
                        ]}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fulfillments.map((f) => {
            const isSel = selected.has(f._id);
            return (
              <Card
                key={f._id}
                className={`hover:shadow-md transition-shadow ${isSel ? 'border-primary/50 bg-primary/5' : ''}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleSelect(f._id)}
                      className="h-4 w-4 rounded border-gray-300 flex-shrink-0 mt-1"
                    />
                    <Badge variant={statusVariant(f.status)}>
                      {f.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono font-semibold truncate">#{getOrderNumber(f.order)}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Package className="h-3.5 w-3.5" />
                      <span>
                        {f.lineItems.length === 1
                          ? t('orders:fulfillment.list.item_count_one', { count: f.lineItems.length })
                          : t('orders:fulfillment.list.item_count_other', { count: f.lineItems.length })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('orders:fulfillment.list.card.tracking')}</span>
                      <span className="font-mono truncate ms-2">{f.trackingNumber || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('orders:fulfillment.list.card.carrier')}</span>
                      <span className="truncate ms-2">{f.carrier || '—'}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(f.createdAt)}</span>
                    {f.status !== 'delivered' && f.status !== 'cancelled' && (
                      <Select
                        value={f.status}
                        onChange={(e) => handleStatusUpdate(f._id, e.target.value)}
                        options={[
                          { value: 'pending', label: t('orders:fulfillment.list.filter.pending') },
                          { value: 'shipped', label: t('orders:fulfillment.list.filter.shipped') },
                          { value: 'delivered', label: t('orders:fulfillment.list.filter.delivered') },
                          { value: 'cancelled', label: t('orders:fulfillment.list.filter.cancelled') },
                        ]}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pagination.pages > 1 && !loading && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {t('orders:fulfillment.list.pagination.page_of', { page, pages: pagination.pages })}
            {pagination.total > 0 && <> {t('orders:fulfillment.list.pagination.total', { total: pagination.total })}</>}
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
