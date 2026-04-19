import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct } from '@shared/hooks/useProducts';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { VariantPicker, type Variant } from '@shared/components/commerce/VariantPicker';
import GuaranteedCheckout from '@shared/components/commerce/GuaranteedCheckout';
import ProductReviews from '@shared/components/commerce/ProductReviews';
import ProductDescription from '@shared/components/commerce/ProductDescription';
import { ImageZoom } from '@shared/components/commerce/ImageZoom';
import { SocialShare } from '@shared/components/marketing/SocialShare';
import { PreorderBadge } from '@shared/components/commerce/PreorderBadge';
import { getPreorderState } from '@shared/utils/preorder';
import NutrekoProductCard from '../components/NutrekoProductCard';

const LIME = 'var(--color-primary)';
const DARK = 'var(--color-secondary)';
const ORANGE = 'var(--color-accent)';
const ERROR = 'var(--color-error)';
const headingFont = { fontFamily: 'var(--font-family-heading)' } as const;

type TabKey = 'description' | 'nutrition' | 'reviews';

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
          <div className="aspect-square bg-neutral-100 border-2 border-black" />
          <div className="space-y-4">
            <div className="h-10 w-3/4 bg-neutral-100" />
            <div className="h-32 bg-neutral-100" />
          </div>
        </div>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-32 text-center">
        <h1 className="font-display text-6xl uppercase mb-4" style={headingFont}>{t('theme.product_detail.not_found_heading')}</h1>
        <p className="opacity-60 mb-6">{t('theme.product_detail.not_found_body')}</p>
        <Link to="/products" className="inline-block px-8 py-3 text-[11px] tracking-[0.22em] uppercase font-black border-2 border-black hover:text-black" style={{ backgroundColor: DARK, color: '#fff' }}>
          {t('theme.product_detail.back_to_shop')}
        </Link>
      </div>
    );
  }

  const images: string[] = product.images || [];
  const mainImage = images[imgIdx] || 'https://placehold.co/800x800/f5f5f5/0a0a0a?text=Product';
  const price = activeVariant?.price ?? product.price ?? 0;
  const compareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const pct = onSale ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const inStock = (activeVariant?.stock ?? product.stock ?? 0) > 0;
  const rating = product.averageRating || 0;
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;
  const needsSelection = hasOptions && !activeVariant;
  // Preorder-aware CTA. When a pre-order config is active we fall through
  // the out-of-stock check so the Pre-order flow can still reserve units.
  const preorder = getPreorderState(product as any, activeVariant as any, {
    price,
    requiresSelection: needsSelection,
    adding,
    buyLabel: t('theme.product_detail.add_to_cart'),
  });
  const isPreorder = preorder.mode === 'preorder';
  const canAddToCart =
    !adding && !needsSelection && !preorder.ctaDisabled && (inStock || isPreorder);
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
      {/* Breadcrumb */}
      <div className="bg-black text-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-[11px] tracking-[0.2em] uppercase font-bold">
          <Link to="/" className="hover:text-[var(--color-primary)] opacity-70">{t('theme.category.breadcrumb_home')}</Link>
          <span className="mx-2 opacity-50">/</span>
          <Link to="/products" className="hover:text-[var(--color-primary)] opacity-70">{t('theme.category.breadcrumb_shop')}</Link>
          <span className="mx-2 opacity-50">/</span>
          <span>{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <div>
            <div className="aspect-square border-2 border-black relative overflow-hidden">
              <ImageZoom src={mainImage} alt={product.name} fit="cover" className="w-full h-full" />
              {onSale && (
                <div className="absolute top-4 start-4">
                  <span className="inline-block px-4 py-2 text-[11px] font-black tracking-wider uppercase text-white" style={{ backgroundColor: ERROR }}>
                    -{pct}% OFF
                  </span>
                </div>
              )}
              <div className="absolute top-4 end-4">
                {isPreorder ? (
                  <span className="inline-block px-4 py-2 text-[11px] font-black tracking-wider uppercase text-white" style={{ backgroundColor: ORANGE }}>
                    {t('theme.product_detail.pre_order')}
                  </span>
                ) : (
                  <span className="inline-block px-4 py-2 text-[11px] font-black tracking-wider uppercase" style={{ backgroundColor: LIME, color: DARK }}>
                    {t('theme.product_detail.in_stock_badge')}
                  </span>
                )}
              </div>
            </div>

            {/* Thumbs */}
            <div className="flex gap-3 mt-4 overflow-x-auto">
              {images.slice(0, 6).map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`w-20 aspect-square shrink-0 overflow-hidden transition ${i === imgIdx ? 'border-2 border-black' : 'border-2 border-black/20 hover:border-black/60'}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            {product.categories?.[0] && (
              <div className="text-[11px] tracking-[0.3em] uppercase font-black mb-3" style={{ color: ORANGE }}>
                {product.categories[0].name}
              </div>
            )}
            <h1 className="font-display text-4xl md:text-5xl uppercase leading-[0.95] mb-4" style={headingFont}>
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex">
                {[1,2,3,4,5].map((i) => (
                  <svg key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? '' : 'opacity-20'}`} fill={LIME} viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs font-bold opacity-70">
                ({reviews?.length || 0} REVIEWS)
              </span>
            </div>

            {/* Preorder badge */}
            {isPreorder && (
              <div className="mb-4">
                <PreorderBadge product={product} variant={activeVariant} accentColor={ORANGE} className="rounded-none px-3 py-1 text-[11px] border-2 border-black" />
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-4 mb-6 p-4 bg-[var(--color-muted)] border-2 border-black">
              <span className="font-display text-4xl" style={headingFont}>
                {formatPrice(price)}
              </span>
              {onSale && (
                <>
                  <span className="text-lg line-through opacity-40 font-bold">{formatPrice(compareAt)}</span>
                  <span className="text-xs font-black uppercase tracking-wider px-2 py-1 text-white" style={{ backgroundColor: ERROR }}>
                    SAVE {formatPrice(compareAt - price)}
                  </span>
                </>
              )}
            </div>

            {product.shortDescription && (
              <p className="text-sm leading-relaxed mb-6 opacity-80">
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
                  accentColor={LIME}
                />
              </div>
            )}

            {/* Stock indicator */}
            <div className="flex items-center gap-2 mb-5 text-xs font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 ${inStock ? 'bg-[var(--color-primary)]' : 'bg-red-500'}`} />
              <span className={inStock ? 'text-black' : 'text-red-600'}>
                {inStock ? t('theme.product_detail.in_stock_ships') : t('theme.product_detail.out_of_stock')}
              </span>
            </div>

            {/* Qty + buttons */}
            <div className="space-y-3 mb-6">
              <div className="flex gap-3">
                <div className="flex items-center border-2 border-black">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-11 h-14 text-lg font-black hover:bg-[var(--color-primary)]"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-base font-black">{qty}</span>
                  <button
                    onClick={() => setQty(qty + 1)}
                    className="w-11 h-14 text-lg font-black hover:bg-[var(--color-primary)]"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!canAddToCart}
                  className="flex-1 h-14 text-[12px] tracking-[0.22em] uppercase font-black border-2 border-black disabled:opacity-50 transition"
                  style={{ backgroundColor: ORANGE, color: '#fff' }}
                >
                  {adding ? t('theme.product_detail.adding') : needsSelection ? t('theme.product_detail.select_options') : t('theme.product_detail.add_to_cart')}
                </button>
              </div>
              <button
                type="button"
                className="w-full h-14 border-2 border-black text-[12px] tracking-[0.22em] uppercase font-black hover:text-black transition"
                style={{ backgroundColor: DARK, color: '#fff' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = LIME; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = DARK; }}
              >
                {t('theme.product_detail.buy_now')}
              </button>
            </div>

            <GuaranteedCheckout className="mt-6" />

            {/* Share */}
            <div className="flex items-center gap-4 pt-5 pb-5 border-t-2 border-black">
              <span className="text-[11px] tracking-[0.22em] uppercase font-black">{t('theme.product_detail.share_label')}</span>
              <SocialShare
                url={typeof window !== 'undefined' ? window.location.href : ''}
                title={product.name}
                description={product.shortDescription}
                size="sm"
              />
            </div>

            {/* Trust/benefits */}
            <div className="grid grid-cols-2 gap-3 pt-6 border-t-2 border-black text-xs font-bold uppercase tracking-wider">
              {[
                ['🚚', t('theme.product_detail.benefit_shipping')],
                ['🔒', t('theme.product_detail.benefit_secure')],
                ['↺', t('theme.product_detail.benefit_returns')],
                ['🏆', t('theme.product_detail.benefit_authentic')],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-2">
                  <span className="text-base">{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-20 border-y-2 border-black">
          <div className="flex">
            {([
              ['description', t('theme.product_detail.tab_description')],
              ['nutrition', t('theme.product_detail.tab_nutrition')],
              ['reviews', t('theme.product_detail.tab_reviews')],
            ] as [TabKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 py-5 text-[11px] tracking-[0.22em] uppercase font-black transition border-e-2 border-black last:border-e-0 ${tab === k ? 'bg-black text-white' : 'hover:bg-[var(--color-primary)]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-3xl mx-auto pt-10 pb-16 text-sm leading-relaxed opacity-85">
          {tab === 'description' && <ProductDescription product={product} />}
          {tab === 'nutrition' && (
            <div className="space-y-4">
              <h3 className="font-display text-2xl uppercase" style={headingFont}>{t('theme.product_detail.nutrition_heading')}</h3>
              <div className="border-2 border-black">
                {[
                  ['Serving Size', '1 Scoop (30g)'],
                  ['Calories', '120'],
                  ['Protein', '24g'],
                  ['Carbs', '3g'],
                  ['Fat', '1.5g'],
                  ['BCAAs', '5.5g'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between p-3 border-b border-black last:border-b-0 font-bold">
                    <span>{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'reviews' && (
            <ProductReviews
              product={product}
              reviews={reviews}
              ratingDistribution={ratingDistribution}
              accentColor={LIME}
            />
          )}
        </div>

        {/* Related */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section className="mt-20">
            <div className="flex items-end justify-between mb-10 border-b-2 border-black pb-5">
              <h2 className="font-display text-4xl md:text-5xl uppercase" style={headingFont}>
                {t('theme.product_detail.you_may_also_like')}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {relatedProducts.slice(0, 4).map((p: any) => (
                <NutrekoProductCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
