import React, { useEffect, useState, useCallback } from 'react';
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Save, Trash2, Loader2, Plus, X, ChevronDown, ChevronUp,
  Eye, ArrowUp, ArrowDown, Search,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rule {
  field: string;
  operator: string;
  value: string;
}

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

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  status: string;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const RULE_FIELDS = [
  { value: 'title',       label: 'Title',        type: 'string' },
  { value: 'tag',         label: 'Tag',           type: 'string' },
  { value: 'price',       label: 'Price',         type: 'number' },
  { value: 'inventory',   label: 'Inventory',     type: 'number' },
  { value: 'category',    label: 'Category',      type: 'string' },
];

const STRING_OPERATORS = [
  { value: 'equals',      label: 'is equal to' },
  { value: 'not_equals',  label: 'is not equal to' },
  { value: 'contains',    label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with',   label: 'ends with' },
  { value: 'in',          label: 'is one of' },
];

const NUMBER_OPERATORS = [
  { value: 'equals',       label: 'is equal to' },
  { value: 'not_equals',   label: 'is not equal to' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than',    label: 'is less than' },
];

const SORT_ORDERS = [
  { value: 'manual',       label: 'Manually' },
  { value: 'best-selling', label: 'Best selling' },
  { value: 'title-asc',    label: 'Title A–Z' },
  { value: 'title-desc',   label: 'Title Z–A' },
  { value: 'price-asc',    label: 'Price low to high' },
  { value: 'price-desc',   label: 'Price high to low' },
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc',  label: 'Oldest first' },
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

function fieldType(fieldValue: string): 'string' | 'number' {
  const f = RULE_FIELDS.find((r) => r.value === fieldValue);
  return (f?.type as 'string' | 'number') || 'string';
}

function operatorsFor(fieldValue: string) {
  return fieldType(fieldValue) === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
}

function defaultOperatorFor(fieldValue: string): string {
  return operatorsFor(fieldValue)[0].value;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CollectionForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id && id !== 'new');
  const confirm = useConfirm();

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
        toast.error('Failed to load collection');
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
        toast.success(`${toAdd.length} product(s) added`);
      } catch (err: unknown) {
        const e = err as ApiErrorLike;
        toast.error(e?.message || 'Failed to add products');
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
        toast.error(e?.message || 'Failed to remove product');
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
        toast.error('Failed to save order');
      }
    }
  };

  // ─── Preview (smart) ──────────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!isEdit) { toast.info('Save the collection first to preview products'); return; }
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
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (form.type === 'smart' && form.rules.some((r) => !r.value)) {
      toast.error('All rule values are required');
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
        toast.success('Collection saved');
      } else {
        const res = (await api.post('/collections', payload)) as CollectionGetResponse;
        const newId = res?.data?._id || res?.responseObject?._id;
        toast.success('Collection created');
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
      toast.error(e?.message || 'Failed to save collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Delete collection?',
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      setDeleting(true);
      await api.delete(`/collections/${id}`);
      toast.success('Collection deleted');
      navigate('/dashboard/collections');
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || 'Failed to delete collection');
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
            {isEdit ? 'Edit Collection' : 'New Collection'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {form.type === 'smart' ? 'Products added automatically by rules' : 'Products added manually'}
          </p>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save</>}
          </Button>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle>Basic info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Summer Sale"
            />
          </div>
          <div className="space-y-1">
            <Label>Handle (URL slug)</Label>
            <Input
              value={form.handle}
              onChange={(e) => handleHandleChange(e.target.value)}
              placeholder="summer-sale"
            />
            <p className="text-xs text-muted-foreground">
              /collections/{form.handle || 'handle'}
            </p>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <textarea
              className="w-full min-h-20 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Short description..."
            />
          </div>
          <div className="space-y-1">
            <Label>Description HTML</Label>
            <textarea
              className="w-full min-h-20 rounded-md border bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.descriptionHtml}
              onChange={(e) => setField('descriptionHtml', e.target.value)}
              placeholder="<p>Rich text HTML...</p>"
            />
          </div>
        </CardContent>
      </Card>

      {/* Image */}
      <Card>
        <CardHeader><CardTitle>Image</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Image URL</Label>
            <Input
              value={form.image.url}
              onChange={(e) => setField('image', { ...form.image, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1">
            <Label>Alt text</Label>
            <Input
              value={form.image.alt}
              onChange={(e) => setField('image', { ...form.image, alt: e.target.value })}
              placeholder="Describe the image"
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
        <CardHeader><CardTitle>Collection type</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            {(['manual', 'smart'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={form.type === t}
                  onChange={() => setField('type', t)}
                  className="accent-primary"
                />
                <span className="capitalize">{t}</span>
                <Badge variant={t === 'smart' ? 'default' : 'secondary'} className="text-[10px]">
                  {t === 'smart' ? 'Rule-based' : 'Curated'}
                </Badge>
              </label>
            ))}
          </div>

          {/* Sort order */}
          <div className="space-y-1">
            <Label>Sort order</Label>
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Products</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Add products
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {collectionProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No products added yet. Click "Add products" to start.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="w-28">Order</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collectionProducts.map((p, i) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.images?.[0] && (
                            <img src={p.images[0]} alt={p.name} className="h-8 w-8 rounded object-cover" />
                          )}
                          <span className="text-sm font-medium">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">${p.price?.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            disabled={i === 0}
                            onClick={() => moveProduct(i, 'up')}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            disabled={i === collectionProducts.length - 1}
                            onClick={() => moveProduct(i, 'down')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => removeCollectionProduct(p)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Smart: rules */}
      {form.type === 'smart' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Rules</CardTitle>
              {isEdit && (
                <Button size="sm" variant="outline" onClick={handlePreview}>
                  <Eye className="h-4 w-4 mr-1" />Preview products
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Match toggle */}
            <div className="flex items-center gap-3 text-sm">
              <span>Products must match</span>
              <Select
                value={form.rulesMatch}
                onValueChange={(v: 'all' | 'any') => setField('rulesMatch', v)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL</SelectItem>
                  <SelectItem value="any">ANY</SelectItem>
                </SelectContent>
              </Select>
              <span>of the conditions</span>
            </div>

            {/* Rule rows */}
            {form.rules.length === 0 && (
              <p className="text-sm text-muted-foreground">No rules yet. Add a condition below.</p>
            )}
            {form.rules.map((rule, i) => {
              const ops = operatorsFor(rule.field);
              return (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  {/* Field */}
                  <Select value={rule.field} onValueChange={(v) => updateRule(i, { field: v })}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator */}
                  <Select value={rule.operator} onValueChange={(v) => updateRule(i, { operator: v })}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ops.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value */}
                  <Input
                    className="w-44"
                    value={rule.value}
                    onChange={(e) => updateRule(i, { value: e.target.value })}
                    placeholder={fieldType(rule.field) === 'number' ? '0' : 'value'}
                    type={fieldType(rule.field) === 'number' ? 'number' : 'text'}
                  />

                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            <Button variant="secondary" size="sm" onClick={addRule}>
              <Plus className="h-4 w-4 mr-1" />Add condition
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Publish status */}
      <Card>
        <CardHeader><CardTitle>Visibility</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isPublished}
              onCheckedChange={(v) => setField('isPublished', v)}
            />
            <Label>{form.isPublished ? 'Published' : 'Hidden from storefront'}</Label>
          </div>
        </CardContent>
      </Card>

      {/* SEO collapsible */}
      <Card>
        <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer select-none">
              <div className="flex items-center justify-between">
                <CardTitle>SEO</CardTitle>
                {seoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Meta title</Label>
                <Input
                  value={form.seo.title}
                  onChange={(e) => setField('seo', { ...form.seo, title: e.target.value })}
                  placeholder={form.title}
                />
              </div>
              <div className="space-y-1">
                <Label>Meta description</Label>
                <textarea
                  className="w-full min-h-20 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.seo.description}
                  onChange={(e) => setField('seo', { ...form.seo, description: e.target.value })}
                  placeholder="Brief description for search engines..."
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Product Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add products</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search products..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {pickerLoading ? (
              <div className="space-y-2 p-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : pickerResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No products found</p>
            ) : (
              <Table>
                <TableBody>
                  {pickerResults.map((p) => (
                    <TableRow
                      key={p._id}
                      className="cursor-pointer"
                      onClick={() => togglePickerProduct(p._id)}
                    >
                      <TableCell className="w-8">
                        <input
                          type="checkbox"
                          checked={pickerSelected.has(p._id)}
                          readOnly
                          className="accent-primary"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.images?.[0] && (
                            <img src={p.images[0]} alt={p.name} className="h-8 w-8 rounded object-cover" />
                          )}
                          <span className="text-sm">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        ${p.price?.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button onClick={confirmAddProducts} disabled={pickerSelected.size === 0}>
              Add {pickerSelected.size > 0 ? `(${pickerSelected.size})` : ''} products
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview — matching products</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            {previewLoading ? (
              <div className="space-y-2 p-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : previewProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No products match the current rules
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewProducts.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.images?.[0] && (
                            <img src={p.images[0]} alt={p.name} className="h-8 w-8 rounded object-cover" />
                          )}
                          <span className="text-sm">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">${p.price?.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollectionForm;
