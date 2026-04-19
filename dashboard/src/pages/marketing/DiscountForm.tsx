import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, X, Search, Tag, ShoppingBag, Percent, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
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

interface ApiEnvelope<T> {
  responseObject?: T;
  data?: T;
}

interface ApiErrorLike {
  message?: string;
}

const METHOD_ICONS: Record<DiscountMethod, React.ElementType> = {
  amount_off_products: Tag,
  amount_off_order: Percent,
  buy_x_get_y: ShoppingBag,
  free_shipping: Truck,
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
  const { t } = useTranslation(['marketing', 'common']);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);
  const methodFromQuery = (searchParams.get("method") as DiscountMethod | null) || null;
  const validMethods: DiscountMethod[] = ["amount_off_products", "amount_off_order", "buy_x_get_y", "free_shipping"];
  const initialMethod: DiscountMethod =
    methodFromQuery && validMethods.includes(methodFromQuery) ? methodFromQuery : "amount_off_order";

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
            toast.error(t('marketing.discount.toast.not_found'));
            navigate("/dashboard/marketing/discounts");
          }
        }
      } catch (err) {
        const e = err as ApiErrorLike;
        toast.error(e?.message || t('marketing.discount.toast.load_failed'));
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
      toast.error(t('marketing.discount.toast.code_required'));
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isEditMode && id) {
        await api.discounts.update(id, payload);
        toast.success(t('marketing.discount.toast.updated'));
      } else {
        await api.discounts.create(payload);
        toast.success(t('marketing.discount.toast.created'));
      }
      navigate("/dashboard/marketing/discounts");
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || t('marketing.discount.toast.save_failed'));
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

  const Icon = METHOD_ICONS[form.method];
  const methodLabel = t(`marketing.discount.method.${form.method}`);
  const methodDesc = t(`marketing.discount.method.${form.method}_desc`);

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
              {isEditMode ? t('marketing.discount.form.edit_title', { code: existingCode }) : methodLabel}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{methodDesc}</p>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isEditMode ? t('marketing.discount.form.save_button') : t('marketing.discount.form.create_button')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('marketing.discount.form.section.code')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('marketing.discount.form.field.code.label')}</Label>
                <Input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER2025"
                />
              </div>
            </CardContent>
          </Card>

          {form.method === "amount_off_order" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('marketing.discount.form.section.value')}</CardTitle>
                <CardDescription>{t('marketing.discount.form.section.value_order_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ValueFields form={form} setForm={setForm} t={t} />
              </CardContent>
            </Card>
          )}

          {form.method === "amount_off_products" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('marketing.discount.form.section.value')}</CardTitle>
                  <CardDescription>{t('marketing.discount.form.section.value_products_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ValueFields form={form} setForm={setForm} t={t} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('marketing.discount.form.section.applies_to')}</CardTitle>
                  <CardDescription>
                    {t('marketing.discount.form.section.applies_to_desc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PickerField
                    label={t('marketing.discount.form.field.products_picker.label')}
                    placeholder={t('marketing.discount.form.field.products_picker.placeholder')}
                    options={allProducts}
                    selected={form.applicableProducts}
                    onChange={(next) => setForm({ ...form, applicableProducts: next })}
                    noMatchesText={t('marketing.discount.form.picker_no_matches')}
                  />
                  <PickerField
                    label={t('marketing.discount.form.field.categories_picker.label')}
                    placeholder={t('marketing.discount.form.field.categories_picker.placeholder')}
                    options={allCategories}
                    selected={form.applicableCategories}
                    onChange={(next) => setForm({ ...form, applicableCategories: next })}
                    noMatchesText={t('marketing.discount.form.picker_no_matches')}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {form.method === "free_shipping" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('marketing.discount.form.section.shipping_discount')}</CardTitle>
                <CardDescription>
                  {t('marketing.discount.form.section.shipping_discount_desc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ValueFields form={form} setForm={setForm} t={t} />
              </CardContent>
            </Card>
          )}

          {form.method === "buy_x_get_y" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('marketing.discount.form.section.customer_buys')}</CardTitle>
                  <CardDescription>{t('marketing.discount.form.section.customer_buys_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('marketing.discount.form.field.bxgy_buy_quantity.label')}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.bxgy.buyQuantity}
                      onChange={(e) => setBxgy("buyQuantity", e.target.value)}
                    />
                  </div>
                  <PickerField
                    label={t('marketing.discount.form.field.bxgy_buy_products.label')}
                    placeholder={t('marketing.discount.form.field.products_picker.placeholder')}
                    options={allProducts}
                    selected={form.bxgy.buyProducts}
                    onChange={(next) => setBxgy("buyProducts", next)}
                    noMatchesText={t('marketing.discount.form.picker_no_matches')}
                  />
                  <PickerField
                    label={t('marketing.discount.form.field.bxgy_buy_categories.label')}
                    placeholder={t('marketing.discount.form.field.categories_picker.placeholder')}
                    options={allCategories}
                    selected={form.bxgy.buyCategories}
                    onChange={(next) => setBxgy("buyCategories", next)}
                    noMatchesText={t('marketing.discount.form.picker_no_matches')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('marketing.discount.form.field.bxgy_buy_any_hint')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('marketing.discount.form.section.customer_gets')}</CardTitle>
                  <CardDescription>{t('marketing.discount.form.section.customer_gets_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('marketing.discount.form.field.bxgy_get_quantity.label')}</Label>
                      <Input
                        type="number"
                        min="1"
                        value={form.bxgy.getQuantity}
                        onChange={(e) => setBxgy("getQuantity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('marketing.discount.form.field.bxgy_max_uses.label')}</Label>
                      <Input
                        type="number"
                        min="1"
                        value={form.bxgy.maxUsesPerOrder}
                        onChange={(e) => setBxgy("maxUsesPerOrder", e.target.value)}
                        placeholder={t('marketing.discount.form.field.bxgy_max_uses.placeholder')}
                      />
                    </div>
                  </div>
                  <PickerField
                    label={t('marketing.discount.form.field.bxgy_get_products.label')}
                    placeholder={t('marketing.discount.form.field.products_picker.placeholder')}
                    options={allProducts}
                    selected={form.bxgy.getProducts}
                    onChange={(next) => setBxgy("getProducts", next)}
                    noMatchesText={t('marketing.discount.form.picker_no_matches')}
                  />
                  <PickerField
                    label={t('marketing.discount.form.field.bxgy_get_categories.label')}
                    placeholder={t('marketing.discount.form.field.categories_picker.placeholder')}
                    options={allCategories}
                    selected={form.bxgy.getCategories}
                    onChange={(next) => setBxgy("getCategories", next)}
                    noMatchesText={t('marketing.discount.form.picker_no_matches')}
                  />
                  <div className="space-y-2">
                    <Label>{t('marketing.discount.form.field.bxgy_discount_type.label')}</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        value={form.bxgy.getDiscountType}
                        onChange={(e) => setBxgy("getDiscountType", e.target.value as "percentage" | "fixed")}
                        options={[
                          { value: "percentage", label: t('marketing.discount.form.type_option.percentage') },
                          { value: "fixed", label: t('marketing.discount.form.type_option.fixed') },
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
                      {t('marketing.discount.form.field.bxgy_free_hint')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('marketing.discount.form.section.requirements')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('marketing.discount.form.field.min_order_amount.label')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    placeholder={t('marketing.discount.form.field.min_order_amount.placeholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('marketing.discount.form.field.usage_limit.label')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                    placeholder={t('marketing.discount.form.field.usage_limit.placeholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('marketing.discount.form.field.per_user_limit.label')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.perUserLimit}
                    onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                    placeholder={t('marketing.discount.form.field.per_user_limit.placeholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('marketing.discount.form.field.expires_at.label')}</Label>
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
              <CardTitle className="text-base">{t('marketing.discount.form.section.status')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('marketing.discount.form.field.is_active.label')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('marketing.discount.form.field.is_active.hint')}
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
              <CardTitle className="text-base">{t('marketing.discount.form.section.combinations')}</CardTitle>
              <CardDescription>
                {t('marketing.discount.form.section.combinations_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(["product", "order", "shipping"] as const).map((k) => (
                <label key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span className="capitalize">{t('marketing.discount.form.field.combines_with', { kind: k })}</span>
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
  t: (key: string, opts?: Record<string, unknown>) => string;
}> = ({ form, setForm, t }) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label>{t('marketing.discount.form.field.type.label')}</Label>
      <Select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value as "percentage" | "fixed" })}
        options={[
          { value: "percentage", label: t('marketing.discount.form.type_option.percentage') },
          { value: "fixed", label: t('marketing.discount.form.type_option.fixed') },
        ]}
      />
    </div>
    <div className="space-y-2">
      <Label>{t('marketing.discount.form.field.value.label')}</Label>
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

function PickerField({
  label,
  placeholder,
  options,
  selected,
  onChange,
  noMatchesText,
}: {
  label: string;
  placeholder: string;
  options: PickerItem[];
  selected: PickerItem[];
  onChange: (next: PickerItem[]) => void;
  noMatchesText: string;
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
            <div className="px-3 py-2 text-muted-foreground text-xs">{noMatchesText}</div>
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
