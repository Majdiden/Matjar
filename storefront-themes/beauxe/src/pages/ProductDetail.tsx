import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProduct } from '@shared/hooks/useProducts';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { VariantPicker, type Variant } from '@shared/components/commerce/VariantPicker';
import GuaranteedCheckout from '@shared/components/commerce/GuaranteedCheckout';
import { getPreorderState } from '@shared/utils/preorder';
import ProductReviews from '@shared/components/commerce/ProductReviews';
import ProductDescription from '@shared/components/commerce/ProductDescription';
import BeauxeProductCard from '../components/BeauxeProductCard';

/**
 * Beauxe ProductDetail — pink/cream cosmetics product page.
 *
 *   breadcrumb on cream strip
 *   ┌──────────────────────┬─────────────────────────┐
 *   │  main image (3/4)    │  eyebrow · serif title  │
 *   │  (pink backdrop,     │  stars · price          │
 *   │   rounded)           │  short description      │
 *   │                      │  color/size pickers     │
 *   │  thumbs row          │  qty · ADD TO CART      │
 *   │                      │  ADD TO WISHLIST        │
 *   │                      │  benefit list           │
 *   └──────────────────────┴─────────────────────────┘
 *   tabs: description · ingredients · reviews
 *   You may also like
 */

const NAVY = 'var(--color-primary)';
const PINK = 'var(--color-secondary)';
const BLUSH = 'var(--color-muted)';
const CREAM = 'var(--color-accent)';

type TabKey = 'description' | 'how-to-use' | 'reviews';

const ProductDetail: React.FC = () => {
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
          <div className="aspect-[3/4] rounded-3xl bg-pink-100" />
          <div className="space-y-4">
            <div className="h-10 w-3/4 bg-pink-100 rounded" />
            <div className="h-32 bg-pink-100 rounded" />
          </div>
        </div>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-32 text-center" style={{ color: NAVY }}>
        <h1 className="font-serif text-5xl mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>Not Found</h1>
        <p className="opacity-60 mb-6">We couldn't find that product.</p>
        <Link to="/products" className="inline-block px-8 py-3 rounded-full text-white text-[11px] tracking-[0.22em] uppercase" style={{ backgroundColor: NAVY }}>
          Back to Shop
        </Link>
      </div>
    );
  }

  const images: string[] = product.images || [];
  const mainImage = images[imgIdx] || 'https://placehold.co/800x1000/f8e4e4/1d1d3b?text=Product';
  const price = activeVariant?.price ?? product.price ?? 0;
  const compareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const pct = onSale ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const inStock = (activeVariant?.stock ?? product.stock ?? 0) > 0;
  const rating = product.averageRating || 0;
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;
  const needsSelection = hasOptions && !activeVariant;
  // Pre-order state (centralised helper — identical across themes).
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
    <div style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Breadcrumb strip */}
      <div className="py-6" style={{ backgroundColor: CREAM }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-[11px] tracking-[0.2em] uppercase" style={{ color: NAVY, opacity: 0.7 }}>
          <Link to="/" className="hover:opacity-100">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/products" className="hover:opacity-100">Shop</Link>
          <span className="mx-2">/</span>
          <span style={{ color: NAVY, opacity: 1 }}>{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <div>
            <div
              className="aspect-[3/4] rounded-[40px] overflow-hidden relative"
            >
              <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
              {onSale && (
                <div className="absolute top-6 left-6">
                  <span className="inline-block px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-full text-white" style={{ backgroundColor: 'var(--color-error)' }}>
                    -{pct}% Sale
                  </span>
                </div>
              )}
            </div>

            {/* Thumbs */}
            <div className="flex gap-3 mt-4 overflow-x-auto">
              {images.slice(0, 6).map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`w-20 aspect-square rounded-2xl overflow-hidden shrink-0 transition ${i === imgIdx ? 'ring-2 ring-[color:var(--color-secondary)]' : 'ring-1 ring-pink-100'}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            {product.categories?.[0] && (
              <div className="text-[11px] tracking-[0.3em] uppercase font-semibold mb-3" style={{ color: PINK }}>
                {product.categories[0].name}
              </div>
            )}
            <h1
              className="font-serif text-4xl md:text-5xl leading-tight mb-4"
              style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}
            >
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex">
                {[1,2,3,4,5].map((i) => (
                  <svg key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? '' : 'opacity-30'}`} fill={PINK} viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs opacity-70" style={{ color: NAVY }}>
                ({reviews?.length || 0} reviews)
              </span>
            </div>

            {/* Price (pre-order discount reflected when active) */}
            <div className="flex items-baseline gap-4 mb-2">
              <span className="font-serif text-4xl font-bold" style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}>
                {formatPrice(effectivePrice)}
              </span>
              {(onSale || preState.savingsPct > 0) && (
                <>
                  <span className="text-lg line-through opacity-40" style={{ color: NAVY }}>
                    {formatPrice(preState.savingsPct > 0 ? price : compareAt)}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-error)' }}>
                    Save {formatPrice((preState.savingsPct > 0 ? price : compareAt) - effectivePrice)}
                  </span>
                </>
              )}
            </div>
            {isPreorder && preState.discountLabel && (
              <p className="text-xs font-semibold mb-4" style={{ color: 'var(--color-error)' }}>{preState.discountLabel}</p>
            )}

            {product.shortDescription && (
              <p className="text-sm leading-relaxed mb-8" style={{ color: NAVY, opacity: 0.8 }}>
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
                  accentColor={PINK}
                />
              </div>
            )}

            {/* Stock / pre-order */}
            <div className="mb-5 text-xs">
              {isPreorder ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-amber-700">
                      Pre-order{preState.shipByLabel ? ` — ${preState.shipByLabel.toLowerCase()}` : ''}
                    </span>
                  </div>
                  {preState.lowRemaining && preState.remaining !== null && (
                    <p className="mt-1 font-semibold text-amber-700">Only {preState.remaining} left</p>
                  )}
                  {preState.depositLabel && <p className="mt-1 text-amber-700">{preState.depositLabel}</p>}
                  {preState.policyNote && <p className="mt-1 opacity-70" style={{ color: NAVY }}>{preState.policyNote}</p>}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-600' : 'bg-red-500'}`} />
                  <span className={inStock ? 'text-green-700' : 'text-red-600'}>
                    {inStock ? 'In stock — ready to ship' : preState.mode === 'soldOut' ? 'Sold out' : 'Out of stock'}
                  </span>
                </div>
              )}
            </div>

            {/* Qty + buttons */}
            <div className="space-y-3 mb-6">
              <div className="flex gap-3">
                <div className="flex items-center rounded-full border-2" style={{ borderColor: NAVY }}>
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-11 h-12 text-lg rounded-l-full"
                    style={{ color: NAVY }}
                  >
                    −
                  </button>
                  <span className="w-11 text-center text-sm font-bold" style={{ color: NAVY }}>{qty}</span>
                  <button
                    onClick={() => setQty(qty + 1)}
                    className="w-11 h-12 text-lg rounded-r-full"
                    style={{ color: NAVY }}
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!canAddToCart}
                  className="flex-1 h-12 rounded-full text-white text-[11px] tracking-[0.22em] uppercase font-semibold disabled:bg-neutral-300 transition"
                  style={{ backgroundColor: NAVY }}
                >
                  {preState.ctaLabel}
                </button>
              </div>
              <button
                type="button"
                className="w-full h-12 rounded-full border-2 text-[11px] tracking-[0.22em] uppercase font-semibold transition hover:bg-[color:var(--color-primary)] hover:text-white"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                ♡ Add to Wishlist
              </button>
            </div>

            <GuaranteedCheckout className="mt-6" />

            {/* Benefits */}
            <div className="space-y-3 pt-6 border-t border-pink-100 text-xs" style={{ color: NAVY }}>
              {[
                ['🌿', 'Vegan · Cruelty-free · Paraben-free'],
                ['🚚', 'Free shipping on orders over $50'],
                ['↺', '30-day free returns'],
                ['🔒', 'Secure SSL checkout'],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="text-base">{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-20 border-b border-pink-100">
          <div className="flex justify-center gap-12">
            {([
              ['description', 'Description'],
              ['how-to-use', 'How to Use'],
              ['reviews', 'Reviews'],
            ] as [TabKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`pb-4 text-[11px] tracking-[0.22em] uppercase transition border-b-2 ${tab === k ? 'font-bold' : 'opacity-60 hover:opacity-100'}`}
                style={{
                  color: NAVY,
                  borderColor: tab === k ? PINK : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-3xl mx-auto pt-10 pb-16 text-sm leading-relaxed" style={{ color: NAVY, opacity: 0.85 }}>
          {tab === 'description' && <ProductDescription product={product} />}
          {tab === 'how-to-use' && (
            <p>Apply to clean, dry skin morning and night. Gently massage into face and neck, avoiding the eye area. Follow with moisturizer.</p>
          )}
          {tab === 'reviews' && (
            <ProductReviews
              product={product}
              reviews={reviews}
              ratingDistribution={ratingDistribution}
              accentColor={PINK}
            />
          )}
        </div>

        {/* You may also like */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section className="mt-20">
            <div className="text-center mb-12">
              <div className="text-[11px] tracking-[0.3em] uppercase font-semibold mb-3" style={{ color: PINK }}>
                YOU MAY ALSO LOVE
              </div>
              <h2 className="font-serif text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}>
                Complete the Routine
              </h2>
              <div className="w-16 h-[2px] mx-auto mt-5" style={{ backgroundColor: PINK }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.slice(0, 4).map((p: any) => (
                <BeauxeProductCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
