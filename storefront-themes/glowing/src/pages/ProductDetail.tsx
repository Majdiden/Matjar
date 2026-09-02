import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct } from '@matjar/theme-shared/hooks/useProducts';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { VariantPicker, type Variant } from '@matjar/theme-shared/components/commerce/VariantPicker';
import GuaranteedCheckout from '@matjar/theme-shared/components/commerce/GuaranteedCheckout';
import { getPreorderState } from '@matjar/theme-shared/utils/preorder';
import ProductReviews from '@matjar/theme-shared/components/commerce/ProductReviews';
import ProductDescription from '@matjar/theme-shared/components/commerce/ProductDescription';
import { useTemplateSections } from '@matjar/theme-shared/theme/ThemeProvider';
import { DEFAULT_SECTION_REGISTRY } from '@matjar/theme-shared/components/sections';
import { ProductProvider } from '@matjar/theme-shared/contexts/ProductContext';
import GlowingProductCard from '../components/GlowingProductCard';

/**
 * Glowing ProductDetail — minimalist editorial.
 *
 *   breadcrumb
 *   ┌───────────────┬─────────────────────────┐
 *   │  thumb rail   │  main image             │  INFO COLUMN
 *   │  (sticky)     │  (square, tinted)       │  · eyebrow · serif title
 *   │               │                         │  · stars · price
 *   │               │                         │  · short desc · color/size
 *   │               │                         │  · qty · BUY IT NOW (black)
 *   │               │                         │  · ADD TO WISHLIST (outline)
 *   │               │                         │  · compare/share row
 *   │               │                         │  · delivery info
 *   └───────────────┴─────────────────────────┘
 *   tabs: description · shipping & return · reviews
 *   You may also like (related products)
 */

type TabKey = 'description' | 'shipping' | 'reviews';

const ProductDetail: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { slug } = useParams<{ slug: string }>();
  const { product, reviews, relatedProducts, ratingDistribution, loading, error } = useProduct(slug!);
  const { formatPrice } = useStore();
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeVariant, setActiveVariant] = useState<Variant | null>(null);
  const [tab, setTab] = useState<TabKey>('description');

  const TAB_LABELS: Record<TabKey, string> = {
    description: t('theme.product_detail.tab_description'),
    shipping: t('theme.product_detail.tab_shipping'),
    reviews: t('theme.product_detail.tab_reviews'),
  };

  useEffect(() => {
    if (!activeVariant?.image || !product?.images) return;
    const idx = product.images.findIndex((s: string) => s === activeVariant.image);
    if (idx >= 0) setImgIdx(idx);
  }, [activeVariant?.image, product?.images]);

  const productSections = useTemplateSections('product');

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-pulse">
          <div className="aspect-square bg-neutral-100" />
          <div className="space-y-4">
            <div className="h-10 w-3/4 bg-neutral-100" />
            <div className="h-6 w-1/4 bg-neutral-100" />
            <div className="h-32 bg-neutral-100" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-32 text-center">
        <h1 className="font-display text-5xl mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>
          {t('theme.product_detail.not_found_title')}
        </h1>
        <p className="text-neutral-500 mb-6">{t('theme.product_detail.not_found_body')}</p>
        <Link to="/products" className="inline-block px-8 py-3 bg-black text-white text-[11px] tracking-[0.22em] uppercase">
          {t('theme.product_detail.back_to_shop')}
        </Link>
      </div>
    );
  }

  const images: string[] = product.images || [];
  const mainImage = images[imgIdx] || 'https://placehold.co/800x800/f7efe6/888?text=Product';
  const price = activeVariant?.price ?? product.price ?? 0;
  const compareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const inStock = (activeVariant?.stock ?? product.stock ?? 0) > 0;
  const rating = product.averageRating || 0;
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;
  const needsSelection = hasOptions && !activeVariant;
  // Pre-order state — variant wins over product, label derived by helper.
  const preState = getPreorderState(product as any, activeVariant as any, {
    price,
    requiresSelection: needsSelection,
    adding,
  });
  const isPreorder = preState.mode === 'preorder';
  const effectivePrice = preState.effectivePrice;
  const canAddToCart =
    (inStock || !!preState.config) && !adding && !needsSelection && !preState.ctaDisabled;

  const handleAdd = async () => {
    if (needsSelection) return;
    setAdding(true);
    try {
      await addItem(product._id, qty, activeVariant?._id);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white">
      {productSections.length > 0 && (
        <ProductProvider product={product} activeVariant={activeVariant}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
            {productSections.map((s) => {
              const Component = DEFAULT_SECTION_REGISTRY[s.type];
              if (!Component) return null;
              return <Component key={s.id} id={s.id} section={s} />;
            })}
          </div>
        </ProductProvider>
      )}

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-4">
        <div className="text-[11px] tracking-[0.2em] uppercase text-neutral-500">
          <Link to="/" className="hover:text-black">{t('theme.products.breadcrumb_home')}</Link>
          <span className="mx-2">/</span>
          <Link to="/products" className="hover:text-black">{t('theme.products.breadcrumb_shop')}</Link>
          <span className="mx-2">/</span>
          <span className="text-black">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[80px_1fr_420px] gap-8">
          {/* Sticky thumb rail */}
          <div className="hidden lg:flex flex-col gap-3 sticky top-32 self-start">
            {images.slice(0, 6).map((src, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className={`aspect-square overflow-hidden transition ${i === imgIdx ? 'ring-2 ring-black' : 'ring-1 ring-neutral-200 hover:ring-neutral-400'}`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Main image */}
          <div className="order-first lg:order-none">
            <div
              className="aspect-square overflow-hidden"
            >
              <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
            </div>

            {/* Mobile thumbs */}
            <div className="flex gap-2 mt-3 lg:hidden overflow-x-auto">
              {images.slice(0, 6).map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`w-16 aspect-square shrink-0 overflow-hidden ${i === imgIdx ? 'ring-2 ring-black' : 'ring-1 ring-neutral-200'}`}
                  >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Info column */}
          <div>
            {product.categories?.[0] && (
              <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-3">
                {product.categories[0].name}
              </div>
            )}
            <h1
              className="font-display text-4xl md:text-5xl text-black leading-tight mb-4"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i <= Math.round(rating) ? 'text-black' : 'text-neutral-300'}`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs text-neutral-500">{t('theme.product_detail.reviews_count', { count: reviews?.length || 0 })}</span>
            </div>

            {/* Price (pre-order discount reflected when active) */}
            <div className="flex items-baseline gap-4 mb-2">
              <span className="font-display text-3xl text-black" style={{ fontFamily: 'var(--font-family-heading)' }}>
                {formatPrice(effectivePrice)}
              </span>
              {(onSale || preState.savingsPct > 0) && (
                <>
                  <span className="text-neutral-400 line-through text-lg">
                    {formatPrice(preState.savingsPct > 0 ? price : compareAt)}
                  </span>
                  <span className="text-red-500 text-xs font-semibold uppercase tracking-wider">
                    {t('theme.product_detail.save', { amount: formatPrice((preState.savingsPct > 0 ? price : compareAt) - effectivePrice) })}
                  </span>
                </>
              )}
            </div>
            {isPreorder && preState.discountLabel && (
              <p className="text-xs font-semibold text-amber-700 mb-4">{preState.discountLabel}</p>
            )}

            {product.shortDescription && (
              <p className="text-sm text-neutral-600 leading-relaxed mb-8">
                {product.shortDescription}
              </p>
            )}

            {/* Variants */}
            {product.options && product.options.length > 0 && (
              <div className="mb-6">
                <VariantPicker
                  options={product.options}
                  variants={product.variants || []}
                  selection={selection}
                  onSelectionChange={setSelection}
                  onVariantChange={setActiveVariant}
                  accentColor="var(--color-primary)"
                />
              </div>
            )}

            {/* Stock / pre-order */}
            <div className="mb-6 text-xs">
              {isPreorder ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-amber-700">
                      {t('theme.product_detail.pre_order', { defaultValue: 'Pre-order' })}{preState.shipByLabel ? ` — ${preState.shipByLabel.toLowerCase()}` : ''}
                    </span>
                  </div>
                  {preState.lowRemaining && preState.remaining !== null && (
                    <p className="mt-1 font-semibold text-amber-700">{t('theme.product_detail.only_left', { count: preState.remaining, defaultValue: 'Only {{count}} left' })}</p>
                  )}
                  {preState.depositLabel && <p className="mt-1 text-amber-700">{preState.depositLabel}</p>}
                  {preState.policyNote && <p className="mt-1 text-neutral-500">{preState.policyNote}</p>}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-600' : 'bg-red-500'}`} />
                  <span className={inStock ? 'text-green-700' : 'text-red-600'}>
                    {inStock
                      ? t('theme.product_detail.in_stock')
                      : preState.mode === 'soldOut'
                        ? t('theme.product_detail.sold_out')
                        : t('theme.product_detail.out_of_stock')}
                  </span>
                </div>
              )}
            </div>

            {/* Qty + add buttons */}
            <div className="space-y-3 mb-6">
              <div className="flex gap-3">
                <div className="flex items-center border border-black">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-11 h-12 text-lg hover:bg-black hover:text-white transition"
                    aria-label={t('theme.product_detail.qty_decrease')}
                  >
                    −
                  </button>
                  <span className="w-11 text-center text-sm font-semibold">{qty}</span>
                  <button
                    onClick={() => setQty(qty + 1)}
                    className="w-11 h-12 text-lg hover:bg-black hover:text-white transition"
                    aria-label={t('theme.product_detail.qty_increase')}
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!canAddToCart}
                  className="flex-1 h-12 bg-black text-white text-[11px] tracking-[0.22em] uppercase font-semibold hover:bg-neutral-800 disabled:bg-neutral-300 transition"
                >
                  {needsSelection
                  ? t('product:card.options')
                  : preState.mode === 'soldOut'
                    ? t('product:card.sold_out')
                    : preState.mode === 'preorder'
                      ? (adding ? t('product:card.reserving') : t('product:card.preorder'))
                      : (adding ? t('product:card.adding') : t('product:card.add'))}
                </button>
              </div>

              {canAddToCart ? (
                <Link
                  to="/checkout"
                  onClick={handleAdd}
                  className="block w-full h-12 border border-black text-center leading-[3rem] text-[11px] tracking-[0.22em] uppercase font-semibold hover:bg-black hover:text-white transition"
                >
                  {t('theme.product_detail.buy_it_now')}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="block w-full h-12 border border-neutral-300 text-neutral-400 text-[11px] tracking-[0.22em] uppercase font-semibold cursor-not-allowed"
                >
                  {t('theme.product_detail.buy_it_now')}
                </button>
              )}
            </div>

            {/* Compare / wishlist / share row */}
            <div className="flex items-center justify-between text-[11px] tracking-[0.18em] uppercase text-neutral-600 border-t border-b border-neutral-100 py-4 mb-6">
              <button className="flex items-center gap-2 hover:text-black transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                {t('theme.product_detail.compare')}
              </button>
              <button className="flex items-center gap-2 hover:text-black transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                {t('theme.product_detail.wishlist')}
              </button>
              <button className="flex items-center gap-2 hover:text-black transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
                {t('theme.product_detail.share')}
              </button>
            </div>

            {/* Delivery info */}
            <div className="space-y-3 text-xs text-neutral-600">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9-1.5h10.5a1.5 1.5 0 001.5-1.5v-8.25a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v9.75l1.5 1.5zm12 1.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.5a1.5 1.5 0 001.5-1.5v-4.5l-3.75-3.75H15" />
                </svg>
                <span>{t('theme.product_detail.free_shipping')}</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('theme.product_detail.estimated_delivery')}</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('theme.product_detail.easy_returns')}</span>
              </div>
            </div>

            <GuaranteedCheckout className="mt-6" />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-24 border-b border-neutral-200">
          <div className="flex justify-center gap-10">
            {(Object.keys(TAB_LABELS) as TabKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`pb-4 text-[11px] tracking-[0.22em] uppercase transition border-b-2 ${tab === k ? 'border-black text-black font-semibold' : 'border-transparent text-neutral-500 hover:text-black'}`}
              >
                {TAB_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-3xl mx-auto pt-10 pb-16 text-sm text-neutral-700 leading-relaxed">
          {tab === 'description' && <ProductDescription product={product} />}
          {tab === 'shipping' && (
            <div className="space-y-4">
              <p>{t('theme.product_detail.shipping_tab_body1')}</p>
              <p>{t('theme.product_detail.shipping_tab_body2')}</p>
              <p>{t('theme.product_detail.shipping_tab_body3')}</p>
            </div>
          )}
          {tab === 'reviews' && (
            <ProductReviews
              product={product}
              reviews={reviews}
              ratingDistribution={ratingDistribution}
              accentColor="var(--color-primary)"
            />
          )}
        </div>

        {/* You may also like */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section className="mt-24">
            <div className="text-center mb-12">
              <h2 className="font-display text-4xl md:text-5xl text-black" style={{ fontFamily: 'var(--font-family-heading)' }}>
                {t('theme.product_detail.you_may_also_like')}
              </h2>
              <div className="w-12 h-px bg-black mx-auto mt-6" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-12">
              {relatedProducts.slice(0, 4).map((p: any) => (
                <GlowingProductCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
