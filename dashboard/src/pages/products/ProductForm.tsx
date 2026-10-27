import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { CategoryPicker } from './CategoryPicker';
import { SpecificationsEditor, ContentSectionsEditor } from './ContentEditors';
import { SECTION_KEY_RE, type SpecRow, type ContentSectionRow } from './contentSections';
import { LinkSlugField } from '../../components/LinkSlugField';
import { useStorefrontHost } from '../../hooks/useStorefrontHost';
import { slugifyLink } from '../../lib/storeLink';
import { focusFieldById, focusFirstInvalid } from '../../lib/focusFirstInvalid';
import { useLanguageOrder } from '../../hooks/useLanguageOrder';
import { OwnPricesEditor } from './OwnPricesEditor';
import { useOtherCurrencies } from './ownPrices';
import {
  EMPTY_LANG_TEXT, isLangTextEmpty, langDir, readLangText, writeLangFields, writeLangText,
  type FieldLang, type LangText,
} from '../../lib/languageOrder';

// Wrapper of the variant editor, focused when variants are on but empty.
const VARIANTS_SECTION_ID = 'product-variants';

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

// Server validation payload. The backend returns descriptive per-field
// problems under `errors` (see middlewares/validate.js + errorHandler.js):
//   { message: "Validation failed", errors: [{ field: "body.description",
//     message: "Description must be at least 10 characters" }, ...] }
// Mongoose validation failures return `errors` as a plain string[] instead,
// so handle both shapes.
interface ServerFieldError { field?: string; message?: string }
interface ApiValidationPayload extends ApiErrorLike {
  errors?: Array<ServerFieldError | string>;
}

// Maps a server field path (after stripping the "body." prefix) onto the
// form field we can highlight inline. Anything not listed (variants, seo…)
// still surfaces in the toast text so the message is never just "failed".
const SERVER_FIELD_TO_FORM: Partial<Record<string, keyof ProductFormData>> = {
  name: 'name',
  description: 'description',
  price: 'price',
  compareAtPrice: 'salePrice',
  category: 'category',
  stock: 'stock',
  sku: 'sku',
  slug: 'slug',
  images: 'images',
};

// Turn a server validation payload into inline field errors + a flat list of
// every human-readable problem (for the toast). Returns empty when the error
// isn't a structured validation payload (network error, 500, etc.).
function parseServerValidation(err: unknown): {
  fieldErrors: Partial<Record<keyof ProductFormData, string>>;
  messages: string[];
} {
  const payload = err as ApiValidationPayload | null;
  const fieldErrors: Partial<Record<keyof ProductFormData, string>> = {};
  const messages: string[] = [];
  if (payload && Array.isArray(payload.errors)) {
    for (const entry of payload.errors) {
      if (typeof entry === 'string') {
        if (entry.trim()) messages.push(entry);
        continue;
      }
      const msg = entry?.message;
      if (!msg) continue;
      messages.push(msg);
      const rawField = (entry.field || '').replace(/^body\./, '').split('.')[0];
      const formKey = SERVER_FIELD_TO_FORM[rawField];
      if (formKey && !fieldErrors[formKey]) fieldErrors[formKey] = msg;
    }
  }
  return { fieldErrors, messages };
}

// Product text fields edited as one box per language.
type LangField = 'name' | 'shortDescription' | 'description';
// Their i18n key under products.form.field.
const LANG_FIELD_KEYS: Record<LangField, string> = {
  name: 'name', shortDescription: 'short_description', description: 'description',
};

// A content section is saved once it has a title and a text (in any language).
const sectionFilled = (s: ContentSectionRow) =>
  !isLangTextEmpty({ ar: s.titleAr, en: s.titleEn }) && !isLangTextEmpty({ ar: s.bodyAr, en: s.bodyEn });

export const ProductForm: React.FC = () => {
  const { t } = useTranslation(['products', 'common']);
  // Name, short description and description: one Arabic and one English
  // box each, the UI language's first. Base fields get the store language.
  const { sort: uiLanguageFirst, storeLang } = useLanguageOrder();
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
  // Product link: derived from the name (new products) or kept as stored
  // (existing ones — renaming never changes a shared link). The slug is only
  // sent when the merchant opened "Edit link"; the server normalises it with
  // the same rule as the preview (utils/slugify.js ↔ lib/storeLink.ts).
  const [slugEditing, setSlugEditing] = useState(false);
  const [savedSlug, setSavedSlug] = useState('');
  const [savedActive, setSavedActive] = useState(false);
  const storeHost = useStorefrontHost();
  const [tagInput, setTagInput] = useState('');
  // The per-language text, kept outside the strictly-typed ProductFormData.
  // Stored `name`/`description`/`shortDescription` + `translations.{ar,en}`
  // → one box per language (lib/languageOrder.ts); back on submit.
  const [text, setText] = useState<Record<LangField, LangText>>({
    name: EMPTY_LANG_TEXT, shortDescription: EMPTY_LANG_TEXT, description: EMPTY_LANG_TEXT,
  });
  const setLangText = (field: LangField, lang: FieldLang, value: string) => {
    setText(prev => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));
    if (field !== 'shortDescription' && formErrors[field]) {
      setFormErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };
  // Product-page content: key/value specifications and merchant-authored
  // blocks ("How to use", "Ingredients"…). Kept outside ProductFormData like
  // translations; flattened rows here → schema shape on submit.
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [contentSections, setContentSections] = useState<ContentSectionRow[]>([]);
  // Currencies the merchant can set their own prices in (Settings → Currencies).
  const otherCurrencies = useOtherCurrencies();

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
          prices: (product as { prices?: Record<string, number> | null }).prices || null,
        });
        setSavedSlug(product.slug || '');
        setSavedActive(product.status === 'active');
        // Product type doesn't model translations — read defensively.
        const stored = product as any;
        setText({
          name: readLangText(stored, 'name'),
          shortDescription: readLangText(stored, 'shortDescription'),
          description: readLangText(stored, 'description'),
        });
        setSpecs((product.specifications || []).map((s) => ({ key: s.key || '', value: s.value || '' })));
        setContentSections((product.contentSections || []).map((s) => {
          const title = readLangText(s, 'title');
          const body = readLangText(s, 'body');
          return { key: s.key || '', titleEn: title.en, titleAr: title.ar, bodyEn: body.en, bodyAr: body.ar, autoKey: false };
        }));
      }
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || t('products.toast.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ProductFormData, string>> = {};
    // Either language will do; the error shows on the store language's box.
    if (isLangTextEmpty(text.name)) errors.name = t('products.form.field.name.error.required');
    if (isLangTextEmpty(text.description)) errors.description = t('products.form.field.description.error.required');
    if (formData.price <= 0) errors.price = t('products.form.field.regular_price.error.positive');
    if (formData.salePrice && formData.salePrice >= formData.price) errors.salePrice = t('products.form.field.sale_price.error.less_than_price');
    if (!formData.sku.trim()) errors.sku = t('products.form.field.sku.error.required');
    if (!formData.category) errors.category = t('products.form.field.category.error.required');
    if (formData.stock < 0) errors.stock = t('products.form.field.stock.error.negative');

    // When variants are enabled, the matrix is the source of truth for
    // stock — but we still need at least one variant, otherwise the
    // product is unbuyable.
    if (formData.hasVariants) {
      if (!formData.variants || formData.variants.length === 0) {
        toast.error(t('products.toast.variants_missing'));
        focusFieldById(VARIANTS_SECTION_ID);
        return false;
      }
    }
    setFormErrors(errors);
    // Content sections: a filled section needs a valid, unique key.
    const filled = contentSections.filter(sectionFilled);
    const keys = filled.map((s) => s.key);
    if (filled.some((s) => !SECTION_KEY_RE.test(s.key)) || new Set(keys).size !== keys.length) {
      toast.error(t('products.form.content_sections.toast_invalid'));
      return false;
    }
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateForm()) {
      // Show the merchant where the problem is (a field or the content
      // sections; the variants case focuses its own section).
      focusFirstInvalid();
      return;
    }
    try {
      setSaving(true);
      // Each box saves to its own language's translation; the base fields
      // (the storefront's fallback) get the store language's text, or the
      // other language's when that one is empty.
      // Cast to any because ProductFormData doesn't model translations.
      const { slug, ...fields } = formData;
      const localized = writeLangFields(text, storeLang);
      const payload = {
        ...fields,
        ...localized.base,
        // Omitted unless edited: the server derives it (new) or keeps it (edit).
        ...(slugEditing && slug.trim() ? { slug } : {}),
        translations: localized.translations,
        // Empty rows are dropped.
        specifications: specs
          .map((s) => ({ key: s.key.trim(), value: s.value.trim() }))
          .filter((s) => s.key && s.value),
        contentSections: contentSections
          .filter(sectionFilled)
          .map((s) => {
            const title = writeLangText({ ar: s.titleAr, en: s.titleEn }, storeLang);
            const body = writeLangText({ ar: s.bodyAr, en: s.bodyEn }, storeLang);
            return {
              key: s.key,
              title: title.base,
              body: body.base,
              translations: { ar: { title: title.ar, body: body.ar }, en: { title: title.en, body: body.en } },
            };
          }),
      } as any;
      if (isEditMode && id) {
        await api.products.update(id, payload);
        toast.success(t('products.toast.updated'));
      } else {
        await api.products.create(payload);
        toast.success(t('products.toast.created'));
      }
      navigate('/dashboard/products');
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      const fallback = t(isEditMode ? 'products.toast.save_failed_update' : 'products.toast.save_failed_create');
      // Surface the backend's descriptive per-field validation messages
      // instead of the generic top-level "Validation failed". Field-level
      // problems are shown inline on the matching inputs; the toast lists
      // every problem so nothing (variants, images, seo…) is hidden.
      const { fieldErrors, messages } = parseServerValidation(err);
      if (messages.length > 0) {
        setFormErrors(prev => ({ ...prev, ...fieldErrors }));
        focusFirstInvalid();
        toast.error(messages.length === 1 ? messages[0] : `${fallback}: ${messages.join(' • ')}`);
      } else {
        toast.error(e?.message || fallback);
      }
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
    if (formErrors[field]) {
      setFormErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  // The link shown when not editing: stored (edit) or derived from the name (new).
  // Same source as the server (services/product.js): English name first.
  const autoSlug = isEditMode ? savedSlug : slugifyLink(text.name.en.trim() || text.name.ar.trim());
  // Server leaves a 301 from the old URL when a live product's link changes.
  const editedSlug = slugEditing ? slugifyLink(formData.slug) : '';
  const willRedirect = isEditMode && savedActive && Boolean(editedSlug) && editedSlug !== savedSlug;

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

  // One box per language for `field`, the UI language's first. Labels say
  // the language; the required marker and any error sit on the store
  // language's box (either language is accepted). Ids: `<idBase>` for
  // English, `<idBase>-ar` for Arabic.
  const renderLangPair = (
    field: LangField,
    opts: { idBase: string; error?: string; required?: boolean; multiline?: boolean },
  ) => uiLanguageFirst((['en', 'ar'] as const).map((lang) => {
    const id = lang === 'ar' ? `${opts.idBase}-ar` : opts.idBase;
    const keyBase = `products.form.field.${LANG_FIELD_KEYS[field]}`;
    const onStoreBox = lang === storeLang;
    const props = {
      id,
      dir: langDir(lang),
      lang,
      placeholder: t(`${keyBase}.placeholder_${lang}`),
      value: text[field][lang],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setLangText(field, lang, e.target.value),
      'aria-invalid': onStoreBox && opts.error ? true : undefined,
    };
    return {
      lang,
      node: (
        <div key={`${field}-${lang}`} className="space-y-2">
          <Label htmlFor={id}>
            {t(`${keyBase}.label_${lang}`)}{opts.required && onStoreBox ? ' *' : ''}
          </Label>
          {opts.multiline ? <Textarea rows={5} {...props} /> : <Input {...props} />}
          {onStoreBox && opts.error && <p className="text-xs text-destructive">{opts.error}</p>}
        </div>
      ),
    };
  })).map((f) => f.node);

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
      {/* Header: just back + title. The save action lives at the BOTTOM of
          the form (below), where it's reachable after filling everything in. */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Button variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => navigate('/dashboard/products')}>
          <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />{t('common:action.back')}
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{isEditMode ? t('products.form.title.edit') : t('products.form.title.create')}</h1>
          <p className="text-muted-foreground text-sm truncate">
            {isEditMode ? t('products.form.subtitle.edit') : t('products.form.subtitle.create')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('products.form.section.basic_info.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderLangPair('name', { idBase: 'product-name', error: formErrors.name, required: true })}

                <LinkSlugField
                  label={t('products.form.field.slug.label')}
                  host={storeHost}
                  pathPrefix="/products/"
                  autoSlug={autoSlug}
                  value={formData.slug}
                  editing={slugEditing}
                  onEditingChange={(editing) => {
                    setSlugEditing(editing);
                    // Start from the link shown; "automatic" drops the edit.
                    handleChange('slug', editing ? autoSlug : '');
                  }}
                  onChange={value => handleChange('slug', value)}
                  emptyText={t('products.form.field.slug.empty')}
                  helpText={t(isEditMode ? 'products.form.field.slug.help_edit' : 'products.form.field.slug.help_create')}
                  editLabel={t('products.form.field.slug.edit')}
                  resetLabel={isEditMode ? t('common:action.cancel') : t('products.form.field.slug.reset')}
                  editHelp={t('products.form.field.slug.edit_help')}
                  placeholder={t('products.form.field.slug.placeholder')}
                  note={willRedirect ? t('products.form.field.slug.redirect_note') : undefined}
                  error={formErrors.slug}
                />

                {renderLangPair('shortDescription', { idBase: 'product-short-description' })}

                {renderLangPair('description', {
                  idBase: 'product-description', error: formErrors.description, required: true, multiline: true,
                })}

                <div className="space-y-2">
                  <Label>{t('products.form.field.sku.label')}</Label>
                  <Input placeholder={t('products.form.field.sku.placeholder')} value={formData.sku} onChange={e => handleChange('sku', e.target.value)} aria-invalid={formErrors.sku ? true : undefined} />
                  {formErrors.sku && <p className="text-xs text-destructive">{formErrors.sku}</p>}
                </div>

                <div className="space-y-2">
                  <Label>{t('products.form.field.category.label')}</Label>
                  <CategoryPicker
                    value={formData.category}
                    onChange={id => handleChange('category', id)}
                    categories={categories}
                    onCategoryCreated={cat => setCategories(prev => [...prev, cat])}
                    invalid={Boolean(formErrors.category)}
                  />
                  {formErrors.category && <p className="text-xs text-destructive">{formErrors.category}</p>}
                </div>
              </CardContent>
            </Card>

            <SpecificationsEditor rows={specs} onChange={setSpecs} />
            <ContentSectionsEditor rows={contentSections} onChange={setContentSections} />

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('products.form.section.pricing.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{t('products.form.field.regular_price.label')}</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.price}
                      onChange={e => handleChange('price', parseFloat(e.target.value) || 0)} aria-invalid={formErrors.price ? true : undefined} />
                    {formErrors.price && <p className="text-xs text-destructive">{formErrors.price}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>{t('products.form.field.sale_price.label')}</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.salePrice || ''}
                      onChange={e => handleChange('salePrice', e.target.value ? parseFloat(e.target.value) : undefined)} aria-invalid={formErrors.salePrice ? true : undefined} />
                    {formErrors.salePrice && <p className="text-xs text-destructive">{formErrors.salePrice}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>{t('products.form.field.stock.label')}</Label>
                    <Input type="number" min="0" placeholder="0" value={formData.stock}
                      onChange={e => handleChange('stock', parseInt(e.target.value) || 0)} aria-invalid={formErrors.stock ? true : undefined} />
                    {formErrors.stock && <p className="text-xs text-destructive">{formErrors.stock}</p>}
                  </div>
                </div>
                <div className="mt-4">
                  <OwnPricesEditor
                    currencies={otherCurrencies}
                    basePrice={formData.price}
                    value={formData.prices}
                    onChange={(prices) => setFormData((prev) => ({ ...prev, prices }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pre-orders */}
            <PreorderEditor
              value={formData.preorder}
              onChange={(next) => handleChange('preorder', next)}
            />

            {/* Variants */}
            <div id={VARIANTS_SECTION_ID}>
              <VariantEditor
                hasVariants={!!formData.hasVariants}
                options={formData.options || []}
                variants={formData.variants || []}
                basePrice={formData.price}
                currencies={otherCurrencies}
                onChange={(next) => {
                  setFormData((prev) => ({
                    ...prev,
                    hasVariants: next.hasVariants,
                    options: next.options,
                    variants: next.variants,
                  }));
                }}
              />
            </div>

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('products.form.section.images.title')}</CardTitle>
                <CardDescription>{t('products.form.section.images.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  value={formData.images}
                  onChange={images => handleChange('images', Array.isArray(images) ? images : images ? [images] : [])}
                  multiple maxFiles={10} maxSizeMB={5}
                  label={t('products.form.image_upload.label')}
                  description={t('products.form.image_upload.description')}
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
                <CardTitle className="text-base">{t('products.form.section.status.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <Badge variant={formData.status === 'active' ? 'success' : formData.status === 'draft' ? 'info' : 'outline'}>
                        {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
                      </Badge>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                    <DropdownMenuItem onClick={() => handleChange('status', 'draft')}>{t('products.status.draft')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleChange('status', 'active')}>{t('products.status.active')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleChange('status', 'archived')}>{t('products.status.archived')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground mt-2">
                  {formData.status === 'draft' && t('products.form.status.draft_help')}
                  {formData.status === 'active' && t('products.form.status.active_help')}
                  {formData.status === 'archived' && t('products.form.status.archived_help')}
                </p>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('products.form.section.options.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="featured" className="cursor-pointer">{t('products.form.field.featured.label')}</Label>
                  <Switch
                    id="featured"
                    checked={formData.featured}
                    onCheckedChange={checked => handleChange('featured', checked)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('products.form.field.featured.help')}</p>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('products.form.section.tags.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder={t('products.form.field.tags.placeholder')}
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

        {/* Primary action at the bottom of the form — full-width on phones,
            right-aligned on desktop. */}
        <div className="mt-6 flex sm:justify-end">
          <Button type="submit" disabled={saving} size="lg" className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
            {isEditMode ? t('products.form.action.update') : t('products.form.action.create')}
          </Button>
        </div>
      </form>
    </div>
  );
};
