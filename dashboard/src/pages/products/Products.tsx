import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/format';
import { errMsg } from '../../lib/errors';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { FilterPills } from '../../components/ui/filter-pills';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Plus, Package, Search, Edit, Trash2, MoreHorizontal, Image as ImageIcon,
  TrendingUp, AlertTriangle, Archive, CheckCircle2, Star, Filter, Download,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { toCSV, downloadCSV } from '../../lib/utils';
import type { Product, Category, PaginatedResponse } from '../../types';
import { useConfirm } from '../../components/ui/use-confirm';
import { useViewMode, ViewToggle } from '../../components/ui/view-toggle';

// Shape of the stats roll-up API call — same endpoint as the list, but
// read differently. Narrowed so the `as PaginatedResponse<Product>`
// cast isn't needed for the smaller helpers.
interface ProductListResponseShape {
  responseObject?: {
    data?: Product[];
    pagination?: { total: number };
  };
}

type StatusTab = 'all' | 'active' | 'draft' | 'archived' | 'low-stock';

export const Products: React.FC = () => {
  const { t } = useTranslation(['products', 'common']);
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [tab, setTab] = useState<StatusTab>('all');
  const [stats, setStats] = useState({ total: 0, active: 0, draft: 0, lowStock: 0, value: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode('products.viewMode', 'cards');
  const confirm = useConfirm();

  const TAB_DEFS: { id: StatusTab; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: t('products.list.filter.all'), icon: Package },
    { id: 'active', label: t('products.list.filter.active'), icon: CheckCircle2 },
    { id: 'draft', label: t('products.list.filter.drafts'), icon: Edit },
    { id: 'low-stock', label: t('products.list.filter.low_stock'), icon: AlertTriangle },
    { id: 'archived', label: t('products.list.filter.archived'), icon: Archive },
  ];

  useEffect(() => { loadProducts();
    // loadProducts is redeclared each render and depends on these three
    // state fields — adding it to deps would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm, tab]);
  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const res = (await api.products.getAll({ page: 1, limit: 1000 })) as ProductListResponseShape;
      const all: Product[] = res?.responseObject?.data || [];
      setStats({
        total: res?.responseObject?.pagination?.total || all.length,
        active: all.filter((p) => p.status === 'active').length,
        draft: all.filter((p) => p.status === 'draft').length,
        lowStock: all.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) < 10).length,
        value: all.reduce((sum: number, p) => sum + (p.price || 0) * (p.stock || 0), 0),
      });
    } catch {
      // Silent — stats are non-critical and shown as zeros in that case.
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params: { page: number; limit: number; search?: string; status?: string } = {
        page, limit: 20, search: searchTerm || undefined,
      };
      if (tab === 'active' || tab === 'draft' || tab === 'archived') params.status = tab;
      const response = await api.products.getAll(params) as PaginatedResponse<Product>;
      let list = (response.responseObject.data as Product[] | undefined) || [];
      if (tab === 'low-stock') list = list.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) < 10);
      setProducts(list);
      if (response.responseObject.pagination) setPagination(response.responseObject.pagination);
    } catch (err: unknown) {
      toast.error(errMsg(err, t('products.toast.load_failed')));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirm({
      title: t('products.confirm.delete.title', { name }),
      description: t('products.confirm.delete.description'),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await api.products.delete(id);
      toast.success(t('products.toast.deleted', { name }));
      loadProducts();
      loadStats();
    } catch (err: unknown) {
      toast.error(errMsg(err, t('products.toast.delete_failed')));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!(await confirm({
      title: t('products.confirm.delete.title_bulk', { count: selected.size }),
      description: t('products.confirm.delete.description_bulk'),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await Promise.all([...selected].map((id) => api.products.delete(id)));
      toast.success(t('products.toast.deleted_bulk', { count: selected.size }));
      setSelected(new Set());
      loadProducts();
      loadStats();
    } catch (err: unknown) {
      toast.error(errMsg(err, t('products.toast.bulk_delete_failed')));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p._id)));
  };

  const handleExport = async () => {
    try {
      const res = (await api.products.getAll({ page: 1, limit: 5000 })) as ProductListResponseShape;
      const all: Product[] = res?.responseObject?.data || [];
      if (all.length === 0) {
        toast.message(t('products.toast.export_empty'));
        return;
      }
      const csv = toCSV(all, [
        { key: 'name', label: 'Name' },
        { key: 'slug', label: 'Slug' },
        { key: 'sku', label: 'SKU' },
        { key: 'price', label: 'Price', get: (p: Product) => (p.price ?? 0).toFixed(2) },
        { key: 'compareAtPrice', label: 'Compare-at price', get: (p: Product) => (p.compareAtPrice != null ? Number(p.compareAtPrice).toFixed(2) : '') },
        { key: 'stock', label: 'Stock', get: (p: Product) => p.stock ?? 0 },
        { key: 'status', label: 'Status' },
        {
          key: 'category',
          label: 'Category',
          // `category` may be a populated Category object or a raw id
          // string depending on the endpoint's populate level.
          get: (p: Product) => {
            const c = p.category;
            if (typeof c === 'object' && c && 'name' in c) return (c as Category).name;
            return typeof c === 'string' ? c : '';
          },
        },
        { key: 'createdAt', label: 'Created', get: (p: Product) => p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '' },
      ]);
      downloadCSV(csv, 'products');
      toast.success(t('products.toast.exported', { count: all.length }));
    } catch (err: unknown) {
      toast.error(errMsg(err, t('products.toast.export_failed')));
    }
  };

  const statCards = useMemo(() => [
    { label: t('products.list.stat.total_products'), value: stats.total.toLocaleString(), icon: Package, description: t('products.list.stat.total_description') },
    { label: t('products.list.stat.active'), value: stats.active.toLocaleString(), icon: CheckCircle2, description: t('products.list.stat.active_description') },
    { label: t('products.list.stat.low_stock'), value: stats.lowStock.toLocaleString(), icon: AlertTriangle, description: t('products.list.stat.low_stock_description') },
    { label: t('products.list.stat.inventory_value'), value: formatPrice(stats.value), icon: TrendingUp, description: t('products.list.stat.inventory_value_description') },
  ], [stats, t]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('products.list.title')}
        description={t('products.list.subtitle')}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 me-2" />{t('common:action.export')}
            </Button>
            <Button asChild>
              <Link to="/dashboard/products/new">
                <Plus className="h-4 w-4 me-2" />{t('products.list.new_product')}
              </Link>
            </Button>
          </>
        )}
      />

      {/* Stat strip */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} description={s.description} />
        ))}
      </div>

      {/* Filter pills */}
      <FilterPills
        items={TAB_DEFS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
        value={tab}
        onChange={(v) => { setTab(v as StatusTab); setPage(1); }}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('products.list.search_placeholder')}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="ps-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 me-2" />{t('products.list.more_filters')}
        </Button>
        <div className="ml-auto">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{t('products.list.selected_count', { count: selected.size })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>{t('products.bulk.clear')}</Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5 me-1.5" />{t('common:action.delete')}
            </Button>
          </div>
        </div>
      )}

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-1">{searchTerm ? t('products.list.empty.title_search') : t('products.list.empty.title')}</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              {searchTerm
                ? t('products.list.empty.description_search')
                : t('products.list.empty.description')}
            </p>
            {!searchTerm && (
              <Button asChild size="lg">
                <Link to="/dashboard/products/new">
                  <Plus className="h-4 w-4 me-2" />{t('products.list.empty.action')}
                </Link>
              </Button>
            )}
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
                    checked={selected.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>{t('products.list.column.product')}</TableHead>
                <TableHead>{t('products.list.column.sku')}</TableHead>
                <TableHead>{t('products.list.column.category')}</TableHead>
                <TableHead>{t('products.list.column.status')}</TableHead>
                <TableHead className="text-end">{t('products.list.column.price')}</TableHead>
                <TableHead>{t('products.list.column.stock')}</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isSelected = selected.has(product._id);
                const stock = product.stock || 0;
                const stockVariant: 'destructive' | 'secondary' | 'outline' =
                  stock === 0 ? 'destructive' : stock < 10 ? 'secondary' : 'outline';
                return (
                  <TableRow
                    key={product._id}
                    className={`cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
                    onClick={() => navigate(`/dashboard/products/${product._id}/edit`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(product._id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0 border">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="h-full w-full object-contain p-0.5" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          {product.featured && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1 mt-0.5">
                              <Star className="h-2.5 w-2.5" />{t('common:state.featured')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{product.sku || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {product.category && typeof product.category === 'object'
                        ? (product.category as Category).name
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.status === 'active' ? 'default'
                          : product.status === 'draft' ? 'secondary'
                          : 'outline'
                        }
                        className="text-[10px] h-5"
                      >
                        {t(`common:status.${product.status}`, { defaultValue: product.status })}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {formatPrice(product.price)}
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <div className="text-xs text-muted-foreground line-through font-normal">
                          {formatPrice(product.compareAtPrice)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stockVariant} className="font-normal">
                        {stock === 0 ? t('products.list.stock_badge.out_of_stock') : `${stock}`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/products/${product._id}/edit`); }}>
                            <Edit className="me-2 h-4 w-4" />{t('common:action.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(product._id, product.name); }}
                          >
                            <Trash2 className="me-2 h-4 w-4" />{t('common:action.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Select all */}
          <label className="flex items-center gap-3 px-4 py-2 text-xs uppercase tracking-wider font-medium text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === products.length && products.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>{t('products.list.select_all')}</span>
          </label>

          {products.map((product) => {
            const isSelected = selected.has(product._id);
            const stock = product.stock || 0;
            const stockVariant: 'destructive' | 'secondary' | 'outline' =
              stock === 0 ? 'destructive' : stock < 10 ? 'secondary' : 'outline';
            return (
              <div
                key={product._id}
                onClick={() => navigate(`/dashboard/products/${product._id}/edit`)}
                className={`group relative flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm transition cursor-pointer ${
                  isSelected ? 'border-primary/50 bg-primary/5' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(product._id)}
                  className="h-4 w-4 rounded border-gray-300 flex-shrink-0"
                />

                {/* Image */}
                <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0 border">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{product.name}</p>
                    {product.featured && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1">
                        <Star className="h-2.5 w-2.5" />{t('common:state.featured')}
                      </Badge>
                    )}
                    <Badge
                      variant={
                        product.status === 'active' ? 'default'
                        : product.status === 'draft' ? 'secondary'
                        : 'outline'
                      }
                      className="text-[10px] h-5"
                    >
                      {t(`common:status.${product.status}`, { defaultValue: product.status })}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {product.sku && <span className="font-mono">{product.sku}</span>}
                    {product.category && typeof product.category === 'object' && (
                      <span className="truncate">· {(product.category as Category).name}</span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="text-end hidden sm:block">
                  <p className="font-semibold">{formatPrice(product.price)}</p>
                  {product.compareAtPrice && product.compareAtPrice > product.price && (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatPrice(product.compareAtPrice)}
                    </p>
                  )}
                </div>

                {/* Stock badge */}
                <div className="hidden md:block">
                  <Badge variant={stockVariant} className="font-normal">
                    {stock === 0 ? t('products.list.stock_badge.out_of_stock') : t('products.list.stock_badge.in_stock', { count: stock })}
                  </Badge>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/products/${product._id}/edit`); }}>
                      <Edit className="me-2 h-4 w-4" />{t('common:action.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDelete(product._id, product.name); }}
                    >
                      <Trash2 className="me-2 h-4 w-4" />{t('common:action.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {t('common:pagination.showing', { from: ((page - 1) * pagination.limit) + 1, to: Math.min(page * pagination.limit, pagination.total), total: pagination.total })}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              {t('common:action.previous')}
            </Button>
            {Array.from({ length: Math.min(5, pagination.pages) }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="sm"
                  className="w-9"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page === pagination.pages} onClick={() => setPage((p) => p + 1)}>
              {t('common:action.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
