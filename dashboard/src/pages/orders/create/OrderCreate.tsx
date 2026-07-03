import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select } from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { PageHeader } from '../../../components/PageHeader';
import {
  ArrowLeft, Search, X, Loader2, Package, User as UserIcon, MapPin, Truck,
  Tag as TagIcon, FileText,
} from 'lucide-react';
import { api, type DraftOrderPayload } from '../../../lib/api-client';
import { formatPrice } from '../../../lib/format';
import { errMsg } from '../../../lib/errors';
import { toast } from 'sonner';
import type { Order, OrderItem, Product, ProductVariant, Address } from '../../../types';

// ─── Local state shapes ───────────────────────────────────────────────

interface DraftLine {
  productId: string;
  name: string;
  sku?: string;
  image?: string;
  basePrice: number;
  hasVariants: boolean;
  variants: ProductVariant[];
  variantId: string;
  quantity: number;
  /** Editable unit price (string so the input can be cleared mid-edit). */
  price: string;
}

interface CustomerHit {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface ShippingRateOption {
  id: string;
  label: string;
  price: number;
}

const EMPTY_ADDRESS: Address = {
  firstName: '', lastName: '', addressLine1: '', addressLine2: '',
  city: '', state: '', postalCode: '', country: '', phone: '',
};

const customerLabel = (c: CustomerHit) =>
  c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c._id;

const variantLabel = (v: ProductVariant) =>
  (v.optionValues || []).map((o) => o.value).join(' / ') || v.sku || '';

const variantUnitPrice = (v: ProductVariant | undefined, base: number) =>
  v && typeof v.price === 'number' && v.price >= 0 ? v.price : base;

// Backend zone shape (GET /store-settings/shipping/zones).
interface ShippingZone {
  _id?: string;
  name?: string;
  rates?: Array<{ _id?: string; name?: string; price?: number }>;
}

// ─── Page ─────────────────────────────────────────────────────────────

export const OrderCreate: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Edit mode: /dashboard/orders/new?draft=<orderId> loads an existing
  // draft and saves through PUT /orders/:id/draft (wholesale replace).
  const draftId = searchParams.get('draft');

  const [initialLoading, setInitialLoading] = useState(Boolean(draftId));
  const [saving, setSaving] = useState(false);

  // Lines
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productBoxRef = useRef<HTMLDivElement | null>(null);

  // Customer
  const [customerMode, setCustomerMode] = useState<'existing' | 'guest'>('existing');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerHit[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null);
  const [guest, setGuest] = useState({ email: '', firstName: '', lastName: '', phone: '' });
  const customerBoxRef = useRef<HTMLDivElement | null>(null);

  // Addresses
  const [shippingAddress, setShippingAddress] = useState<Address>({ ...EMPTY_ADDRESS });
  const [billingSame, setBillingSame] = useState(true);
  const [billingAddress, setBillingAddress] = useState<Address>({ ...EMPTY_ADDRESS });

  // Shipping — configured rate (from the store's shipping zones) or custom.
  const [rateOptions, setRateOptions] = useState<ShippingRateOption[]>([]);
  const [shippingChoice, setShippingChoice] = useState<string>('none'); // none | custom | rate:<id>
  const [customShippingName, setCustomShippingName] = useState('');
  const [customShippingPrice, setCustomShippingPrice] = useState('');

  // Manual discount (NOT a discount code)
  const [discountType, setDiscountType] = useState<'' | 'amount' | 'percentage'>('');
  const [discountValue, setDiscountValue] = useState('');

  // Note + tags
  const [note, setNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // ── Configured shipping rates (best-effort: staff without settings.read
  // simply fall back to custom shipping) ─────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await api.settings.listShippingZones() as { data?: ShippingZone[] };
        const zones = Array.isArray(res?.data) ? res.data : [];
        const options: ShippingRateOption[] = [];
        zones.forEach((z, zi) => {
          (z.rates || []).forEach((r, ri) => {
            const price = Number(r.price) || 0;
            options.push({
              id: `${z._id || zi}:${r._id || ri}`,
              label: `${[z.name, r.name].filter(Boolean).join(' — ')} (${formatPrice(price)})`,
              price,
            });
          });
        });
        setRateOptions(options);
      } catch {
        setRateOptions([]);
      }
    })();
  }, []);

  // ── Product search (debounced) ───────────────────────────────────
  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return; }
    const handle = setTimeout(async () => {
      try {
        setProductSearching(true);
        const res = await api.products.getAll({ search: productQuery.trim(), limit: 8 }) as {
          responseObject?: { data?: Product[] };
        };
        setProductResults(res?.responseObject?.data || []);
        setProductDropdownOpen(true);
      } catch {
        setProductResults([]);
      } finally {
        setProductSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [productQuery]);

  // ── Customer search (debounced) ──────────────────────────────────
  useEffect(() => {
    if (customerMode !== 'existing' || !customerQuery.trim()) { setCustomerResults([]); return; }
    const handle = setTimeout(async () => {
      try {
        setCustomerSearching(true);
        const res = await api.customers.getAll({ search: customerQuery.trim(), limit: 8 }) as {
          data?: { customers?: CustomerHit[] };
          responseObject?: { customers?: CustomerHit[] };
        };
        setCustomerResults(res?.data?.customers || res?.responseObject?.customers || []);
        setCustomerDropdownOpen(true);
      } catch {
        setCustomerResults([]);
      } finally {
        setCustomerSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [customerQuery, customerMode]);

  // Close search dropdowns on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (productBoxRef.current && !productBoxRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ── Edit mode: hydrate from the existing draft ───────────────────
  useEffect(() => {
    if (!draftId) return;
    (async () => {
      try {
        setInitialLoading(true);
        const res = await api.orders.getById(draftId) as { responseObject?: Order };
        const order = res?.responseObject;
        if (!order) throw new Error(t('orders:create.toast.load_draft_failed'));
        if (order.status !== 'Draft') {
          toast.error(t('orders:create.toast.not_a_draft'));
          navigate(`/dashboard/orders/${draftId}`);
          return;
        }
        // Rebuild lines; refetch each product so variant selectors work.
        const items: OrderItem[] = order.products || [];
        const hydrated: DraftLine[] = await Promise.all(items.map(async (item) => {
          const productId = typeof item.product === 'string' ? item.product : item.product?._id || '';
          let productDoc: Product | null = null;
          try {
            const pres = await api.products.getById(productId) as { responseObject?: Product; data?: Product };
            productDoc = pres?.responseObject || pres?.data || null;
          } catch { /* product may have been deleted — keep the snapshot */ }
          return {
            productId,
            name: item.name || productDoc?.name || t('orders:create.line.unknown_product'),
            sku: item.sku,
            image: item.image,
            basePrice: productDoc?.price ?? item.price ?? 0,
            hasVariants: Boolean(productDoc?.hasVariants),
            variants: productDoc?.variants || [],
            variantId: item.variantId ? String(item.variantId) : '',
            quantity: item.quantity || 1,
            price: String(item.price ?? 0),
          };
        }));
        setLines(hydrated);

        const user = order.user as { _id?: string; name?: string; email?: string } | undefined;
        if (user?._id) {
          setCustomerMode('existing');
          setSelectedCustomer({ _id: user._id, name: user.name, email: user.email });
        } else {
          const g = (order as Order & { guestCustomer?: { email?: string; firstName?: string; lastName?: string; phone?: string } }).guestCustomer;
          setCustomerMode('guest');
          setGuest({
            email: g?.email || '',
            firstName: g?.firstName || '',
            lastName: g?.lastName || '',
            phone: g?.phone || '',
          });
        }

        const rawOrder = order as Order & { billingAddress?: Address };
        // The list-formatted shippingAddress is remapped; refetch raw parts
        // from the same payload where available.
        const ship = (rawOrder.shippingAddress || {}) as Address & { street?: string };
        setShippingAddress({
          firstName: ship.firstName || '',
          lastName: ship.lastName || '',
          addressLine1: ship.addressLine1 || ship.street || '',
          addressLine2: ship.addressLine2 || '',
          city: ship.city || '',
          state: ship.state || '',
          postalCode: ship.postalCode || '',
          country: ship.country || '',
          phone: ship.phone || '',
        });
        const bill = rawOrder.billingAddress;
        if (bill && Object.values(bill).some(Boolean)) {
          setBillingSame(false);
          setBillingAddress({ ...EMPTY_ADDRESS, ...bill });
        }

        if (order.shippingMethod?.name) {
          setShippingChoice('custom');
          setCustomShippingName(order.shippingMethod.name);
          setCustomShippingPrice(String(order.shippingMethod.price ?? 0));
        }
        if ((order.discount || 0) > 0) {
          setDiscountType('amount');
          setDiscountValue(String(order.discount));
        }
        setNote(order.notes || '');
        setTagsInput((order.tags || []).join(', '));
      } catch (err: unknown) {
        toast.error(errMsg(err, t('orders:create.toast.load_draft_failed')));
        navigate('/dashboard/orders');
      } finally {
        setInitialLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  // ── Line mutations ───────────────────────────────────────────────
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
    setProductDropdownOpen(false);
  };

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const changeLineVariant = (idx: number, variantId: string) => {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const v = l.variants.find((x) => String(x._id) === variantId);
      return { ...l, variantId, price: String(variantUnitPrice(v, l.basePrice)) };
    }));
  };

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  // ── Totals estimate (client-side; authoritative totals — incl. tax —
  // are computed server-side on save, audit 5.2.6 v1 scope) ──────────
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.price) || 0) * (l.quantity || 0), 0),
    [lines]
  );
  const discountAmount = useMemo(() => {
    const v = Number(discountValue);
    if (!discountType || !Number.isFinite(v) || v <= 0) return 0;
    if (discountType === 'percentage') return Math.min(100, v) * subtotal / 100;
    return Math.min(v, subtotal);
  }, [discountType, discountValue, subtotal]);
  const shippingPrice = useMemo(() => {
    if (shippingChoice === 'custom') return Number(customShippingPrice) || 0;
    if (shippingChoice.startsWith('rate:')) {
      const opt = rateOptions.find((o) => `rate:${o.id}` === shippingChoice);
      return opt?.price || 0;
    }
    return 0;
  }, [shippingChoice, customShippingPrice, rateOptions]);
  const estimatedTotal = Math.max(0, subtotal - discountAmount) + shippingPrice;

  // ── Save ─────────────────────────────────────────────────────────
  const buildPayload = (): DraftOrderPayload | null => {
    if (lines.length === 0) {
      toast.error(t('orders:create.toast.no_lines'));
      return null;
    }
    if (customerMode === 'existing' && !selectedCustomer) {
      toast.error(t('orders:create.toast.no_customer'));
      return null;
    }
    if (customerMode === 'guest' && !guest.email.trim()) {
      toast.error(t('orders:create.toast.guest_email_required'));
      return null;
    }
    let shippingMethod: DraftOrderPayload['shippingMethod'] = null;
    if (shippingChoice === 'custom') {
      if (!customShippingName.trim()) {
        toast.error(t('orders:create.toast.custom_shipping_name_required'));
        return null;
      }
      shippingMethod = { name: customShippingName.trim(), price: Number(customShippingPrice) || 0 };
    } else if (shippingChoice.startsWith('rate:')) {
      const opt = rateOptions.find((o) => `rate:${o.id}` === shippingChoice);
      if (opt) shippingMethod = { id: opt.id, name: opt.label.replace(/\s*\([^)]*\)\s*$/, ''), price: opt.price };
    }

    const discountVal = Number(discountValue);
    const hasAddress = Object.values(shippingAddress).some((v) => String(v || '').trim());
    const billing = billingSame ? undefined : billingAddress;
    const hasBilling = billing && Object.values(billing).some((v) => String(v || '').trim());

    return {
      items: lines.map((l) => ({
        productId: l.productId,
        ...(l.variantId ? { variantId: l.variantId } : {}),
        quantity: l.quantity,
        price: Number(l.price) || 0,
      })),
      ...(customerMode === 'existing'
        ? { customerId: selectedCustomer!._id }
        : {
            guestCustomer: {
              email: guest.email.trim(),
              firstName: guest.firstName.trim() || undefined,
              lastName: guest.lastName.trim() || undefined,
              phone: guest.phone.trim() || undefined,
            },
          }),
      ...(hasAddress ? { shippingAddress: { ...shippingAddress } } : {}),
      ...(hasBilling ? { billingAddress: { ...billing } } : {}),
      shippingMethod,
      discount:
        discountType && Number.isFinite(discountVal) && discountVal > 0
          ? { type: discountType, value: discountVal }
          : null,
      note: note.trim() || undefined,
      tags: tagsInput.split(',').map((s) => s.trim()).filter(Boolean),
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) return;
    try {
      setSaving(true);
      if (draftId) {
        await api.orders.updateDraft(draftId, payload);
        toast.success(t('orders:create.toast.draft_updated'));
        navigate(`/dashboard/orders/${draftId}`);
      } else {
        const res = await api.orders.createDraft(payload) as { responseObject?: { _id?: string } };
        toast.success(t('orders:create.toast.draft_created'));
        const id = res?.responseObject?._id;
        navigate(id ? `/dashboard/orders/${id}` : '/dashboard/orders');
      }
    } catch (err: unknown) {
      toast.error(errMsg(err, t('orders:create.toast.save_failed')));
    } finally {
      setSaving(false);
    }
  };

  // ── Address form helper ──────────────────────────────────────────
  const renderAddressFields = (
    value: Address,
    onChange: (a: Address) => void,
    idPrefix: string
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-firstName`}>{t('orders:dialog.address_edit.field.first_name')}</Label>
        <Input id={`${idPrefix}-firstName`} value={value.firstName || ''} onChange={(e) => onChange({ ...value, firstName: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-lastName`}>{t('orders:dialog.address_edit.field.last_name')}</Label>
        <Input id={`${idPrefix}-lastName`} value={value.lastName || ''} onChange={(e) => onChange({ ...value, lastName: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-line1`}>{t('orders:dialog.address_edit.field.line1')}</Label>
        <Input id={`${idPrefix}-line1`} value={value.addressLine1 || ''} onChange={(e) => onChange({ ...value, addressLine1: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-line2`}>{t('orders:dialog.address_edit.field.line2')}</Label>
        <Input id={`${idPrefix}-line2`} value={value.addressLine2 || ''} onChange={(e) => onChange({ ...value, addressLine2: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-city`}>{t('orders:dialog.address_edit.field.city')}</Label>
        <Input id={`${idPrefix}-city`} value={value.city || ''} onChange={(e) => onChange({ ...value, city: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-state`}>{t('orders:dialog.address_edit.field.state')}</Label>
        <Input id={`${idPrefix}-state`} value={value.state || ''} onChange={(e) => onChange({ ...value, state: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-postal`}>{t('orders:dialog.address_edit.field.postal')}</Label>
        <Input id={`${idPrefix}-postal`} value={value.postalCode || ''} onChange={(e) => onChange({ ...value, postalCode: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-country`}>{t('orders:dialog.address_edit.field.country')}</Label>
        <Input id={`${idPrefix}-country`} value={value.country || ''} onChange={(e) => onChange({ ...value, country: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-phone`}>{t('orders:dialog.address_edit.field.phone')}</Label>
        <Input id={`${idPrefix}-phone`} value={value.phone || ''} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
      </div>
    </div>
  );

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(draftId ? `/dashboard/orders/${draftId}` : '/dashboard/orders')}>
          <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />{t('orders:detail.back')}
        </Button>
        <PageHeader
          title={draftId ? t('orders:create.edit_title') : t('orders:create.title')}
          description={t('orders:create.description')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5" />{t('orders:create.section.products')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative" ref={productBoxRef}>
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('orders:create.product_search_placeholder')}
                  className="ps-9"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  onFocus={() => { if (productResults.length > 0) setProductDropdownOpen(true); }}
                />
                {productDropdownOpen && (productSearching || productResults.length > 0 || productQuery.trim()) && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-y-auto">
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

              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t('orders:create.no_lines')}
                </p>
              ) : (
                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={`${line.productId}-${idx}`} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                      <div className="flex items-center gap-3 flex-1 min-w-48">
                        {line.image && <img src={line.image} alt="" className="h-10 w-10 rounded object-cover" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{line.name}</p>
                          {line.sku && <p className="text-xs text-muted-foreground">{line.sku}</p>}
                        </div>
                      </div>
                      {line.hasVariants && line.variants.length > 0 && (
                        <div className="w-44">
                          <Select
                            label={t('orders:create.line.variant')}
                            className="h-9"
                            value={line.variantId}
                            onValueChange={(v) => changeLineVariant(idx, v)}
                            options={line.variants.map((v) => ({
                              value: String(v._id),
                              label: variantLabel(v),
                            }))}
                          />
                        </div>
                      )}
                      <div className="w-20">
                        <Label className="text-xs text-muted-foreground" htmlFor={`qty-${idx}`}>{t('orders:create.line.qty')}</Label>
                        <Input
                          id={`qty-${idx}`}
                          type="number"
                          min={1}
                          className="h-9"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs text-muted-foreground" htmlFor={`price-${idx}`}>{t('orders:create.line.unit_price')}</Label>
                        <Input
                          id={`price-${idx}`}
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
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserIcon className="h-5 w-5" />{t('orders:create.section.customer')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="customer-mode"
                    checked={customerMode === 'existing'}
                    onChange={() => setCustomerMode('existing')}
                  />
                  {t('orders:create.customer.existing')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="customer-mode"
                    checked={customerMode === 'guest'}
                    onChange={() => setCustomerMode('guest')}
                  />
                  {t('orders:create.customer.guest')}
                </label>
              </div>

              {customerMode === 'existing' ? (
                selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{customerLabel(selectedCustomer)}</p>
                      {selectedCustomer.email && (
                        <p className="text-xs text-muted-foreground">{selectedCustomer.email}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                      <X className="h-4 w-4 me-1" />{t('orders:create.customer.change')}
                    </Button>
                  </div>
                ) : (
                  <div className="relative" ref={customerBoxRef}>
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('orders:create.customer_search_placeholder')}
                      className="ps-9"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      onFocus={() => { if (customerResults.length > 0) setCustomerDropdownOpen(true); }}
                    />
                    {customerDropdownOpen && (customerSearching || customerResults.length > 0 || customerQuery.trim()) && (
                      <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
                        {customerSearching ? (
                          <div className="p-3 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : customerResults.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground">{t('orders:create.no_customers_found')}</div>
                        ) : (
                          customerResults.map((c) => (
                            <button
                              key={c._id}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start hover:bg-muted"
                              onClick={() => { setSelectedCustomer(c); setCustomerDropdownOpen(false); setCustomerQuery(''); }}
                            >
                              <span className="text-sm font-medium truncate">{customerLabel(c)}</span>
                              {c.email && <span className="text-xs text-muted-foreground truncate">{c.email}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="guest-email">{t('orders:create.customer.email')}</Label>
                    <Input id="guest-email" type="email" value={guest.email} onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-first">{t('orders:dialog.address_edit.field.first_name')}</Label>
                    <Input id="guest-first" value={guest.firstName} onChange={(e) => setGuest((g) => ({ ...g, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-last">{t('orders:dialog.address_edit.field.last_name')}</Label>
                    <Input id="guest-last" value={guest.lastName} onChange={(e) => setGuest((g) => ({ ...g, lastName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="guest-phone">{t('orders:dialog.address_edit.field.phone')}</Label>
                    <Input id="guest-phone" value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Addresses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5" />{t('orders:create.section.addresses')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">{t('orders:create.addresses_hint')}</p>
              <div>
                <p className="text-sm font-semibold mb-2">{t('orders:detail.address.shipping')}</p>
                {renderAddressFields(shippingAddress, setShippingAddress, 'ship')}
              </div>
              <div className="pt-2 border-t">
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
                  {t('orders:create.billing_same')}
                </label>
                {!billingSame && (
                  <>
                    <p className="text-sm font-semibold mb-2">{t('orders:detail.address.billing')}</p>
                    {renderAddressFields(billingAddress, setBillingAddress, 'bill')}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Shipping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-5 w-5" />{t('orders:create.section.shipping')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                label={t('orders:create.shipping.method')}
                className="h-9"
                value={shippingChoice}
                onValueChange={setShippingChoice}
                options={[
                  { value: 'none', label: t('orders:create.shipping.none') },
                  ...rateOptions.map((o) => ({ value: `rate:${o.id}`, label: o.label })),
                  { value: 'custom', label: t('orders:create.shipping.custom') },
                ]}
              />
              {shippingChoice === 'custom' && (
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ship-name">{t('orders:create.shipping.custom_name')}</Label>
                    <Input id="ship-name" value={customShippingName} onChange={(e) => setCustomShippingName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ship-price">{t('orders:create.shipping.custom_price')}</Label>
                    <Input id="ship-price" type="number" min={0} step="0.01" value={customShippingPrice} onChange={(e) => setCustomShippingPrice(e.target.value)} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Discount */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TagIcon className="h-5 w-5" />{t('orders:create.section.discount')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                label={t('orders:create.discount.type')}
                className="h-9"
                value={discountType}
                onValueChange={(v) => setDiscountType(v as '' | 'amount' | 'percentage')}
                options={[
                  { value: '', label: t('orders:create.discount.none') },
                  { value: 'amount', label: t('orders:create.discount.amount') },
                  { value: 'percentage', label: t('orders:create.discount.percentage') },
                ]}
              />
              {discountType && (
                <div className="space-y-1.5">
                  <Label htmlFor="discount-value">
                    {discountType === 'percentage'
                      ? t('orders:create.discount.value_percentage')
                      : t('orders:create.discount.value_amount')}
                  </Label>
                  <Input
                    id="discount-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">{t('orders:create.discount.manual_hint')}</p>
            </CardContent>
          </Card>

          {/* Note + tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5" />{t('orders:create.section.notes')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="draft-note">{t('orders:create.note')}</Label>
                <Textarea id="draft-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="draft-tags">{t('orders:create.tags')}</Label>
                <Input
                  id="draft-tags"
                  placeholder={t('orders:create.tags_placeholder')}
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Totals estimate + save */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('orders:create.section.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('orders:create.summary.subtotal')}</span>
                <span className="tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('orders:create.summary.discount')}</span>
                <span className="tabular-nums">-{formatPrice(discountAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('orders:create.summary.shipping')}</span>
                <span className="tabular-nums">{formatPrice(shippingPrice)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>{t('orders:create.summary.estimated_total')}</span>
                <span className="tabular-nums">{formatPrice(estimatedTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('orders:create.summary.tax_hint')}</p>
              <div className="pt-2 flex flex-col gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {draftId ? t('orders:create.save_changes') : t('orders:create.save_draft')}
                </Button>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => navigate(draftId ? `/dashboard/orders/${draftId}` : '/dashboard/orders')}
                >
                  {t('common:action.cancel')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OrderCreate;
