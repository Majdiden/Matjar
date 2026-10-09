/**
 * Quick add product (PBI 10, "first sale" step 1). Route:
 * /dashboard/products/quick.
 *
 * Phone first, for a first-time seller: photos, name, price and how many
 * they have, with an optional description. The product is published at once
 * (POST /api/products/quick fills in the category, SKU and link), and the
 * merchant can share it straight away. Everything else (variants, SEO,
 * English text…) stays in the full form, one tap away.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { ImageUpload } from '../../components/ui/image-upload';
import { ShareButton } from '../../components/ShareButton';
import { useSetBreadcrumbs } from '../../contexts/breadcrumb-context';
import { useStorefrontHost } from '../../hooks/useStorefrontHost';
import { api } from '../../lib/api-client';
import { formatPrice, getTenantCurrency } from '../../lib/format';
import {
  QUICK_PRODUCT_DEFAULT_STOCK,
  QUICK_PRODUCT_LIMITS,
  parsePriceInput,
  parseQuantityInput,
  productLink,
  stepQuantity,
} from '../../lib/quickProduct';
import type { Product } from '../../types';

interface QuickProductResponse {
  responseObject?: { data?: Product };
}

interface ApiErrorLike { message?: string }

type FieldKey = 'name' | 'price' | 'quantity';

const EMPTY_FORM = {
  images: [] as string[],
  name: '',
  price: '',
  quantity: String(QUICK_PRODUCT_DEFAULT_STOCK),
  description: '',
};

export const QuickProduct: React.FC = () => {
  const { t } = useTranslation(['products', 'common']);
  const navigate = useNavigate();
  const storeHost = useStorefrontHost();
  const currency = getTenantCurrency();

  const [form, setForm] = useState(EMPTY_FORM);
  const [showDescription, setShowDescription] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Product | null>(null);

  useSetBreadcrumbs([
    { label: t('products:products.list.title'), href: '/dashboard/products' },
    { label: t('products:products.quick.title') },
  ]);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    const name = form.name.trim();
    const price = parsePriceInput(form.price);
    const stock = parseQuantityInput(form.quantity);
    if (!name) next.name = t('products:products.quick.name.required');
    if (price === null) next.price = t('products:products.quick.price.invalid');
    if (stock === null) next.quantity = t('products:products.quick.quantity.invalid');
    setErrors(next);
    return Object.keys(next).length ? null : { name, price: price as number, stock: stock as number };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = validate();
    if (!values || saving) return;
    setSaving(true);
    try {
      const description = form.description.trim();
      const res = (await api.products.createQuick({
        ...values,
        images: form.images,
        ...(description ? { description } : {}),
      })) as QuickProductResponse;
      const product = res.responseObject?.data;
      if (!product) throw new Error();
      setCreated(product);
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error((err as ApiErrorLike)?.message || t('products:products.quick.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const addAnother = () => {
    setCreated(null);
    setForm(EMPTY_FORM);
    setShowDescription(false);
    setErrors({});
  };

  if (created) {
    const url = productLink(storeHost, created.slug);
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 pb-24 lg:pb-8">
        <Card>
          <CardContent className="space-y-5 p-5 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Check className="h-7 w-7" strokeWidth={2.6} />
            </span>
            <div>
              <h1 className="text-xl font-semibold">{t('products:products.quick.done.title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('products:products.quick.done.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border p-3 text-start">
              {created.images?.[0] ? (
                <img src={created.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : null}
              <div className="min-w-0">
                <p className="truncate font-medium">{created.name}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(created.price, currency)}</p>
              </div>
            </div>
            {storeHost && (
              <ShareButton
                url={url}
                title={created.name}
                message={t('products:products.quick.done.share_message', { name: created.name })}
                className="h-12 w-full text-base"
              >
                {t('products:products.quick.done.share')}
              </ShareButton>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" className="h-12" onClick={addAnother}>
                <Plus className="h-4 w-4 me-2" />
                {t('products:products.quick.done.add_another')}
              </Button>
              <Button variant="outline" className="h-12" onClick={() => navigate('/dashboard')}>
                {t('products:products.quick.done.home')}
              </Button>
            </div>
            <Link
              to={`/dashboard/products/${created._id}/edit`}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary hover:underline"
            >
              {t('products:products.quick.done.edit_details')}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quantity = parseQuantityInput(form.quantity);

  return (
    <form onSubmit={submit} noValidate className="mx-auto w-full max-w-lg space-y-4 pb-24 lg:pb-8">
      <Link
        to="/dashboard"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />
        {t('products:products.quick.back')}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('products:products.quick.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('products:products.quick.subtitle')}</p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="space-y-2">
            <Label className="text-base">{t('products:products.quick.photos.label')}</Label>
            <ImageUpload
              value={form.images}
              onChange={(images) => set('images', Array.isArray(images) ? images : images ? [images] : [])}
              multiple
              maxFiles={QUICK_PRODUCT_LIMITS.imagesMax}
              maxSizeMB={5}
              description={t('products:products.quick.photos.help')}
              accept="image/jpeg,image/png,image/webp"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-name" className="text-base">{t('products:products.quick.name.label')}</Label>
            <Input
              id="quick-name"
              className="h-12 text-base"
              value={form.name}
              maxLength={QUICK_PRODUCT_LIMITS.nameMax}
              placeholder={t('products:products.quick.name.placeholder')}
              aria-invalid={Boolean(errors.name)}
              onChange={(e) => set('name', e.target.value)}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-price" className="text-base">{t('products:products.quick.price.label')}</Label>
            <div className="relative">
              <Input
                id="quick-price"
                className="h-12 pe-16 text-base"
                inputMode="decimal"
                autoComplete="off"
                value={form.price}
                placeholder={t('products:products.quick.price.placeholder')}
                aria-invalid={Boolean(errors.price)}
                onChange={(e) => set('price', e.target.value)}
              />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground">
                {currency}
              </span>
            </div>
            {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-quantity" className="text-base">{t('products:products.quick.quantity.label')}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 shrink-0 p-0"
                aria-label={t('products:products.quick.quantity.decrease')}
                onClick={() => set('quantity', String(stepQuantity(quantity, -1)))}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                id="quick-quantity"
                className="h-12 text-center text-base"
                inputMode="numeric"
                autoComplete="off"
                value={form.quantity}
                aria-invalid={Boolean(errors.quantity)}
                onChange={(e) => set('quantity', e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 shrink-0 p-0"
                aria-label={t('products:products.quick.quantity.increase')}
                onClick={() => set('quantity', String(stepQuantity(quantity, 1)))}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            {errors.quantity ? (
              <p className="text-sm text-destructive">{errors.quantity}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('products:products.quick.quantity.help')}</p>
            )}
          </div>

          {showDescription ? (
            <div className="space-y-2">
              <Label htmlFor="quick-description" className="text-base">{t('products:products.quick.description.label')}</Label>
              <Textarea
                id="quick-description"
                rows={4}
                className="text-base"
                value={form.description}
                maxLength={QUICK_PRODUCT_LIMITS.descriptionMax}
                placeholder={t('products:products.quick.description.placeholder')}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          ) : (
            <Button type="button" variant="ghost" className="h-11 px-2 text-primary" onClick={() => setShowDescription(true)}>
              <Plus className="h-4 w-4 me-1.5" />
              {t('products:products.quick.description.add')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
        {t('products:products.quick.submit')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('products:products.quick.full_form_hint')}{' '}
        <Link to="/dashboard/products/new" className="font-medium text-primary hover:underline">
          {t('products:products.quick.full_form_link')}
        </Link>
      </p>
    </form>
  );
};
