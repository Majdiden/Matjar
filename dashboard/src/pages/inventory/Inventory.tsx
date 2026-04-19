import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getTenantCurrency, getTenantLocale } from '../../lib/format';
import { api } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { FilterPills } from '../../components/ui/filter-pills';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Package, AlertTriangle, Plus, Minus, Search, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { toCSV, downloadCSV } from '../../lib/utils';
import { useViewMode, ViewToggle } from '../../components/ui/view-toggle';

interface InventoryItem {
  _id: string;
  product: { _id: string; name: string; price: number; stock: number; hasVariants?: boolean; variantCount?: number };
  stock: number;
  hasVariants?: boolean;
  variantCount?: number;
  lowStockThreshold?: number;
  updatedAt: string;
}

const formatPrice = (n: number) => new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(n);

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

interface InventoryQuery {
  page: number;
  limit: number;
  search?: string;
}

export default function Inventory() {
  const { t } = useTranslation(['inventory', 'common']);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tab, setTab] = useState('all');
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode('inventory.viewMode', 'table');

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'low') {
        const res = (await api.inventory.getLowStock(10)) as {
          data: { items?: InventoryItem[] };
        };
        setLowStockItems(res.data.items || []);
      } else {
        const params: InventoryQuery = { page, limit: 20 };
        if (search.trim()) params.search = search.trim();
        const res = (await api.inventory.getAll(params)) as {
          data: {
            inventories?: InventoryItem[];
            pagination?: { pages?: number };
          };
        };
        setItems(res.data.inventories || []);
        setTotalPages(res.data.pagination?.pages || 1);
      }
    } catch (err) {
      toast.error(errMsg(err, t('inventory.toast.fetch_failed')));
    } finally {
      setLoading(false);
    }
  }, [page, tab, search, t]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const handleAdjust = async (productId: string) => {
    const val = parseInt(adjustValue);
    if (isNaN(val) || val === 0) return;
    try {
      await api.inventory.adjustStock(productId, val);
      toast.success(t('inventory.toast.adjusted', { delta: `${val > 0 ? '+' : ''}${val}` }));
      setAdjusting(null);
      setAdjustValue('');
      fetchInventory();
    } catch (err) {
      toast.error(errMsg(err, t('inventory.toast.adjust_failed')));
    }
  };

  const displayItems = tab === 'low' ? lowStockItems : items;

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === displayItems.length) setSelected(new Set());
    else setSelected(new Set(displayItems.map(i => i._id)));
  };

  const handleBulkExport = () => {
    const all = displayItems.filter(i => selected.has(i._id));
    if (all.length === 0) {
      toast.message(t('inventory.action.no_export'));
      return;
    }
    const csv = toCSV<InventoryItem>(all, [
        { key: 'name', label: 'Product', get: (i) => i.product?.name || '' },
        { key: 'price', label: 'Price', get: (i) => (i.product?.price ?? 0).toFixed(2) },
        { key: 'stock', label: 'Stock', get: (i) => i.stock },
        { key: 'threshold', label: 'Low-stock threshold', get: (i) => i.lowStockThreshold ?? 10 },
        { key: 'updatedAt', label: 'Updated', get: (i) => new Date(i.updatedAt).toISOString().slice(0, 10) },
      ]);
    downloadCSV(csv, 'inventory-selected');
    toast.success(t('inventory.toast.exported', { count: all.length }));
  };

  const stockVariant = (stock: number, threshold: number = 10): "default" | "secondary" | "destructive" => {
    if (stock === 0) return 'destructive';
    if (stock <= threshold) return 'secondary';
    return 'default';
  };

  const stockLabel = (stock: number, threshold: number = 10) => {
    if (stock === 0) return t('inventory.stock_status.out_of_stock');
    if (stock <= threshold) return t('inventory.stock_status.low_stock');
    return t('inventory.stock_status.in_stock');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('inventory.list.title')}</h1>
        <p className="text-muted-foreground">{t('inventory.list.subtitle')}</p>
      </div>

      <FilterPills
        items={[
          { id: 'all', label: t('inventory.list.filter.all'), icon: Package },
          { id: 'low', label: t('inventory.list.filter.low'), icon: AlertTriangle },
        ]}
        value={tab}
        onChange={(v) => { setTab(v); setPage(1); }}
      />

      <div className="flex items-center gap-3">
        {tab === 'all' && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('inventory.list.search_placeholder')}
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        )}
        <div className="ml-auto">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{t('inventory.list.selected_count', { count: selected.size })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 mr-1.5" />{t('common:action.cancel')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />{t('inventory.action.export_csv')}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {tab === 'low' ? t('inventory.list.card_title_low') : t('inventory.list.card_title_all')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : displayItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">{tab === 'low' ? t('inventory.list.empty_no_low') : t('inventory.list.empty_no_inventory')}</h3>
                </div>
              ) : viewMode === 'table' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <input
                          type="checkbox"
                          checked={selected.size === displayItems.length && displayItems.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>{t('inventory.column.product')}</TableHead>
                      <TableHead className="text-right">{t('inventory.column.price')}</TableHead>
                      <TableHead className="text-right">{t('inventory.column.stock')}</TableHead>
                      <TableHead>{t('inventory.column.status')}</TableHead>
                      <TableHead>{t('inventory.column.last_updated')}</TableHead>
                      <TableHead className="text-right">{t('inventory.column.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayItems.map(item => {
                      const hasVariants = !!(item.hasVariants ?? item.product?.hasVariants);
                      const variantCount = item.variantCount ?? item.product?.variantCount ?? 0;
                      return (
                      <TableRow key={item._id} className={selected.has(item._id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selected.has(item._id)}
                            onChange={() => toggleSelect(item._id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.product?.name || 'Unknown'}
                          {hasVariants && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {variantCount === 1
                                ? t('inventory.variant_count', { count: variantCount })
                                : t('inventory.variant_count_plural', { count: variantCount })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatPrice(item.product?.price || 0)}</TableCell>
                        <TableCell className="text-right font-mono">{item.stock}</TableCell>
                        <TableCell>
                          <Badge variant={stockVariant(item.stock, item.lowStockThreshold)}>
                            {stockLabel(item.stock, item.lowStockThreshold)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasVariants ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => window.location.assign(`/dashboard/products/${item.product._id}/edit`)}
                            >
                              {t('inventory.action.edit_variants')}
                            </Button>
                          ) : adjusting === item.product?._id ? (
                            <div className="flex items-center justify-end gap-2">
                              <Input
                                type="number"
                                className="w-20 h-8 text-sm"
                                placeholder={t('inventory.adjust.placeholder')}
                                value={adjustValue}
                                onChange={e => setAdjustValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAdjust(item.product._id)}
                                autoFocus
                              />
                              <Button size="sm" className="h-8" onClick={() => handleAdjust(item.product._id)}>{t('common:action.save')}</Button>
                              <Button variant="outline" size="sm" className="h-8" onClick={() => { setAdjusting(null); setAdjustValue(''); }}>{t('common:action.cancel')}</Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="h-8" onClick={() => { setAdjusting(item.product?._id); setAdjustValue(''); }}>
                              <Plus className="h-3 w-3" /><Minus className="h-3 w-3" /> {t('inventory.action.adjust')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );})}
                  </TableBody>
                </Table>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayItems.map((item) => {
                    const hasVariants = !!(item.hasVariants ?? item.product?.hasVariants);
                    const variantCount = item.variantCount ?? item.product?.variantCount ?? 0;
                    const isSel = selected.has(item._id);
                    const isLow = item.stock > 0 && item.stock <= (item.lowStockThreshold ?? 10);
                    return (
                      <Card key={item._id} className={`${isSel ? 'border-primary/50 bg-primary/5' : ''}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggleSelect(item._id)}
                              className="h-4 w-4 rounded border-gray-300 flex-shrink-0 mt-1"
                            />
                            <Badge variant={stockVariant(item.stock, item.lowStockThreshold)}>
                              {stockLabel(item.stock, item.lowStockThreshold)}
                            </Badge>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{item.product?.name || 'Unknown'}</p>
                            {hasVariants && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {variantCount === 1
                                  ? t('inventory.variant_count', { count: variantCount })
                                  : t('inventory.variant_count_plural', { count: variantCount })}
                              </p>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('inventory.card_on_hand_label')}</p>
                              <p className="text-xl font-bold tabular-nums">{item.stock}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('inventory.card_price_label')}</p>
                              <p className="text-sm text-muted-foreground tabular-nums">{formatPrice(item.product?.price || 0)}</p>
                            </div>
                          </div>
                          {isLow && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" /> {t('inventory.alert.low_stock')}
                            </div>
                          )}
                          <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                            <span>{t('inventory.card_updated', { date: new Date(item.updatedAt).toLocaleDateString() })}</span>
                            {hasVariants ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() => window.location.assign(`/dashboard/products/${item.product._id}/edit`)}
                              >
                                {t('inventory.action.edit_variants')}
                              </Button>
                            ) : adjusting === item.product?._id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  className="w-16 h-7 text-xs"
                                  placeholder={t('inventory.adjust.placeholder')}
                                  value={adjustValue}
                                  onChange={e => setAdjustValue(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleAdjust(item.product._id)}
                                  autoFocus
                                />
                                <Button size="sm" className="h-7 px-2" onClick={() => handleAdjust(item.product._id)}>{t('common:action.save')}</Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7" onClick={() => { setAdjusting(item.product?._id); setAdjustValue(''); }}>
                                <Plus className="h-3 w-3" /><Minus className="h-3 w-3" /> {t('inventory.action.adjust')}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {tab === 'all' && totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">{t('common:pagination.page_of', { n: page, total: totalPages })}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('common:action.previous')}</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('common:action.next')}</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
