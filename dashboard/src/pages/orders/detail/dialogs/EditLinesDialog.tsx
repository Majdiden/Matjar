import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';
import { Search, X, Loader2, Package } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { formatPrice } from '../../../../lib/format';
import { errMsg } from '../../../../lib/errors';
import { toast } from 'sonner';
import type { OrderItem, Product, ProductVariant } from '../../../../types';
import { useOrderDetail } from '../context';

// ─── Edit order lines (audit 5.3) ─────────────────────────────────────
// Scoped line-item editor for a PLACED order. Reuses OrderCreate's
// line-picker pattern (product search → add, per-line qty + unit price +
// variant, remove). Server-guarded to unpaid + unfulfilled +
// Pending/Confirmed; the button that opens this only renders when the same
// guard passes client-side. Totals (incl. tax) recompute server-side.

interface EditLine {
  productId: string;
  name: string;
  sku?: string;
  image?: string;
  basePrice: number;
  hasVariants: boolean;
  variants: ProductVariant[];
  variantId: string;
  quantity: number;
  price: string;
}

const variantLabel = (v: ProductVariant) =>
  (v.optionValues || []).map((o) => o.value).join(' / ') || v.sku || '';

const variantUnitPrice = (v: ProductVariant | undefined, base: number) =>
  v && typeof v.price === 'number' && v.price >= 0 ? v.price : base;

export const EditLinesDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const { t } = useTranslation(['orders', 'common']);
  const { order, reload } = useOrderDetail();

  const [lines, setLines] = useState<EditLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Seed the line set from the order's snapshot each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && order) {
      setLines(
        (order.products || []).map((item: OrderItem) => {
          const p = typeof item.product === 'object' ? item.product : null;
          return {
            productId: typeof item.product === 'string' ? item.product : item.product?._id || '',
            name: p?.name || item.name || 'Product',
            sku: item.sku || p?.sku,
            image: item.image,
            basePrice: Number(item.price) || 0,
            hasVariants: Boolean(item.variantId),
            variants: p?.variants || [],
            variantId: item.variantId ? String(item.variantId) : '',
            quantity: Number(item.quantity) || 1,
            price: String(item.price ?? 0),
          };
        })
      );
      setProductQuery('');
      setProductResults([]);
      setDropdownOpen(false);
    }
  }

  // Debounced product search.
  useEffect(() => {
    if (!open || !productQuery.trim()) { setProductResults([]); return; }
    const handle = setTimeout(async () => {
      try {
        setProductSearching(true);
        const res = await api.products.getAll({ search: productQuery.trim(), limit: 8 }) as {
          responseObject?: { data?: Product[] };
        };
        setProductResults(res?.responseObject?.data || []);
        setDropdownOpen(true);
      } catch {
        setProductResults([]);
      } finally {
        setProductSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [productQuery, open]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const addProduct = (p: Product) => {
    const firstVariant = (p.variants || [])[0];
    const unit = p.hasVariants ? variantUnitPrice(firstVariant, p.price) : p.price;
    setLines((prev) => [
      ...prev,
      {
        productId: p._id,
        name: p.name,
        sku: p.sku,
        image: Array.isArray(p.images) ? p.images[0] : undefined,
        basePrice: p.price,
        hasVariants: Boolean(p.hasVariants),
        variants: p.variants || [],
        variantId: p.hasVariants && firstVariant?._id ? String(firstVariant._id) : '',
        quantity: 1,
        price: String(unit ?? 0),
      },
    ]);
    setProductQuery('');
    setProductResults([]);
    setDropdownOpen(false);
  };

  const updateLine = (idx: number, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const changeVariant = (idx: number, variantId: string) =>
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const v = l.variants.find((x) => String(x._id) === variantId);
      return { ...l, variantId, price: String(variantUnitPrice(v, l.basePrice)) };
    }));

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.price) || 0) * (l.quantity || 0), 0),
    [lines]
  );

  const save = async () => {
    if (!order) return;
    if (lines.length === 0) {
      toast.error(t('orders:detail.edit_items.error_no_lines'));
      return;
    }
    try {
      setSaving(true);
      await api.orders.editLines(order._id, {
        items: lines.map((l) => ({
          productId: l.productId,
          ...(l.variantId ? { variantId: l.variantId } : {}),
          quantity: l.quantity,
          price: Number(l.price) || 0,
        })),
      });
      toast.success(t('orders:detail.edit_items.success'));
      onOpenChange(false);
      await reload();
    } catch (err: unknown) {
      toast.error(errMsg(err, t('orders:detail.edit_items.failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('orders:detail.edit_items.title')}</DialogTitle>
          <DialogDescription>{t('orders:detail.edit_items.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product search */}
          <div className="relative" ref={boxRef}>
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('orders:create.product_search_placeholder')}
              className="ps-9"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              onFocus={() => { if (productResults.length > 0) setDropdownOpen(true); }}
            />
            {dropdownOpen && (productSearching || productResults.length > 0 || productQuery.trim()) && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
                {productSearching ? (
                  <div className="p-3 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : productResults.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">{t('orders:create.no_products_found')}</div>
                ) : (
                  productResults.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-start hover:bg-muted"
                      onClick={() => addProduct(p)}
                    >
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover" />}
                      <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatPrice(p.price)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Lines */}
          {lines.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">
              {t('orders:detail.edit_items.empty')}
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {lines.map((line, idx) => (
                <div key={`${line.productId}-${idx}`} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-3 flex-1 min-w-40">
                    {line.image
                      ? <img src={line.image} alt="" className="h-10 w-10 rounded object-cover" />
                      : <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{line.name}</p>
                      {line.sku && <p className="text-xs text-muted-foreground">{line.sku}</p>}
                    </div>
                  </div>
                  {line.hasVariants && line.variants.length > 0 && (
                    <div className="w-40">
                      <Select
                        label={t('orders:create.line.variant')}
                        className="h-9"
                        value={line.variantId}
                        onValueChange={(v) => changeVariant(idx, v)}
                        options={line.variants.map((v) => ({ value: String(v._id), label: variantLabel(v) }))}
                      />
                    </div>
                  )}
                  <div className="w-20">
                    <Label className="text-xs text-muted-foreground" htmlFor={`edit-qty-${idx}`}>{t('orders:create.line.qty')}</Label>
                    <Input
                      id={`edit-qty-${idx}`}
                      type="number"
                      min={1}
                      className="h-9"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs text-muted-foreground" htmlFor={`edit-price-${idx}`}>{t('orders:create.line.unit_price')}</Label>
                    <Input
                      id={`edit-price-${idx}`}
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-9"
                      value={line.price}
                      onChange={(e) => updateLine(idx, { price: e.target.value })}
                    />
                  </div>
                  <div className="w-24 text-end pb-2">
                    <p className="text-xs text-muted-foreground">{t('orders:create.line.total')}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatPrice((Number(line.price) || 0) * line.quantity)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive"
                    onClick={() => removeLine(idx)}
                    aria-label={t('common:action.remove')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-muted-foreground">{t('orders:create.summary.subtotal')}</span>
            <span className="tabular-nums font-medium">{formatPrice(subtotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t('orders:detail.edit_items.recompute_hint')}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common:action.cancel')}
          </Button>
          <Button onClick={save} disabled={saving || lines.length === 0}>
            {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t('orders:detail.edit_items.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
