/**
 * ProductDetail — TONMART-style product page.
 *
 * Layout:
 *   breadcrumb
 *   ┌────────────────────────┬──────────────────────────┐
 *   │  main image            │  title · rating          │
 *   │                        │  price                   │
 *   │                        │  short description       │
 *   │  thumb  thumb  thumb   │  color swatches          │
 *   │                        │  size pills              │
 *   │                        │  quantity + ADD TO BAG   │
 *   │                        │  BUY IT NOW (dark pill)  │
 *   │                        │  share · ask · faq       │
 *   │                        │  guaranteed checkout     │
 *   └────────────────────────┴──────────────────────────┘
 *   tabs: description · delivery · shipping · custom
 *   related / frequently bought together
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProduct } from '@matjar/theme-shared/hooks/useProducts';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useTranslation } from 'react-i18next';
import ProductDetailExtras from '@matjar/theme-shared/components/commerce/ProductDetailExtras';
import GuaranteedCheckout from '@matjar/theme-shared/components/commerce/GuaranteedCheckout';
import { VariantPicker, type Variant } from '@matjar/theme-shared/components/commerce/VariantPicker';
import { ImageZoom } from '@matjar/theme-shared/components/commerce/ImageZoom';
import { SocialShare } from '@matjar/theme-shared/components/marketing/SocialShare';
import { useCompare } from '@matjar/theme-shared/components/commerce/ProductCompare';
import { getPreorderState } from '@matjar/theme-shared/utils/preorder';

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const {
    product,
    reviews,
    relatedProducts,
    frequentlyBoughtWith,
    ratingDistribution,
    loading,
    error,
  } = useProduct(slug!);
  const { formatPrice } = useStore();
  const { addItem } = useCart();
  const compare = useCompare();
  const { t } = useTranslation(['theme']);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [variantSelection, setVariantSelection] = useState<Record<string, string>>({});
  const [activeVariant, setActiveVariant] = useState<Variant | null>(null);
  // Jump the gallery to a variant's image when the shopper picks one.
  useEffect(() => {
    if (!activeVariant?.image || !product?.images) return;
    const idx = product.images.findIndex((src: string) => src === activeVariant.image);
    if (idx >= 0) setSelectedImage(idx);
  }, [activeVariant?.image, product?.images]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="animate-pulse rounded-lg aspect-square" style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 5%, transparent)' }} />
          <div className="space-y-4">
            <div className="animate-pulse h-8 w-3/4 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 5%, transparent)' }} />
            <div className="animate-pulse h-6 w-1/4 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 5%, transparent)' }} />
            <div className="animate-pulse h-32 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 5%, transparent)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-foreground)' }}>{t('theme.product_detail.product_not_found')}</h2>
        <Link to="/products" className="text-sm underline" style={{ color: 'var(--color-primary)' }}>
          {t('theme.product_detail.back_to_shop')}
        </Link>
      </div>
    );
  }

  // Variant-aware derived state — variants own price/stock when present.
  const hasVariants = Boolean(product.hasVariants || product.variants?.length || product.options?.length);
  const displayPrice =
    activeVariant && typeof activeVariant.price === 'number' ? activeVariant.price : product.price;
  const displayCompareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice;
  const displayStock = hasVariants ? (activeVariant?.stock ?? 0) : product.stock;
  const requiresVariantSelection = hasVariants && !activeVariant;

  // Pre-order state (centralised helper — identical across themes).
  const preState = getPreorderState(product as any, activeVariant as any, {
    price: displayPrice,
    requiresSelection: requiresVariantSelection,
    adding,
    buyLabel: t('theme.product_detail.add_to_bag', { defaultValue: 'Add to Bag' }),
  });
  const isPreorder = preState.mode === 'preorder';
  const isPreorderable = isPreorder;
  const shipDateLabel = preState.shipByLabel
    ? preState.shipByLabel.replace(/^Ships by\s+/i, '')
    : null;
  const canAddToCart =
    !adding && !requiresVariantSelection && !preState.ctaDisabled && (displayStock > 0 || isPreorder);
  // Honour per-customer / remaining caps. `null` means uncapped.
  const qtyCap = (() => {
    const caps: number[] = [];
    const cfg = preState.config;
    if (cfg) {
      if (typeof cfg.maxPerCustomer === 'number' && cfg.maxPerCustomer > 0) caps.push(cfg.maxPerCustomer);
      if (typeof preState.remaining === 'number' && preState.remaining > 0) caps.push(preState.remaining);
    }
    if (!isPreorder && displayStock > 0) caps.push(displayStock);
    return caps.length ? Math.min(...caps) : null;
  })();

  const handleAddToCart = async () => {
    if (requiresVariantSelection) return;
    setAdding(true);
    try {
      await addItem(product._id, quantity, activeVariant?._id);
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const images: string[] = product.images?.length > 0 ? product.images : ['https://placehold.co/600x600?text=No+Image'];
  const discount = displayCompareAt && displayCompareAt > displayPrice
    ? Math.round((1 - displayPrice / displayCompareAt) * 100)
    : 0;

  const rating = Number(product.averageRating || 0);
  const reviewCount = Number(product.reviewCount || reviews?.length || 0);

  return (
    <div style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Breadcrumb strip */}
      <div className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <nav className="text-xs" style={{ color: 'var(--color-muted)' }}>
            <Link to="/" className="hover:opacity-70">{t('theme.product_detail.breadcrumb_home')}</Link>
            <span className="mx-2">•</span>
            <Link to="/products" className="hover:opacity-70">{t('theme.product_detail.breadcrumb_products')}</Link>
            <span className="mx-2">•</span>
            <span style={{ color: 'var(--color-foreground)' }}>{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14">
          {/* ── Gallery ────────────────────────────────────────── */}
          <div>
            <div
              className="aspect-square rounded-lg overflow-hidden mb-4"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, transparent)' }}
            >
              <ImageZoom
                src={images[selectedImage]}
                alt={product.name}
                fit="cover"
                className="w-full h-full"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {images.map((img: string, i: number) => {
                  const isActive = i === selectedImage;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className="relative flex-none w-20 h-20 rounded-md overflow-hidden transition"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, transparent)',
                      }}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      {isActive && (
                        <span
                          className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-8"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Product info ──────────────────────────────────── */}
          <div>
            {product.brand && (
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-primary)' }}>
                {product.brand}
              </p>
            )}
            <h1 className="text-2xl md:text-3xl font-black mb-3 leading-tight" style={{ color: 'var(--color-foreground)' }}>
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className="w-4 h-4"
                    fill={i < Math.round(rating) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    style={{ color: i < Math.round(rating) ? 'var(--color-accent)' : 'var(--color-border)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.4 4.86 5.37.78-3.88 3.78.92 5.35L11.48 15.77 6.67 18.27l.92-5.35L3.71 9.14l5.37-.78 2.4-4.86z" />
                  </svg>
                ))}
              </div>
              <button
                onClick={() => document.querySelector('[data-reviews-anchor]')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[11px] font-bold uppercase tracking-wider hover:opacity-70"
                style={{ color: 'var(--color-muted)' }}
              >
                {t('theme.nav.view_all_reviews', { count: reviewCount })}
              </button>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-3xl font-black" style={{ color: 'var(--color-foreground)' }}>
                {formatPrice(displayPrice)}
              </span>
              {discount > 0 && (
                <>
                  <span className="text-lg line-through" style={{ color: 'var(--color-muted)' }}>
                    {formatPrice(displayCompareAt)}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    -{discount}%
                  </span>
                </>
              )}
              {isPreorder && (
                <span
                  className="text-xs font-bold px-2 py-1 rounded uppercase tracking-wider"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {t('theme.product_detail.preorder')}
                </span>
              )}
            </div>

            {/* Short description */}
            {(product.shortDescription || product.description) && (
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-muted)' }}>
                {product.shortDescription || String(product.description).slice(0, 220)}
              </p>
            )}

            {/* Variant picker (color swatches + size pills when schemas supply them) */}
            {hasVariants && (
              <VariantPicker
                options={product.options || []}
                variants={(product.variants || []) as Variant[]}
                selection={variantSelection}
                onSelectionChange={setVariantSelection}
                onVariantChange={setActiveVariant}
                accentColor="var(--color-primary)"
                className="mb-6"
              />
            )}

            {/* Stock indicator */}
            {requiresVariantSelection ? (
              <p className="text-xs mb-5" style={{ color: 'var(--color-muted)' }}>
                {t('theme.product_detail.select_option')}
              </p>
            ) : displayStock > 0 ? (
              <p className="text-xs mb-5 font-semibold" style={{ color: 'var(--color-primary)' }}>
                ● {t('theme.product_detail.in_stock', { count: displayStock })}
              </p>
            ) : isPreorderable ? (
              <p className="text-xs mb-5 font-semibold" style={{ color: 'var(--color-accent)' }}>
                ● {t('theme.product_detail.preorder')}{shipDateLabel ? ` — ${shipDateLabel}` : ''}
              </p>
            ) : (
              <p className="text-xs mb-5 font-semibold" style={{ color: 'var(--color-error)' }}>
                ● {t('theme.product_detail.out_of_stock')}
              </p>
            )}

            {/* Quantity + CTAs */}
            {!requiresVariantSelection && (displayStock > 0 || isPreorder) && (
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center border rounded-full"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-4 py-2 text-lg hover:opacity-70"
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      −
                    </button>
                    <span className="px-4 py-2 min-w-[3ch] text-center font-semibold" style={{ color: 'var(--color-foreground)' }}>
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => (qtyCap !== null ? Math.min(qtyCap, q + 1) : q + 1))}
                      className="px-4 py-2 text-lg hover:opacity-70"
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    disabled={!canAddToCart}
                    className="flex-1 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition hover:-translate-y-0.5 disabled:opacity-50 border"
                    style={{
                      borderColor: 'var(--color-foreground)',
                      color: 'var(--color-foreground)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    {preState.mode === 'preorder'
                      ? (adding ? t('product:card.reserving') : t('product:card.preorder'))
                      : (adding ? t('product:card.adding') : t('product:card.add'))}
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={adding}
                  className="w-full py-3 rounded-full text-xs font-bold uppercase tracking-wider text-white transition hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-foreground)' }}
                >
                  {t('theme.nav.buy_now') || 'Buy it now'}
                </button>
              </div>
            )}

            {/* Share · Ask · FAQ row */}
            <div
              className="flex items-center gap-6 py-4 border-y text-[11px] font-bold uppercase tracking-wider mb-6 flex-wrap"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              <div className="flex items-center gap-2">
                <span>{t('theme.nav.share')}</span>
                <SocialShare
                  url={typeof window !== 'undefined' ? window.location.href : ''}
                  title={product.name}
                  description={product.shortDescription || ''}
                  size="sm"
                  platforms={['facebook', 'twitter', 'pinterest', 'whatsapp', 'copy']}
                />
              </div>
              <button
                onClick={() => (compare.isComparing(product._id) ? compare.remove(product._id) : compare.add(product))}
                className="flex items-center gap-1.5 hover:opacity-70"
                style={{ color: compare.isComparing(product._id) ? 'var(--color-primary)' : undefined }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
                </svg>
                {compare.isComparing(product._id) ? t('theme.nav.comparing') : t('theme.nav.compare')}
              </button>
              <button className="flex items-center gap-1.5 hover:opacity-70">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {t('theme.nav.ask_question')}
              </button>
              <button className="flex items-center gap-1.5 hover:opacity-70">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('theme.nav.faq')}
              </button>
            </div>

            <GuaranteedCheckout className="" />

            {/* SKU */}
            {product.sku && (
              <p className="mt-4 text-xs" style={{ color: 'var(--color-muted)' }}>
                {t('theme.product_detail.sku_label', { defaultValue: 'SKU:' })} <span style={{ color: 'var(--color-foreground)' }}>{product.sku}</span>
              </p>
            )}
          </div>
        </div>

        {/* Rich extras (tabs, FBT, related, reviews) — provided by theme slot */}
        <ProductDetailExtras
          product={product}
          reviews={reviews}
          ratingDistribution={ratingDistribution}
          frequentlyBoughtWith={frequentlyBoughtWith}
          relatedProducts={relatedProducts}
        />
      </div>
    </div>
  );
};

export default ProductDetail;
