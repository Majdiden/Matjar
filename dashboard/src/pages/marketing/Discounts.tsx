import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Tag, Pencil, ShoppingBag, Percent, Truck, ChevronRight, Search, X, CheckCircle2, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { FilterPills } from "../../components/ui/filter-pills";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "../../components/ui/use-confirm";
import { useViewMode, ViewToggle } from "../../components/ui/view-toggle";

type DiscountMethod =
  | "amount_off_products"
  | "amount_off_order"
  | "buy_x_get_y"
  | "free_shipping";

const METHOD_ICONS: Record<DiscountMethod, React.ElementType> = {
  amount_off_products: Tag,
  buy_x_get_y: ShoppingBag,
  amount_off_order: Percent,
  free_shipping: Truck,
};

type DiscountKind = "product" | "order" | "shipping";

interface Discount {
  _id: string;
  code: string;
  type: "percentage" | "fixed";
  kind?: DiscountKind;
  value: number;
  isActive: boolean;
  usageLimit?: number;
  usedCount?: number;
  expiresAt?: string;
  combinesWith?: { product?: boolean; order?: boolean; shipping?: boolean };
}

type StatusTab = 'all' | 'active' | 'inactive';

export default function Discounts() {
  const { t } = useTranslation(['marketing', 'common']);
  const navigate = useNavigate();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<StatusTab>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode('discounts.viewMode', 'table');
  const confirm = useConfirm();

  const METHOD_OPTIONS: {
    method: DiscountMethod;
    label: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    {
      method: "amount_off_products",
      label: t('marketing.discount.method.amount_off_products'),
      description: t('marketing.discount.method.amount_off_products_desc'),
      icon: Tag,
    },
    {
      method: "buy_x_get_y",
      label: t('marketing.discount.method.buy_x_get_y'),
      description: t('marketing.discount.method.buy_x_get_y_desc'),
      icon: ShoppingBag,
    },
    {
      method: "amount_off_order",
      label: t('marketing.discount.method.amount_off_order'),
      description: t('marketing.discount.method.amount_off_order_desc'),
      icon: Percent,
    },
    {
      method: "free_shipping",
      label: t('marketing.discount.method.free_shipping'),
      description: t('marketing.discount.method.free_shipping_desc'),
      icon: Truck,
    },
  ];

  const openPicker = () => setPickerOpen(true);
  const selectMethod = (method: DiscountMethod) => {
    setPickerOpen(false);
    navigate(`/dashboard/marketing/discounts/new?method=${method}`);
  };

  const fetchDiscounts = useCallback(async () => {
    try {
      setLoading(true);
      const params: { page: number; limit: number; search?: string; status?: string } = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (tab !== 'all') params.status = tab;
      const response = await api.discounts.getAll(params) as {
        data?: { items?: Discount[]; pages?: number; total?: number };
      };
      const data = response?.data ?? {};
      setDiscounts(data.items || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('marketing.discount.toast.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [page, search, tab, t]);

  useEffect(() => { fetchDiscounts(); }, [fetchDiscounts]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === discounts.length) setSelected(new Set());
    else setSelected(new Set(discounts.map((d) => d._id)));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!(await confirm({
      title: t('marketing.discount.list.bulk_delete_title', { count: selected.size }),
      description: t('marketing.discount.list.bulk_delete_description'),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => api.discounts.delete(id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(t('marketing.discount.toast.bulk_deleted', { count: ok }));
    if (failed) toast.error(t('marketing.discount.toast.bulk_failed', { count: failed }));
    setSelected(new Set());
    fetchDiscounts();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: t('marketing.discount.list.delete_title'),
      description: t('marketing.discount.list.delete_description'),
      confirmText: t('common:action.delete'),
      variant: "destructive",
    }))) return;
    try {
      await api.discounts.delete(id);
      toast.success(t('marketing.discount.toast.deleted'));
      setDiscounts(prev => prev.filter(d => d._id !== id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('marketing.discount.toast.delete_failed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('marketing.discount.list.title')}</h1>
          <p className="text-muted-foreground">{t('marketing.discount.list.subtitle')}</p>
        </div>
        <Button onClick={openPicker}>
          <Plus className="h-4 w-4 mr-2" />
          {t('marketing.discount.list.create_button')}
        </Button>
      </div>

      <FilterPills
        items={[
          { id: 'all', label: t('marketing.discount.list.filter.all'), icon: Tag },
          { id: 'active', label: t('marketing.discount.list.filter.active'), icon: CheckCircle2 },
          { id: 'inactive', label: t('marketing.discount.list.filter.inactive'), icon: Circle },
        ]}
        value={tab}
        onChange={(v) => { setTab(v as StatusTab); setPage(1); }}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('marketing.discount.list.search_placeholder')}
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
          <p className="text-sm font-medium">{t('marketing.discount.list.selected_count', { count: selected.size })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 mr-1.5" />{t('common:action.cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />{t('common:action.delete')}
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {total > 0
              ? t('marketing.discount.list.card_title_count', { count: total })
              : t('marketing.discount.list.card_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : discounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">{t('marketing.discount.list.empty_title')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('marketing.discount.list.empty_subtitle')}
              </p>
              <Button onClick={openPicker}>
                <Plus className="h-4 w-4 mr-2" />{t('marketing.discount.list.create_button')}
              </Button>
            </div>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={selected.size === discounts.length && discounts.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>{t('marketing.discount.list.column.code')}</TableHead>
                  <TableHead>{t('marketing.discount.list.column.applies_to')}</TableHead>
                  <TableHead>{t('marketing.discount.list.column.type')}</TableHead>
                  <TableHead>{t('marketing.discount.list.column.value')}</TableHead>
                  <TableHead>{t('marketing.discount.list.column.usage')}</TableHead>
                  <TableHead>{t('marketing.discount.list.column.combines')}</TableHead>
                  <TableHead>{t('marketing.discount.list.column.status')}</TableHead>
                  <TableHead>{t('marketing.discount.list.column.expires')}</TableHead>
                  <TableHead className="text-right">{t('marketing.discount.list.column.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.map(d => {
                  const combines = (["product", "order", "shipping"] as const)
                    .filter((k) => d.combinesWith?.[k]);
                  return (
                    <TableRow key={d._id} className={selected.has(d._id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(d._id)}
                          onChange={() => toggleSelect(d._id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{d.code}</TableCell>
                      <TableCell className="capitalize">{d.kind || "order"}</TableCell>
                      <TableCell className="capitalize">{d.type}</TableCell>
                      <TableCell className="font-medium">
                        {d.type === "percentage" ? `${d.value}%` : `$${d.value}`}
                      </TableCell>
                      <TableCell>
                        {d.usedCount || 0}{d.usageLimit ? ` / ${d.usageLimit}` : ''}
                      </TableCell>
                      <TableCell>
                        {combines.length === 0 ? (
                          <span className="text-xs text-muted-foreground">{t('marketing.discount.list.column.combines_none')}</span>
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {combines.map((k) => (
                              <Badge key={k} variant="outline" className="text-xs capitalize">{k}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.isActive ? "default" : "secondary"}>
                          {d.isActive ? t('marketing.discount.list.filter.active') : t('marketing.discount.list.filter.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.expiresAt ? t('marketing.discount.list.expires_on', { date: new Date(d.expiresAt).toLocaleDateString() }) : t('marketing.discount.list.expires_never')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/dashboard/marketing/discounts/${d._id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(d._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {discounts.map((d) => {
                const isSel = selected.has(d._id);
                const combines = (["product", "order", "shipping"] as const)
                  .filter((k) => d.combinesWith?.[k]);
                const usageText = `${d.usedCount || 0}${d.usageLimit ? ` / ${d.usageLimit}` : ''}`;
                return (
                  <Card
                    key={d._id}
                    className={`hover:shadow-md transition-shadow ${isSel ? 'border-primary/50 bg-primary/5' : ''}`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(d._id)}
                          className="h-4 w-4 rounded border-gray-300 flex-shrink-0 mt-1"
                        />
                        <Badge variant={d.isActive ? "default" : "secondary"}>
                          {d.isActive ? t('marketing.discount.list.filter.active') : t('marketing.discount.list.filter.inactive')}
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono font-semibold truncate">{d.code}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">
                          {d.kind || 'order'} · {d.type}
                        </p>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('marketing.discount.list.card_value_label')}</p>
                          <p className="text-xl font-bold tabular-nums">
                            {d.type === 'percentage' ? `${d.value}%` : `$${d.value}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('marketing.discount.list.card_uses_label')}</p>
                          <p className="text-sm text-muted-foreground tabular-nums">{usageText}</p>
                        </div>
                      </div>
                      {combines.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {combines.map((k) => (
                            <Badge key={k} variant="outline" className="text-xs capitalize">{k}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {d.expiresAt
                            ? t('marketing.discount.list.expires_on', { date: new Date(d.expiresAt).toLocaleDateString() })
                            : t('marketing.discount.list.expires_never')}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => navigate(`/dashboard/marketing/discounts/${d._id}/edit`)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(d._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t('common:pagination.page_of', { n: page, total: totalPages })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('common:action.previous')}</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('common:action.next')}</Button>
          </div>
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('marketing.discount.picker.title')}</DialogTitle>
            <DialogDescription>
              {t('marketing.discount.picker.subtitle')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {METHOD_OPTIONS.map(({ method, label, description, icon: Icon }) => (
              <button
                key={method}
                type="button"
                onClick={() => selectMethod(method)}
                className="w-full flex items-center gap-3 rounded-lg border border-border p-4 text-left transition hover:border-primary hover:bg-accent/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{label}</div>
                  <div className="text-sm text-muted-foreground">{description}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
