import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
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

const statusVariant = (status: string) => {
  switch (status) {
    case 'delivered': return 'default' as const;
    case 'shipped': return 'default' as const;
    case 'in_progress': return 'secondary' as const;
    case 'pending': return 'outline' as const;
    case 'cancelled': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

export const Fulfillments: React.FC = () => {
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode('fulfillments.viewMode', 'table');

  const loadFulfillments = useCallback(async () => {
    try {
      setLoading(true);
      const params: { page: number; limit: number; status?: string; search?: string } = {
        page,
        limit: 20,
      };
      if (statusFilter) params.status = statusFilter;
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
      setFulfillments(res.responseObject?.fulfillments || res.data?.fulfillments || []);
      setPagination(res.responseObject?.pagination || res.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to load fulfillments');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadFulfillments();
  }, [loadFulfillments]);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await api.fulfillments.updateStatus(id, newStatus);
      toast.success('Fulfillment status updated');
      setFulfillments(prev => prev.map(f => f._id === id ? { ...f, status: newStatus } : f));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to update status');
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
    if (ok) toast.success(`${ok} fulfillment${ok === 1 ? '' : 's'} updated to ${status}`);
    if (failed) toast.error(`${failed} failed`);
    setSelected(new Set());
    loadFulfillments();
  };

  const getOrderNumber = (order: Fulfillment['order']) => {
    if (typeof order === 'string') return order.slice(0, 8);
    return order.orderNumber || order._id.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fulfillments</h1>
        <p className="text-muted-foreground mt-1">Track and manage order fulfillments</p>
      </div>

      <FilterPills
        items={[
          { id: '', label: 'All', icon: Inbox },
          { id: 'pending', label: 'Pending', icon: Clock },
          { id: 'shipped', label: 'Shipped', icon: Truck },
          { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
          { id: 'cancelled', label: 'Cancelled', icon: XCircle },
        ]}
        value={statusFilter}
        onChange={(v) => { setStatusFilter(v); setPage(1); }}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tracking, carrier, or order..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="ml-auto">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 mr-1.5" />Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('shipped')}>
              <Truck className="h-3.5 w-3.5 mr-1.5" />Mark shipped
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('delivered')}>
              <PackageCheck className="h-3.5 w-3.5 mr-1.5" />Mark delivered
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus('cancelled')}>
              <XCircle className="h-3.5 w-3.5 mr-1.5" />Cancel
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
            <h3 className="text-lg font-semibold">No fulfillments</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Fulfillments will appear here when orders are processed.
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
                <TableHead>Order</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                      <span>{f.lineItems.length} item{f.lineItems.length !== 1 ? 's' : ''}</span>
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
                    {new Date(f.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {f.status !== 'delivered' && f.status !== 'cancelled' && (
                      <Select
                        value={f.status}
                        onChange={(e) => handleStatusUpdate(f._id, e.target.value)}
                        options={[
                          { value: 'pending', label: 'Pending' },
                          { value: 'shipped', label: 'Shipped' },
                          { value: 'delivered', label: 'Delivered' },
                          { value: 'cancelled', label: 'Cancelled' },
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
                      <span>{f.lineItems.length} item{f.lineItems.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tracking</span>
                      <span className="font-mono truncate ml-2">{f.trackingNumber || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Carrier</span>
                      <span className="truncate ml-2">{f.carrier || '—'}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                    {f.status !== 'delivered' && f.status !== 'cancelled' && (
                      <Select
                        value={f.status}
                        onChange={(e) => handleStatusUpdate(f._id, e.target.value)}
                        options={[
                          { value: 'pending', label: 'Pending' },
                          { value: 'shipped', label: 'Shipped' },
                          { value: 'delivered', label: 'Delivered' },
                          { value: 'cancelled', label: 'Cancelled' },
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
            Page <span className="font-medium text-foreground">{page}</span> of{' '}
            <span className="font-medium text-foreground">{pagination.pages}</span>
            {pagination.total > 0 && <> · {pagination.total} total</>}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
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
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
