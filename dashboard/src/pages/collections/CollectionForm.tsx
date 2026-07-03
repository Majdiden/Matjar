import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '../../components/ui/collapsible';
import {
  Save, Trash2, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';
import {
  CollectionRuleBuilder, CollectionPreviewDialog, defaultOperatorFor, type Rule,
} from './CollectionRuleBuilder';
import {
  CollectionProductsCard, CollectionProductPickerDialog, type Product,
} from './CollectionProductPicker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectionFormData {
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  image: { url: string; alt: string };
  type: 'manual' | 'smart';
  rules: Rule[];
  rulesMatch: 'all' | 'any';
  sortOrder: string;
  isPublished: boolean;
  seo: { title: string; description: string };
}

// GET /collections/:id — server returns the collection under `data` or
// `responseObject` depending on middleware version. `productIds` is the
// manual-type children list; it's absent for smart collections.
interface CollectionDTO {
  title?: string;
  handle?: string;
  description?: string;
  descriptionHtml?: string;
  image?: { url: string; alt: string };
  type?: 'manual' | 'smart';
  rules?: Rule[];
  rulesMatch?: 'all' | 'any';
  sortOrder?: string;
  isPublished?: boolean;
  seo?: { title: string; description: string };
  productIds?: string[];
  _id?: string;
}
interface CollectionGetResponse {
  data?: CollectionDTO;
  responseObject?: CollectionDTO;
}

// GET /products — only the shape we use here.
interface ProductListResponse {
  responseObject?: { data?: Product[] };
  data?: { products?: Product[] };
}

// GET /collections/:id/preview returns { data: { products: [...] } }.
interface CollectionPreviewResponse {
  data?: { products?: Product[] };
}

interface ApiErrorLike { message?: string; error?: string }

// ─── Constants (values only — labels built from t() inside component) ─────────

const SORT_ORDER_VALUES = [
  'manual', 'best-selling', 'title-asc', 'title-desc',
  'price-asc', 'price-desc', 'created-desc', 'created-asc',
];

const DEFAULT_FORM: CollectionFormData = {
  title: '',
  handle: '',
  description: '',
  descriptionHtml: '',
  image: { url: '', alt: '' },
  type: 'manual',
  rules: [],
  rulesMatch: 'all',
  sortOrder: 'manual',
  isPublished: true,
  seo: { title: '', description: '' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CollectionForm: React.FC = () => {
  const { t } = useTranslation(['products', 'common']);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id && id !== 'new');
  const confirm = useConfirm();

  const SORT_ORDERS = SORT_ORDER_VALUES.map((v) => ({
    value: v,
    label: t(`products.collections.form.sort_order.${v.replace(/-/g, '_')}`),
  }));

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<CollectionFormData>(DEFAULT_FORM);
  const [handleEdited, setHandleEdited] = useState(false);

  // Products section (manual collections)
  const [collectionProducts, setCollectionProducts] = useState<Product[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerResults, setPickerResults] = useState<Product[]>([]);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [pickerLoading, setPickerLoading] = useState(false);

  // Preview (smart collections)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // SEO collapsible
  const [seoOpen, setSeoOpen] = useState(false);

  // ─── Load existing collection ─────────────────────────────────────────────

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      try {
        const res = (await api.get(`/collections/${id}`)) as CollectionGetResponse;
        const col = res?.data || res?.responseObject;
        if (!col) return;
        setForm({
          title: col.title || '',
          handle: col.handle || '',
          description: col.description || '',
          descriptionHtml: col.descriptionHtml || '',
          image: col.image || { url: '', alt: '' },
          type: col.type || 'manual',
          rules: col.rules || [],
          rulesMatch: col.rulesMatch || 'all',
          sortOrder: col.sortOrder || 'manual',
          isPublished: col.isPublished !== false,
          seo: col.seo || { title: '', description: '' },
        });
        setHandleEdited(true); // don't auto-overwrite handle on edit

        // Load products for manual collections
        if (col.type === 'manual' && col.productIds?.length) {
          await loadCollectionProducts(col.productIds);
        }
      } catch {
        toast.error(t('products.collections.toast.load_failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  const loadCollectionProducts = async (productIds: string[]) => {
    try {
      const res = (await api.get('/products', { params: { page: 1, limit: 500 } })) as ProductListResponse;
      const all: Product[] = res?.responseObject?.data || res?.data?.products || [];
      const matched = productIds
        .map((pid) => all.find((p) => p._id === pid))
        .filter((p): p is Product => Boolean(p));
      setCollectionProducts(matched);
    } catch {
      setCollectionProducts([]);
    }
  };

  // ─── Form helpers ─────────────────────────────────────────────────────────

  const setField = <K extends keyof CollectionFormData>(key: K, value: CollectionFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTitleChange = (value: string) => {
    setField('title', value);
    if (!handleEdited) {
      setField('handle', slugify(value));
    }
  };

  const handleHandleChange = (value: string) => {
    setHandleEdited(true);
    setField('handle', slugify(value));
  };

  // ─── Rules ────────────────────────────────────────────────────────────────

  const addRule = () => {
    const field = 'title';
    setField('rules', [...form.rules, { field, operator: defaultOperatorFor(field), value: '' }]);
  };

  const updateRule = (index: number, patch: Partial<Rule>) => {
    const updated = form.rules.map((r, i) => {
      if (i !== index) return r;
      const merged = { ...r, ...patch };
      // When field changes, reset operator to a valid one for that field type
      if (patch.field && patch.field !== r.field) {
        merged.operator = defaultOperatorFor(patch.field);
      }
      return merged;
    });
    setField('rules', updated);
  };

  const removeRule = (index: number) => {
    setField('rules', form.rules.filter((_, i) => i !== index));
  };

  // ─── Product picker ───────────────────────────────────────────────────────

  const searchProducts = useCallback(async (q: string) => {
    try {
      setPickerLoading(true);
      const params: { page: number; limit: number; search?: string } = { page: 1, limit: 50 };
      if (q) params.search = q;
      const res = (await api.get('/products', { params })) as ProductListResponse;
      const products: Product[] = res?.responseObject?.data || res?.data?.products || [];
      // Exclude already-added products
      const existingIds = new Set(collectionProducts.map((p) => p._id));
      setPickerResults(products.filter((p) => !existingIds.has(p._id)));
    } catch {
      setPickerResults([]);
    } finally {
      setPickerLoading(false);
    }
  }, [collectionProducts]);

  useEffect(() => {
    if (pickerOpen) searchProducts(pickerSearch);
  }, [pickerSearch, pickerOpen, searchProducts]);

  const togglePickerProduct = (pid: string) => {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const confirmAddProducts = async () => {
    const toAdd = pickerResults.filter((p) => pickerSelected.has(p._id));
    if (toAdd.length === 0) { setPickerOpen(false); return; }

    if (isEdit) {
      try {
        await api.post(`/collections/${id}/products`, { productIds: toAdd.map((p) => p._id) });
        toast.success(t('products.collections.toast.products_added', { count: toAdd.length }));
      } catch (err: unknown) {
        const e = err as ApiErrorLike;
        toast.error(e?.message || t('products.collections.toast.products_add_failed'));
        return;
      }
    }

    setCollectionProducts((prev) => [...prev, ...toAdd]);
    setPickerSelected(new Set());
    setPickerOpen(false);
  };

  const removeCollectionProduct = async (product: Product) => {
    if (isEdit) {
      try {
        await api.delete(`/collections/${id}/products`, { data: { productIds: [product._id] } });
      } catch (err: unknown) {
        const e = err as ApiErrorLike;
        toast.error(e?.message || t('products.collections.toast.product_remove_failed'));
        return;
      }
    }
    setCollectionProducts((prev) => prev.filter((p) => p._id !== product._id));
  };

  const moveProduct = async (index: number, direction: 'up' | 'down') => {
    const newList = [...collectionProducts];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setCollectionProducts(newList);

    if (isEdit) {
      try {
        await api.put(`/collections/${id}/products/order`, { productIds: newList.map((p) => p._id) });
      } catch {
        toast.error(t('products.collections.toast.order_failed'));
      }
    }
  };

  // ─── Preview (smart) ──────────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!isEdit) { toast.info(t('products.collections.toast.save_first')); return; }
    try {
      setPreviewLoading(true);
      setPreviewOpen(true);
      const res = (await api.get(`/collections/${id}/preview`)) as CollectionPreviewResponse;
      setPreviewProducts(res?.data?.products || []);
    } catch {
      setPreviewProducts([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ─── Save / Delete ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(t('products.collections.form.title_required')); return; }
    if (form.type === 'smart' && form.rules.some((r) => !r.value)) {
      toast.error(t('products.collections.form.rules_required'));
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        handle: form.handle || slugify(form.title),
      };

      if (isEdit) {
        await api.put(`/collections/${id}`, payload);
        toast.success(t('products.collections.toast.saved'));
      } else {
        const res = (await api.post('/collections', payload)) as CollectionGetResponse;
        const newId = res?.data?._id || res?.responseObject?._id;
        toast.success(t('products.collections.toast.created'));
        if (newId) {
          // Add products if any were staged
          if (form.type === 'manual' && collectionProducts.length > 0) {
            await api.post(`/collections/${newId}/products`, {
              productIds: collectionProducts.map((p) => p._id),
            });
          }
          navigate(`/dashboard/collections/${newId}/edit`);
          return;
        }
        navigate('/dashboard/collections');
      }
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || t('products.collections.toast.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: t('products.collections.confirm.delete.title'),
      description: t('products.collections.confirm.delete.description_bulk'),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      setDeleting(true);
      await api.delete(`/collections/${id}`);
      toast.success(t('products.collections.toast.deleted'));
      navigate('/dashboard/collections');
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || t('products.collections.toast.delete_failed'));
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? t('products.collections.form.title.edit') : t('products.collections.form.title.create')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {form.type === 'smart' ? t('products.collections.form.subtitle.smart') : t('products.collections.form.subtitle.manual')}
          </p>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('common:state.saving_ellipsis')}</> : <><Save className="h-4 w-4 me-2" />{t('common:action.save')}</>}
          </Button>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle>{t('products.collections.form.section.basic_info')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t('products.collections.form.field.title.label')} <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t('products.collections.form.field.title.placeholder')}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('products.collections.form.field.handle.label')}</Label>
            <Input
              value={form.handle}
              onChange={(e) => handleHandleChange(e.target.value)}
              placeholder={t('products.collections.form.field.handle.placeholder')}
            />
            <p className="text-xs text-muted-foreground">
              /collections/{form.handle || 'handle'}
            </p>
          </div>
          <div className="space-y-1">
            <Label>{t('products.collections.form.field.description.label')}</Label>
            <textarea
              className="w-full min-h-20 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder={t('products.collections.form.field.description.placeholder')}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('products.collections.form.field.description_html.label')}</Label>
            <textarea
              className="w-full min-h-20 rounded-md border bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.descriptionHtml}
              onChange={(e) => setField('descriptionHtml', e.target.value)}
              placeholder={t('products.collections.form.field.description_html.placeholder')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Image */}
      <Card>
        <CardHeader><CardTitle>{t('products.collections.form.section.image')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t('products.collections.form.field.image_url.label')}</Label>
            <Input
              value={form.image.url}
              onChange={(e) => setField('image', { ...form.image, url: e.target.value })}
              placeholder={t('products.collections.form.field.image_url.placeholder')}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('products.collections.form.field.image_alt.label')}</Label>
            <Input
              value={form.image.alt}
              onChange={(e) => setField('image', { ...form.image, alt: e.target.value })}
              placeholder={t('products.collections.form.field.image_alt.placeholder')}
            />
          </div>
          {form.image.url && (
            <img
              src={form.image.url}
              alt={form.image.alt || 'Collection image'}
              className="h-32 w-32 object-cover rounded-md border"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </CardContent>
      </Card>

      {/* Collection type */}
      <Card>
        <CardHeader><CardTitle>{t('products.collections.form.section.type')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            {(['manual', 'smart'] as const).map((tVal) => (
              <label key={tVal} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={tVal}
                  checked={form.type === tVal}
                  onChange={() => setField('type', tVal)}
                  className="accent-primary"
                />
                <span className="capitalize">{tVal === 'smart' ? t('products.collections.form.type_label.smart') : t('products.collections.form.type_label.manual')}</span>
                <Badge variant={tVal === 'smart' ? 'default' : 'secondary'} className="text-[10px]">
                  {tVal === 'smart' ? t('products.collections.form.type_label.badge_rule_based') : t('products.collections.form.type_label.badge_curated')}
                </Badge>
              </label>
            ))}
          </div>

          {/* Sort order */}
          <div className="space-y-1">
            <Label>{t('products.collections.form.field.sort_order.label')}</Label>
            <Select value={form.sortOrder} onValueChange={(v) => setField('sortOrder', v)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_ORDERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Manual: products list */}
      {form.type === 'manual' && (
        <CollectionProductsCard
          products={collectionProducts}
          onOpenPicker={() => setPickerOpen(true)}
          onMoveProduct={moveProduct}
          onRemoveProduct={removeCollectionProduct}
        />
      )}

      {/* Smart: rules */}
      {form.type === 'smart' && (
        <CollectionRuleBuilder
          rules={form.rules}
          rulesMatch={form.rulesMatch}
          isEdit={isEdit}
          onRulesMatchChange={(v) => setField('rulesMatch', v)}
          onAddRule={addRule}
          onUpdateRule={updateRule}
          onRemoveRule={removeRule}
          onPreview={handlePreview}
        />
      )}

      {/* Publish status */}
      <Card>
        <CardHeader><CardTitle>{t('products.collections.form.section.visibility')}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isPublished}
              onCheckedChange={(v) => setField('isPublished', v)}
            />
            <Label>{form.isPublished ? t('products.collections.form.visibility.published') : t('products.collections.form.visibility.hidden')}</Label>
          </div>
        </CardContent>
      </Card>

      {/* SEO collapsible */}
      <Card>
        <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer select-none">
              <div className="flex items-center justify-between">
                <CardTitle>{t('products.collections.form.section.seo')}</CardTitle>
                {seoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>{t('products.collections.form.field.meta_title.label')}</Label>
                <Input
                  value={form.seo.title}
                  onChange={(e) => setField('seo', { ...form.seo, title: e.target.value })}
                  placeholder={form.title}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('products.collections.form.field.meta_description.label')}</Label>
                <textarea
                  className="w-full min-h-20 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.seo.description}
                  onChange={(e) => setField('seo', { ...form.seo, description: e.target.value })}
                  placeholder={t('products.collections.form.field.meta_description.placeholder')}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Product Picker Dialog */}
      <CollectionProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        search={pickerSearch}
        onSearchChange={setPickerSearch}
        results={pickerResults}
        selected={pickerSelected}
        loading={pickerLoading}
        onToggleProduct={togglePickerProduct}
        onConfirm={confirmAddProducts}
      />

      {/* Smart Preview Dialog */}
      <CollectionPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        products={previewProducts}
        loading={previewLoading}
      />
    </div>
  );
};

export default CollectionForm;
