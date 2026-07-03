import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Tag, ShoppingBag, Percent, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { Select } from "../../components/ui/select";
import { toast } from "sonner";
import type { DiscountMethod, PickerItem, BxgyState, FormState } from "./discount-form-types";
import { DiscountAppliesToSection } from "./DiscountAppliesToSection";
import { DiscountBxgySections } from "./DiscountBxgySections";
import { DiscountRequirementsSection } from "./DiscountRequirementsSection";
import { DiscountCombinationsSection } from "./DiscountCombinationsSection";

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
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
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
          {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
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

              <DiscountAppliesToSection
                form={form}
                setForm={setForm}
                allProducts={allProducts}
                allCategories={allCategories}
                t={t}
              />
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
            <DiscountBxgySections
              form={form}
              setBxgy={setBxgy}
              allProducts={allProducts}
              allCategories={allCategories}
              t={t}
            />
          )}

          <DiscountRequirementsSection form={form} setForm={setForm} t={t} />
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

          <DiscountCombinationsSection form={form} setCombines={setCombines} t={t} />
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

