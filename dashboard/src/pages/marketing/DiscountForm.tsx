import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, X, Search, Tag, ShoppingBag, Percent, Truck } from "lucide-react";
import { api } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { Select } from "../../components/ui/select";
import { toast } from "sonner";

type DiscountMethod =
  | "amount_off_products"
  | "amount_off_order"
  | "buy_x_get_y"
  | "free_shipping";

interface PickerItem {
  _id: string;
  name: string;
}

interface BxgyState {
  buyProducts: PickerItem[];
  buyCategories: PickerItem[];
  buyQuantity: string;
  getProducts: PickerItem[];
  getCategories: PickerItem[];
  getQuantity: string;
  getDiscountType: "percentage" | "fixed";
  getDiscountValue: string;
  maxUsesPerOrder: string;
}

interface FormState {
  code: string;
  method: DiscountMethod;
  type: "percentage" | "fixed";
  value: string;
  minOrderAmount: string;
  usageLimit: string;
  perUserLimit: string;
  expiresAt: string;
  isActive: boolean;
  combinesWith: { product: boolean; order: boolean; shipping: boolean };
  applicableProducts: PickerItem[];
  applicableCategories: PickerItem[];
  bxgy: BxgyState;
}

// Raw discount / picker-option shapes as returned by the api-client. The
// server responses are richer than what the form consumes, so these only
// model the handful of fields this page actually reads.
interface RawIdOrObject {
  _id?: string | number;
  name?: string;
  title?: string;
}

type PickerInput = string | RawIdOrObject | null | undefined;

interface RawBxgy {
  buyProducts?: PickerInput[];
  buyCategories?: PickerInput[];
  buyQuantity?: number | string;
  getProducts?: PickerInput[];
  getCategories?: PickerInput[];
  getQuantity?: number | string;
  getDiscountType?: "percentage" | "fixed";
  getDiscountValue?: number | string;
  maxUsesPerOrder?: number | string | null;
}

interface RawDiscount {
  _id: string;
  code: string;
  type: "percentage" | "fixed";
  method?: DiscountMethod;
  kind?: "product" | "order" | "shipping";
  value?: number | string;
  minOrderAmount?: number | string | null;
  usageLimit?: number | string | null;
  perUserLimit?: number | string | null;
  expiresAt?: string | null;
  isActive: boolean;
  combinesWith?: { product?: boolean; order?: boolean; shipping?: boolean };
  applicableProducts?: PickerInput[];
  applicableCategories?: PickerInput[];
  bxgy?: RawBxgy;
}

interface DiscountPayload {
  code: string;
  method: DiscountMethod;
  type: "percentage" | "fixed";
  value: number;
  minOrderAmount: number;
  usageLimit: number | null;
  perUserLimit: number | null;
  expiresAt: string | null;
  isActive: boolean;
  combinesWith: FormState["combinesWith"];
  applicableProducts: string[];
  applicableCategories: string[];
  bxgy?: {
    buyProducts: string[];
    buyCategories: string[];
    buyQuantity: number;
    getProducts: string[];
    getCategories: string[];
    getQuantity: number;
    getDiscountType: "percentage" | "fixed";
    getDiscountValue: number;
    maxUsesPerOrder: number | null;
  };
}

// Response envelopes from the products / categories / discounts endpoints.
interface ApiEnvelope<T> {
  responseObject?: T;
  data?: T;
}

interface ApiErrorLike {
  message?: string;
}

const METHOD_META: Record<
  DiscountMethod,
  { label: string; description: string; icon: React.ElementType }
> = {
  amount_off_products: {
    label: "Amount off products",
    description: "Discount specific products or collections of products",
    icon: Tag,
  },
  amount_off_order: {
    label: "Amount off order",
    description: "Discount the total order amount",
    icon: Percent,
  },
  buy_x_get_y: {
    label: "Buy X get Y",
    description: "Give a discounted item when customers buy qualifying items",
    icon: ShoppingBag,
  },
  free_shipping: {
    label: "Free shipping",
    description: "Offer free shipping on an order",
    icon: Truck,
  },
};

const emptyBxgy = (): BxgyState => ({
  buyProducts: [],
  buyCategories: [],
  buyQuantity: "1",
  getProducts: [],
  getCategories: [],
  getQuantity: "1",
  getDiscountType: "percentage",
  getDiscountValue: "100",
  maxUsesPerOrder: "",
});

const emptyForm = (method: DiscountMethod = "amount_off_order"): FormState => ({
  code: "",
  method,
  type: method === "free_shipping" ? "percentage" : "percentage",
  value: method === "free_shipping" ? "100" : "",
  minOrderAmount: "",
  usageLimit: "",
  perUserLimit: "",
  expiresAt: "",
  isActive: true,
  combinesWith: { product: false, order: false, shipping: false },
  applicableProducts: [],
  applicableCategories: [],
  bxgy: emptyBxgy(),
});

const normalizePickerArray = (
  arr: PickerInput[] | undefined,
  lookup: Map<string, PickerItem>,
): PickerItem[] => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item): PickerItem | null => {
      if (typeof item === "string") {
        const hit = lookup.get(item);
        return hit || { _id: item, name: item.slice(-6) };
      }
      if (item && typeof item === "object" && item._id != null) {
        const id = String(item._id);
        return {
          _id: id,
          name: item.name || lookup.get(id)?.name || id.slice(-6),
        };
      }
      return null;
    })
    .filter((v): v is PickerItem => v !== null);
};

// Infer method for legacy records that only have `kind`. amount_off_products
// vs. amount_off_order is derived from whether there's a product scope.
const inferMethod = (d: RawDiscount): DiscountMethod => {
  if (d.method) return d.method;
  if (d.kind === "shipping") return "free_shipping";
  if (d.kind === "product") return "amount_off_products";
  return "amount_off_order";
};

const toFormState = (
  d: RawDiscount,
  productLookup: Map<string, PickerItem>,
  categoryLookup: Map<string, PickerItem>,
): FormState => {
  const method = inferMethod(d);
  const bxgy: BxgyState = d.bxgy
    ? {
        buyProducts: normalizePickerArray(d.bxgy.buyProducts, productLookup),
        buyCategories: normalizePickerArray(d.bxgy.buyCategories, categoryLookup),
        buyQuantity: String(d.bxgy.buyQuantity ?? 1),
        getProducts: normalizePickerArray(d.bxgy.getProducts, productLookup),
        getCategories: normalizePickerArray(d.bxgy.getCategories, categoryLookup),
        getQuantity: String(d.bxgy.getQuantity ?? 1),
        getDiscountType: d.bxgy.getDiscountType || "percentage",
        getDiscountValue: String(d.bxgy.getDiscountValue ?? 100),
        maxUsesPerOrder: d.bxgy.maxUsesPerOrder != null ? String(d.bxgy.maxUsesPerOrder) : "",
      }
    : emptyBxgy();
  return {
    code: d.code,
    method,
    type: d.type,
    value: String(d.value ?? ""),
    minOrderAmount: d.minOrderAmount != null ? String(d.minOrderAmount) : "",
    usageLimit: d.usageLimit != null ? String(d.usageLimit) : "",
    perUserLimit: d.perUserLimit != null ? String(d.perUserLimit) : "",
    expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().slice(0, 16) : "",
    isActive: d.isActive,
    combinesWith: {
      product: !!d.combinesWith?.product,
      order: !!d.combinesWith?.order,
      shipping: !!d.combinesWith?.shipping,
    },
    applicableProducts: normalizePickerArray(d.applicableProducts, productLookup),
    applicableCategories: normalizePickerArray(d.applicableCategories, categoryLookup),
    bxgy,
  };
};

const buildPayload = (f: FormState): DiscountPayload => {
  const base: DiscountPayload = {
    code: f.code,
    method: f.method,
    type: f.type,
    value: Number(f.value || 0),
    minOrderAmount: f.minOrderAmount ? Number(f.minOrderAmount) : 0,
    usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
    perUserLimit: f.perUserLimit ? Number(f.perUserLimit) : null,
    expiresAt: f.expiresAt || null,
    isActive: f.isActive,
    combinesWith: f.combinesWith,
    applicableProducts:
      f.method === "amount_off_products" ? f.applicableProducts.map((p) => p._id) : [],
    applicableCategories:
      f.method === "amount_off_products" ? f.applicableCategories.map((c) => c._id) : [],
  };
  if (f.method === "buy_x_get_y") {
    base.bxgy = {
      buyProducts: f.bxgy.buyProducts.map((p) => p._id),
      buyCategories: f.bxgy.buyCategories.map((c) => c._id),
      buyQuantity: Number(f.bxgy.buyQuantity || 1),
      getProducts: f.bxgy.getProducts.map((p) => p._id),
      getCategories: f.bxgy.getCategories.map((c) => c._id),
      getQuantity: Number(f.bxgy.getQuantity || 1),
      getDiscountType: f.bxgy.getDiscountType,
      getDiscountValue: Number(f.bxgy.getDiscountValue || 0),
      maxUsesPerOrder: f.bxgy.maxUsesPerOrder ? Number(f.bxgy.maxUsesPerOrder) : null,
    };
  }
  return base;
};

export default function DiscountForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);
  const methodFromQuery = (searchParams.get("method") as DiscountMethod | null) || null;
  const initialMethod: DiscountMethod =
    methodFromQuery && METHOD_META[methodFromQuery] ? methodFromQuery : "amount_off_order";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(initialMethod));
  const [existingCode, setExistingCode] = useState<string>("");

  const [allProducts, setAllProducts] = useState<PickerItem[]>([]);
  const [allCategories, setAllCategories] = useState<PickerItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [pRes, cRes] = await Promise.all([
          api.products.getAll({ limit: 500 }),
          api.categories.getAll(),
        ]);
        // The /products and /categories endpoints both return
        // `{ success, responseObject: { data: [...] } }`. Older shapes are
        // kept here as fallbacks so this picker keeps working if either
        // endpoint is ever migrated.
        type ListEnvelope = ApiEnvelope<
          RawIdOrObject[] | { data?: RawIdOrObject[]; products?: RawIdOrObject[]; categories?: RawIdOrObject[] }
        > & {
          responseObject?: {
            data?: RawIdOrObject[];
            products?: RawIdOrObject[];
            categories?: RawIdOrObject[];
          };
          data?:
            | RawIdOrObject[]
            | { products?: RawIdOrObject[]; categories?: RawIdOrObject[] };
        };
        const pEnv = pRes as ListEnvelope;
        const cEnv = cRes as ListEnvelope;
        const productList: RawIdOrObject[] =
          pEnv?.responseObject?.data ||
          pEnv?.responseObject?.products ||
          (typeof pEnv?.data === "object" && !Array.isArray(pEnv?.data)
            ? pEnv?.data?.products
            : undefined) ||
          (Array.isArray(pEnv?.data) ? pEnv.data : undefined) ||
          [];
        const categoryList: RawIdOrObject[] =
          cEnv?.responseObject?.data ||
          cEnv?.responseObject?.categories ||
          (typeof cEnv?.data === "object" && !Array.isArray(cEnv?.data)
            ? cEnv?.data?.categories
            : undefined) ||
          (Array.isArray(cEnv?.data) ? cEnv.data : undefined) ||
          [];
        const products: PickerItem[] = productList.map((p) => ({
          _id: String(p._id),
          name: p.name || p.title || "Unnamed",
        }));
        const categories: PickerItem[] = categoryList.map((c) => ({
          _id: String(c._id),
          name: c.name || "Unnamed",
        }));
        setAllProducts(products);
        setAllCategories(categories);

        if (isEditMode && id) {
          const res = await api.discounts.getAll() as { data?: RawDiscount[] };
          const list: RawDiscount[] = res.data || [];
          const d = list.find((x) => String(x._id) === String(id));
          if (d) {
            const productLookup = new Map(products.map((p) => [p._id, p]));
            const categoryLookup = new Map(categories.map((c) => [c._id, c]));
            setForm(toFormState(d, productLookup, categoryLookup));
            setExistingCode(d.code);
          } else {
            toast.error("Discount not found");
            navigate("/dashboard/marketing/discounts");
          }
        }
      } catch (err) {
        const e = err as ApiErrorLike;
        toast.error(e?.message || "Failed to load discount");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setCombines = (k: keyof FormState["combinesWith"], v: boolean) =>
    setForm((prev) => ({ ...prev, combinesWith: { ...prev.combinesWith, [k]: v } }));

  const setBxgy = <K extends keyof BxgyState>(k: K, v: BxgyState[K]) =>
    setForm((prev) => ({ ...prev, bxgy: { ...prev.bxgy, [k]: v } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast.error("Discount code is required");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isEditMode && id) {
        await api.discounts.update(id, payload);
        toast.success("Discount updated");
      } else {
        await api.discounts.create(payload);
        toast.success("Discount created");
      }
      navigate("/dashboard/marketing/discounts");
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || "Failed to save discount");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const meta = METHOD_META[form.method];
  const Icon = meta.icon;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/marketing/discounts")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {isEditMode ? `Edit ${existingCode}` : meta.label}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isEditMode ? "Save changes" : "Create discount"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discount code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER2025"
                />
              </div>
            </CardContent>
          </Card>

          {/* Method-specific sections */}
          {form.method === "amount_off_order" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Value</CardTitle>
                <CardDescription>How much to take off the order subtotal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ValueFields form={form} setForm={setForm} />
              </CardContent>
            </Card>
          )}

          {form.method === "amount_off_products" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Value</CardTitle>
                  <CardDescription>How much to take off each qualifying line.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ValueFields form={form} setForm={setForm} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Applies to</CardTitle>
                  <CardDescription>
                    Pick the products and/or categories this discount applies to. Leave both empty to
                    apply it to every line.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PickerField
                    label="Products"
                    placeholder="Search products..."
                    options={allProducts}
                    selected={form.applicableProducts}
                    onChange={(next) => setForm({ ...form, applicableProducts: next })}
                  />
                  <PickerField
                    label="Categories"
                    placeholder="Search categories..."
                    options={allCategories}
                    selected={form.applicableCategories}
                    onChange={(next) => setForm({ ...form, applicableCategories: next })}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {form.method === "free_shipping" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shipping discount</CardTitle>
                <CardDescription>
                  By default customers get 100% off shipping. Lower the percentage for a partial
                  discount, or switch to a fixed-amount rebate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ValueFields form={form} setForm={setForm} />
              </CardContent>
            </Card>
          )}

          {form.method === "buy_x_get_y" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Customer buys</CardTitle>
                  <CardDescription>What the customer must have in their cart to qualify.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.bxgy.buyQuantity}
                      onChange={(e) => setBxgy("buyQuantity", e.target.value)}
                    />
                  </div>
                  <PickerField
                    label="Any of these products"
                    placeholder="Search products..."
                    options={allProducts}
                    selected={form.bxgy.buyProducts}
                    onChange={(next) => setBxgy("buyProducts", next)}
                  />
                  <PickerField
                    label="Or any product in these categories"
                    placeholder="Search categories..."
                    options={allCategories}
                    selected={form.bxgy.buyCategories}
                    onChange={(next) => setBxgy("buyCategories", next)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave both empty to allow any product in the cart to count toward the buy quantity.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Customer gets</CardTitle>
                  <CardDescription>What's discounted, and by how much.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={form.bxgy.getQuantity}
                        onChange={(e) => setBxgy("getQuantity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max uses per order</Label>
                      <Input
                        type="number"
                        min="1"
                        value={form.bxgy.maxUsesPerOrder}
                        onChange={(e) => setBxgy("maxUsesPerOrder", e.target.value)}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                  <PickerField
                    label="Any of these products"
                    placeholder="Search products..."
                    options={allProducts}
                    selected={form.bxgy.getProducts}
                    onChange={(next) => setBxgy("getProducts", next)}
                  />
                  <PickerField
                    label="Or any product in these categories"
                    placeholder="Search categories..."
                    options={allCategories}
                    selected={form.bxgy.getCategories}
                    onChange={(next) => setBxgy("getCategories", next)}
                  />
                  <div className="space-y-2">
                    <Label>At a discount of</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        value={form.bxgy.getDiscountType}
                        onChange={(e) => setBxgy("getDiscountType", e.target.value as "percentage" | "fixed")}
                        options={[
                          { value: "percentage", label: "Percentage (%)" },
                          { value: "fixed", label: "Fixed amount" },
                        ]}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.bxgy.getDiscountValue}
                        onChange={(e) => setBxgy("getDiscountValue", e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use 100% for "get one free". The discount applies to the cheapest qualifying units.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requirements & limits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min order amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total usage limit</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Per-customer limit</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.perUserLimit}
                    onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expires at</Label>
                  <Input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">
                    Inactive discounts cannot be applied at checkout.
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Combinations</CardTitle>
              <CardDescription>
                Customers can stack two discounts only if both opt in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(["product", "order", "shipping"] as const).map((k) => (
                <label key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span className="capitalize">Combines with {k} discounts</span>
                  <Switch
                    checked={form.combinesWith[k]}
                    onCheckedChange={(v) => setCombines(k, v)}
                  />
                </label>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

const ValueFields: React.FC<{
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}> = ({ form, setForm }) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label>Type</Label>
      <Select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value as "percentage" | "fixed" })}
        options={[
          { value: "percentage", label: "Percentage (%)" },
          { value: "fixed", label: "Fixed amount" },
        ]}
      />
    </div>
    <div className="space-y-2">
      <Label>Value</Label>
      <Input
        required
        type="number"
        min="0"
        step="0.01"
        value={form.value}
        onChange={(e) => setForm({ ...form, value: e.target.value })}
      />
    </div>
  </div>
);

/**
 * Lightweight multi-select with inline search.
 */
function PickerField({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: PickerItem[];
  selected: PickerItem[];
  onChange: (next: PickerItem[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedIds = new Set(selected.map((s) => s._id));
  const filtered = options
    .filter((o) => !selectedIds.has(o._id))
    .filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);

  const add = (item: PickerItem) => {
    onChange([...selected, item]);
    setQuery("");
  };
  const remove = (id: string) => onChange(selected.filter((s) => s._id !== id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <Badge key={item._id} variant="secondary" className="text-xs gap-1 pr-1">
              {item.name}
              <button
                type="button"
                onClick={() => remove(item._id)}
                className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remove ${item.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-8 h-9"
        />
      </div>
      {query && (
        <div className="max-h-48 overflow-y-auto rounded-md border bg-popover text-sm">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-muted-foreground text-xs">No matches</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => add(item)}
                className="block w-full text-left px-3 py-1.5 hover:bg-accent focus:bg-accent focus:outline-none"
              >
                {item.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
