import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct } from '@shared/hooks/useProducts';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { VariantPicker, type Variant } from '@shared/components/commerce/VariantPicker';
import GuaranteedCheckout from '@shared/components/commerce/GuaranteedCheckout';
import { getPreorderState } from '@shared/utils/preorder';
import ProductReviews from '@shared/components/commerce/ProductReviews';
import ProductDescription from '@shared/components/commerce/ProductDescription';
import MilmaaProductCard from '../components/MilmaaProductCard';

const TEAL = 'var(--color-primary)';
const DARK_TEAL = 'var(--color-foreground)';
const PINK = 'var(--color-accent)';
const YELLOW = 'var(--color-secondary)';
const CREAM = 'var(--color-background)';
const MUTED = 'var(--color-muted)';
const HEADING_FONT = 'var(--font-family-heading)';

type TabKey = 'description' | 'ingredients' | 'reviews';

const ProductDetail: React.FC = () => {
  const { t } = useTranslation('theme');
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

  useEffect(() => {
    if (!activeVariant?.image || !product?.images) return;
    const idx = product.images.findIndex((s: string) => s === activeVariant.image);
    if (idx >= 0) setImgIdx(idx);
  }, [activeVariant?.image, product?.images]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-pulse">
          <div className="aspect-[3/4] rounded-[40px]" style={{ backgroundColor: MUTED }} />
          <div className="space-y-4">
            <div className="h-10 w-3/4 rounded" style={{ backgroundColor: MUTED }} />
            <div className="h-32 rounded" style={{ backgroundColor: MUTED }} />
          </div>
        </div>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-32 text-center" style={{ color: DARK_TEAL }}>
        <h1 className="font-serif text-5xl mb-4 font-semibold" style={{ fontFamily: HEADING_FONT }}>{t('theme.product_detail.not_found_heading')}</h1>
        <p className="opacity-60 mb-6">{t('theme.product_detail.not_found_body')}</p>
        <Link to="/products" className="inline-block px-8 py-3 rounded-full text-white text-sm font-bold" style={{ backgroundColor: DARK_TEAL }}>
          {t('theme.product_detail.back_to_shop')}
        </Link>
      </div>
    );
  }

  const images: string[] = product.images || [];
  const mainImage = images[imgIdx] || 'https://placehold.co/800x1000/f6dc68/2c4a4a?text=Milk';
  const price = activeVariant?.price ?? product.price ?? 0;
  const compareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const pct = onSale ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const inStock = (activeVariant?.stock ?? product.stock ?? 0) > 0;
  const rating = product.averageRating || 0;
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;
  const needsSelection = hasOptions && !activeVariant;

  // Pre-order state (centralised). A merchant-flagged pre-order product
  // always shows "Pre-order" — not "Add to Cart" — and exposes the
  // deposit/ship-by/discount labels below the CTA. When the reservation
  // cap is hit the button is disabled and re-labelled "Sold out".
  const preState = getPreorderState(product as any, activeVariant as any, {
    price: price,
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
    <div style={{ backgroundColor: CREAM }}>
      {/* Breadcrumb */}
      <div className="py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-[11px] tracking-[0.2em] uppercase font-bold" style={{ color: DARK_TEAL, opacity: 0.7 }}>
          <Link to="/" className="hover:opacity-100">{t('theme.products.breadcrumb_home')}</Link>
          <span className="mx-2">/</span>
          <Link to="/products" className="hover:opacity-100">{t('theme.products.breadcrumb_shop')}</Link>
          <span className="mx-2">/</span>
          <span>{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <div>
            <div
              className="aspect-[3/4] rounded-[40px] overflow-hidden relative"
            >
              <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
              {onSale && (
                <div className="absolute top-6 start-6">
                  <span className="inline-block px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-full text-white" style={{ backgroundColor: PINK }}>
                    -{pct}% {t('theme.product_card.sale', { defaultValue: 'SALE' })}
                  </span>
                </div>
              )}
              <div className="absolute bottom-6 end-6 w-24 h-24 rounded-full flex items-center justify-center text-center text-[10px] font-bold shadow-lg" style={{ backgroundColor: CREAM, color: DARK_TEAL }}>
                {t('theme.product_detail.badge_natural')}
              </div>
            </div>

            <div className="flex gap-3 mt-4 overflow-x-auto">
              {images.slice(0, 6).map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`w-20 aspect-square rounded-[20px] overflow-hidden shrink-0 transition ${i === imgIdx ? 'ring-2 ring-[var(--color-primary)]' : 'ring-1 ring-current/10'}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            {product.categories?.[0] && (
              <div className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: TEAL }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>
                {product.categories[0].name}
              </div>
            )}
            <h1
              className="font-serif text-4xl md:text-5xl leading-tight mb-4 font-semibold"
              style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}
            >
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex">
                {[1,2,3,4,5].map((i) => (
                  <svg key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? '' : 'opacity-30'}`} fill={YELLOW} viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs opacity-70" style={{ color: DARK_TEAL }}>
                ({reviews?.length || 0} {t('theme.product_detail.reviews_label', { defaultValue: 'reviews' })})
              </span>
            </div>

            {/* Price (pre-order discount reflected when active) */}
            <div className="flex items-baseline gap-4 mb-2">
              <span className="font-serif text-4xl font-bold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
                {formatPrice(effectivePrice)}
              </span>
              {(onSale || preState.savingsPct > 0) && (
                <>
                  <span className="text-lg line-through opacity-40" style={{ color: DARK_TEAL }}>
                    {formatPrice(preState.savingsPct > 0 ? price : compareAt)}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full text-white" style={{ backgroundColor: PINK }}>
                    {t('theme.product_detail.save_label', { defaultValue: 'Save' })} {formatPrice((preState.savingsPct > 0 ? price : compareAt) - effectivePrice)}
                  </span>
                </>
              )}
            </div>
            {isPreorder && preState.discountLabel && (
              <p className="text-xs font-semibold mb-4" style={{ color: DARK_TEAL }}>{preState.discountLabel}</p>
            )}

            {product.shortDescription && (
              <p className="text-base leading-relaxed mb-8" style={{ color: DARK_TEAL, opacity: 0.8 }}>
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
                  accentColor={TEAL}
                />
              </div>
            )}

            {/* Stock / pre-order status */}
            <div className="mb-5 text-xs font-medium">
              {isPreorder ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-amber-700">
                      {t('theme.product_detail.preorder_status', { defaultValue: 'Pre-order' })}{preState.shipByLabel ? ` — ${preState.shipByLabel.toLowerCase()}` : ''}
                    </span>
                  </div>
                  {preState.lowRemaining && preState.remaining !== null && (
                    <p className="mt-1 text-amber-700 font-semibold">{t('theme.product_detail.only_left', { remaining: preState.remaining, defaultValue: 'Only {{remaining}} left' })}</p>
                  )}
                  {preState.depositLabel && (
                    <p className="mt-1 text-amber-700">{preState.depositLabel}</p>
                  )}
                  {preState.policyNote && (
                    <p className="mt-1 opacity-70" style={{ color: DARK_TEAL }}>{preState.policyNote}</p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-600' : 'bg-red-500'}`} />
                  <span className={inStock ? 'text-green-700' : 'text-red-600'}>
                    {inStock ? t('theme.product_detail.in_stock') : preState.mode === 'soldOut' ? t('theme.product_detail.sold_out') : t('theme.product_detail.out_of_stock')}
                  </span>
                </div>
              )}
            </div>

            {/* Qty + buttons */}
            <div className="space-y-3 mb-6">
              <div className="flex gap-3">
                <div className="flex items-center rounded-full bg-white">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-11 h-12 text-lg rounded-s-full"
                    style={{ color: DARK_TEAL }}
                  >
                    −
                  </button>
                  <span className="w-11 text-center text-sm font-bold" style={{ color: DARK_TEAL }}>{qty}</span>
                  <button
                    onClick={() => setQty(qty + 1)}
                    className="w-11 h-12 text-lg rounded-e-full"
                    style={{ color: DARK_TEAL }}
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!canAddToCart}
                  className="flex-1 h-12 rounded-full text-white text-sm font-bold disabled:opacity-50 transition hover:scale-[1.02]"
                  style={{ backgroundColor: DARK_TEAL }}
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
              <button
                type="button"
                className="w-full h-12 rounded-full text-sm font-bold transition hover:scale-[1.02]"
                style={{ backgroundColor: PINK, color: DARK_TEAL }}
              >
                {t('theme.product_detail.save_to_wishlist')}
              </button>
            </div>

            <GuaranteedCheckout className="mt-6" />

            {/* Benefits */}
            <div className="space-y-3 pt-6 border-t border-current/10 text-sm" style={{ color: DARK_TEAL }}>
              {([
                [<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>, t('theme.product_detail.benefit_plant_based')],
                [<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0"><path d="M14 18V6a1 1 0 0 0-1-1H2v13" /><path d="M14 9h4l4 4v5h-2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>, t('theme.product_detail.benefit_free_shipping')],
                [<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>, t('theme.product_detail.benefit_returns')],
                [<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>, t('theme.product_detail.benefit_secure')],
              ] as [React.ReactNode, string][]).map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3">
                  {icon}
                  <span className="opacity-80">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-20">
          <div className="flex justify-center gap-3 flex-wrap">
            {([
              ['description', t('theme.product_detail.tab_description')],
              ['ingredients', t('theme.product_detail.tab_ingredients')],
              ['reviews', t('theme.product_detail.tab_reviews')],
            ] as [TabKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-6 py-3 rounded-full text-sm font-bold transition ${tab === k ? 'text-white' : 'bg-white hover:opacity-70'}`}
                style={{
                  backgroundColor: tab === k ? DARK_TEAL : undefined,
                  color: tab === k ? '#fff' : DARK_TEAL,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-3xl mx-auto pt-10 pb-16 text-base leading-relaxed" style={{ color: DARK_TEAL, opacity: 0.85 }}>
          {tab === 'description' && <ProductDescription product={product} />}
          {tab === 'ingredients' && (
            <p>{t('theme.product_detail.ingredients_body', { defaultValue: 'Filtered water, organic almonds, organic cane sugar, sea salt, calcium carbonate, vitamin D2, vitamin B12. Contains: tree nuts (almonds).' })}</p>
          )}
          {tab === 'reviews' && (
            <ProductReviews
              product={product}
              reviews={reviews}
              ratingDistribution={ratingDistribution}
              accentColor={TEAL}
            />
          )}
        </div>

        {/* Related */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section className="mt-20">
            <div className="text-center mb-12">
              <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
                {t('theme.product_detail.you_may_also_love')}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.slice(0, 4).map((p: any) => (
                <MilmaaProductCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
