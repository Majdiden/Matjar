import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Tag, Pencil, ShoppingBag, Percent, Truck, ChevronRight, Search, X, CheckCircle2, Circle } from "lucide-react";
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

const METHOD_OPTIONS: {
  method: DiscountMethod;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    method: "amount_off_products",
    label: "Amount off products",
    description: "Discount specific products or collections of products.",
    icon: Tag,
  },
  {
    method: "buy_x_get_y",
    label: "Buy X get Y",
    description: "Give a discounted item when customers buy qualifying items.",
    icon: ShoppingBag,
  },
  {
    method: "amount_off_order",
    label: "Amount off order",
    description: "Discount the total order amount.",
    icon: Percent,
  },
  {
    method: "free_shipping",
    label: "Free shipping",
    description: "Offer free shipping on an order.",
    icon: Truck,
  },
];

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
      toast.error(e?.message || "Failed to load discounts");
    } finally {
      setLoading(false);
    }
  }, [page, search, tab]);

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
      title: `Delete ${selected.size} discount${selected.size === 1 ? '' : 's'}?`,
      description: 'Customers will no longer be able to redeem these codes.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => api.discounts.delete(id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(`${ok} deleted`);
    if (failed) toast.error(`${failed} failed`);
    setSelected(new Set());
    fetchDiscounts();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: "Delete this discount?",
      description: "Customers will no longer be able to redeem this code.",
      confirmText: "Delete",
      variant: "destructive",
    }))) return;
    try {
      await api.discounts.delete(id);
      toast.success("Discount deleted");
      setDiscounts(prev => prev.filter(d => d._id !== id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || "Failed to delete discount");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discounts</h1>
          <p className="text-muted-foreground">Create, edit, and combine discount codes</p>
        </div>
        <Button onClick={openPicker}>
          <Plus className="h-4 w-4 mr-2" />
          Create discount
        </Button>
      </div>

      <FilterPills
        items={[
          { id: 'all', label: 'All', icon: Tag },
          { id: 'active', label: 'Active', icon: CheckCircle2 },
          { id: 'inactive', label: 'Inactive', icon: Circle },
        ]}
        value={tab}
        onChange={(v) => { setTab(v as StatusTab); setPage(1); }}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code or description..."
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 mr-1.5" />Clear
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All discounts{total > 0 && ` (${total})`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : discounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No discounts</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create discount codes to offer promotions.
              </p>
              <Button onClick={openPicker}>
                <Plus className="h-4 w-4 mr-2" />Create discount
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
                  <TableHead>Code</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Combines</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                          <span className="text-xs text-muted-foreground">None</span>
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
                          {d.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : 'Never'}
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
                          {d.isActive ? "Active" : "Inactive"}
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
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</p>
                          <p className="text-xl font-bold tabular-nums">
                            {d.type === 'percentage' ? `${d.value}%` : `$${d.value}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Uses</p>
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
                          {d.expiresAt ? `Expires ${new Date(d.expiresAt).toLocaleDateString()}` : 'No expiry'}
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
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select discount type</DialogTitle>
            <DialogDescription>
              Choose the kind of discount you want to create.
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
