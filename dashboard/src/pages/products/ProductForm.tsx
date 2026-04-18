import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { ImageUpload } from '../../components/ui/image-upload';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { ArrowLeft, Save, Loader2, ChevronDown, X, Plus } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import type { Product, Category, ProductFormData } from '../../types';
import { VariantEditor } from './VariantEditor';
import { PreorderEditor } from './PreorderEditor';

// GET /categories — response shape; server wraps in responseObject.data.
interface CategoriesGetResponse {
  responseObject?: { data?: Category[] };
}

// GET /products/:id — response shape; server returns the product under
// responseObject.data.
interface ProductGetResponse {
  responseObject?: { data?: Product };
}

interface ApiErrorLike { message?: string; error?: string }

export const ProductForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '', slug: '', description: '', price: 0, salePrice: undefined,
    sku: '', category: '', stock: 0, status: 'draft', featured: false, tags: [], images: [],
    hasVariants: false, options: [], variants: [],
    preorder: { enabled: false },
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({});
  const [tagInput, setTagInput] = useState('');

  useEffect(() => { loadInitialData();
    // loadInitialData closes over `id` and `isEditMode`; refetching on
    // id change is the whole point. The function is redeclared each
    // render, so including it in the deps array would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const catResponse = (await api.categories.getAll()) as CategoriesGetResponse;
      setCategories(catResponse.responseObject?.data || []);

      if (isEditMode && id) {
        const prodResponse = (await api.products.getById(id)) as ProductGetResponse;
        const product = prodResponse.responseObject?.data;
        if (!product) return;
        setFormData({
          name: product.name, description: product.description, slug: product.slug,
          price: product.price, salePrice: product.salePrice, sku: product.sku,
          category: typeof product.category === 'string' ? product.category : product.category._id,
          stock: product.stock, status: product.status, featured: product.featured,
          tags: product.tags || [], images: product.images || [],
          hasVariants: product.hasVariants || false,
          options: product.options || [],
          variants: product.variants || [],
          preorder: product.preorder || { enabled: false },
        });
      }
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ProductFormData, string>> = {};
    if (!formData.name.trim()) errors.name = 'Required';
    if (!formData.description.trim()) errors.description = 'Required';
    if (formData.price <= 0) errors.price = 'Must be > 0';
    if (formData.salePrice && formData.salePrice >= formData.price) errors.salePrice = 'Must be less than price';
    if (!formData.sku.trim()) errors.sku = 'Required';
    if (!formData.slug.trim()) errors.slug = 'Required';
    if (!formData.category) errors.category = 'Required';
    if (formData.stock < 0) errors.stock = 'Cannot be negative';

    // When variants are enabled, the matrix is the source of truth for
    // stock — but we still need at least one variant, otherwise the
    // product is unbuyable.
    if (formData.hasVariants) {
      if (!formData.variants || formData.variants.length === 0) {
        toast.error('Variants are enabled but you have not generated any. Add option values and click Generate.');
        return false;
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateForm()) return;
    try {
      setSaving(true);
      if (isEditMode && id) {
        await api.products.update(id, formData);
        toast.success('Product updated');
      } else {
        await api.products.create(formData);
        toast.success('Product created');
      }
      navigate('/dashboard/products');
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || `Failed to ${isEditMode ? 'update' : 'create'} product`);
    } finally {
      setSaving(false);
    }
  };

  // `ProductFormData` is a heterogeneous record (strings, numbers,
  // arrays, nested preorder config). Using the field-keyed value
  // signature keeps callers honest without forcing a discriminated
  // union for every single call-site.
  const handleChange = <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'name' && typeof value === 'string' && !isEditMode && !formData.slug) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      setFormData(prev => ({ ...prev, [field]: value, slug }));
    }
    if (formErrors[field]) {
      setFormErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      handleChange('tags', [...formData.tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    handleChange('tags', formData.tags.filter(t => t !== tag));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4"><Skeleton className="h-9 w-16" /><Skeleton className="h-8 w-48" /></div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" /><Skeleton className="h-40" />
          </div>
          <div className="space-y-6"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/products')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{isEditMode ? 'Edit Product' : 'Add Product'}</h1>
            <p className="text-muted-foreground text-sm">
              {isEditMode ? 'Update product information' : 'Create a new product listing'}
            </p>
          </div>
        </div>
        <Button onClick={() => handleSubmit()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isEditMode ? 'Update Product' : 'Create Product'}
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    placeholder="e.g., Wireless Headphones"
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                  />
                  {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea
                    placeholder="Describe your product..."
                    value={formData.description}
                    onChange={e => handleChange('description', e.target.value)}
                    rows={5}
                  />
                  {formErrors.description && <p className="text-xs text-destructive">{formErrors.description}</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>SKU *</Label>
                    <Input placeholder="e.g., WH-001" value={formData.sku} onChange={e => handleChange('sku', e.target.value)} />
                    {formErrors.sku && <p className="text-xs text-destructive">{formErrors.sku}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Slug *</Label>
                    <Input placeholder="e.g., wireless-headphones" value={formData.slug} onChange={e => handleChange('slug', e.target.value)} />
                    {formErrors.slug && <p className="text-xs text-destructive">{formErrors.slug}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Category *</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {formData.category
                          ? categories.find(c => c._id === formData.category)?.name || 'Select category'
                          : 'Select category'}
                        <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full">
                      {categories.map(cat => (
                        <DropdownMenuItem key={cat._id} onClick={() => handleChange('category', cat._id)}>
                          {cat.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {formErrors.category && <p className="text-xs text-destructive">{formErrors.category}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pricing & Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Regular Price *</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.price}
                      onChange={e => handleChange('price', parseFloat(e.target.value) || 0)} />
                    {formErrors.price && <p className="text-xs text-destructive">{formErrors.price}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Sale Price</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.salePrice || ''}
                      onChange={e => handleChange('salePrice', e.target.value ? parseFloat(e.target.value) : undefined)} />
                    {formErrors.salePrice && <p className="text-xs text-destructive">{formErrors.salePrice}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Stock Quantity *</Label>
                    <Input type="number" min="0" placeholder="0" value={formData.stock}
                      onChange={e => handleChange('stock', parseInt(e.target.value) || 0)} />
                    {formErrors.stock && <p className="text-xs text-destructive">{formErrors.stock}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pre-orders */}
            <PreorderEditor
              value={formData.preorder}
              onChange={(next) => handleChange('preorder', next)}
            />

            {/* Variants */}
            <VariantEditor
              hasVariants={!!formData.hasVariants}
              options={formData.options || []}
              variants={formData.variants || []}
              basePrice={formData.price}
              onChange={(next) => {
                setFormData((prev) => ({
                  ...prev,
                  hasVariants: next.hasVariants,
                  options: next.options,
                  variants: next.variants,
                }));
              }}
            />

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product Images</CardTitle>
                <CardDescription>Upload product images. First image will be the main image.</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  value={formData.images}
                  onChange={images => handleChange('images', Array.isArray(images) ? images : images ? [images] : [])}
                  multiple maxFiles={10} maxSizeMB={5}
                  label="Upload Images"
                  description="Drag & drop or click to upload (JPEG, PNG, WebP)"
                  accept="image/jpeg,image/png,image/webp"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <Badge variant={formData.status === 'active' ? 'default' : formData.status === 'archived' ? 'secondary' : 'outline'}>
                        {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
                      </Badge>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleChange('status', 'draft')}>Draft</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleChange('status', 'active')}>Active</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleChange('status', 'archived')}>Archived</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground mt-2">
                  {formData.status === 'draft' && 'Saved but not visible to customers'}
                  {formData.status === 'active' && 'Visible and available for purchase'}
                  {formData.status === 'archived' && 'Hidden from store'}
                </p>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="featured" className="cursor-pointer">Featured Product</Label>
                  <Switch
                    id="featured"
                    checked={formData.featured}
                    onCheckedChange={checked => handleChange('featured', checked)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Show in featured sections</p>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    className="flex-1"
                  />
                  <Button type="button" size="icon" variant="outline" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
};
