import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct } from '@shared/hooks/useProducts';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useToast } from '@shared/components/primitives/Toast';
import { PriceDisplay } from '@shared/components/commerce/PriceDisplay';
import { QuantitySelector } from '@shared/components/commerce/QuantitySelector';
import { RatingStars } from '@shared/components/commerce/RatingStars';
import { WishlistButton } from '@shared/components/commerce/WishlistButton';
import { ImageZoom } from '@shared/components/commerce/ImageZoom';
import { ProductCompare } from '@shared/components/commerce/ProductCompare';
import { Breadcrumbs } from '@shared/components/navigation/Breadcrumbs';
import { SocialShare } from '@shared/components/marketing/SocialShare';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import ProductDetailExtras from '@shared/components/commerce/ProductDetailExtras';
import GuaranteedCheckout from '@shared/components/commerce/GuaranteedCheckout';
import { VariantPicker, type Variant } from '@shared/components/commerce/VariantPicker';
import { getPreorderState } from '@shared/utils/preorder';
import { useTemplateSections } from '@shared/theme/ThemeProvider';
import { DEFAULT_SECTION_REGISTRY } from '@shared/components/sections';

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
  const { t } = useTranslation('theme');
  const { formatPrice } = useStore();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [variantSelection, setVariantSelection] = useState<Record<string, string>>({});
  const [activeVariant, setActiveVariant] = useState<Variant | null>(null);

  // When a variant has a dedicated image, jump the gallery to it
  useEffect(() => {
    if (!activeVariant?.image || !product?.images) return;
    const idx = product.images.findIndex((src: string) => src === activeVariant.image);
    if (idx >= 0) setSelectedImage(idx);
  }, [activeVariant?.image, product?.images]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Skeleton height="h-4" width="w-64" className="mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <Skeleton height="h-[500px]" className="rounded-xl" />
          <div className="space-y-4">
            <Skeleton height="h-8" width="w-3/4" />
            <Skeleton height="h-6" width="w-1/4" />
            <Skeleton variant="text" lines={4} />
            <Skeleton height="h-12" width="w-full" className="mt-8" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="text-5xl mb-4">&#128533;</div>
        <h2 className="text-2xl font-bold mb-2">{t('theme.product_detail.not_found_heading')}</h2>
        <Link to="/products" className="text-sm underline" style={{ color: 'var(--color-primary, #2563eb)' }}>
          {t('theme.product_detail.back_to_shop')}
        </Link>
      </div>
    );
  }

  // Variant-aware derived state. Variants own price/stock when selected.
  const hasVariants = Boolean(product.hasVariants || product.variants?.length || product.options?.length);
  const displayPrice =
    activeVariant && typeof activeVariant.price === 'number' ? activeVariant.price : product.price;
  const displayCompareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice;
  const displayStock = hasVariants ? (activeVariant?.stock ?? 0) : product.stock;
  const requiresVariantSelection = hasVariants && !activeVariant;

  // Pre-order resolution — centralised in the shared helper so every
  // theme/CTA renders consistently. Merchant flags on product.preorder
  // (or variant.preorder) take priority over stock levels so a flagged
  // product always shows "Pre-order" even when in stock.
  const preState = getPreorderState(product as any, activeVariant as any, {
    price: displayPrice,
    requiresSelection: requiresVariantSelection,
    adding,
  });
  const isPreorderable = preState.mode === 'preorder';
  const isPreorderSoldOut = preState.mode === 'soldOut';
  const shipDateLabel = preState.shipByLabel
    ? preState.shipByLabel.replace(/^Ships by\s+/i, '')
    : null;
  // Use the discounted preorder price when applicable
  const effectivePrice = preState.effectivePrice;
  const effectiveCompareAt =
    preState.savingsPct > 0 ? preState.originalPrice : displayCompareAt;

  const handleAddToCart = async () => {
    if (requiresVariantSelection) {
      toast('Please select an option before adding to cart', { type: 'error' });
      return;
    }
    setAdding(true);
    try {
      await addItem(product._id, quantity, activeVariant?._id);
      toast('Added to cart!', { type: 'success' });
    } catch (err) {
      toast('Failed to add to cart', { type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const images = product.images?.length > 0 ? product.images : ['https://placehold.co/600x600?text=No+Image'];
  const discount = displayCompareAt && displayCompareAt > displayPrice
    ? Math.round((1 - displayPrice / displayCompareAt) * 100)
    : 0;

  // Finding #5: render merchant-composed sections for the product
  // template ABOVE the hardcoded curated layout. Empty means the
  // merchant hasn't added any sections yet; we render nothing in
  // that case rather than crash. The hardcoded block remains for
  // now — finding #6 will migrate it to a fully declarative layout.
  const productSections = useTemplateSections('product');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {productSections.length > 0 && (
        <div className="mb-8">
          {productSections.map((s) => {
            const Component = DEFAULT_SECTION_REGISTRY[s.type];
            if (!Component) return null;
            return <Component key={s.id} id={s.id} section={s} />;
          })}
        </div>
      )}

      {/* Breadcrumb */}
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          ...(product.category && typeof product.category === 'object'
            ? [{ label: (product.category as any).name, href: `/categories/${(product.category as any).slug}` }]
            : []),
          { label: product.name },
        ]}
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
        {/* Images */}
        <div>
          {/* Main Image with Zoom */}
          <div className="aspect-[4/5] rounded-xl overflow-hidden mb-4 border border-gray-100">
            <ImageZoom
              src={images[selectedImage]}
              alt={product.name}
              className="w-full h-full"
              fit="cover"
            />
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-20 h-20 rounded-lg border-2 overflow-hidden shrink-0 transition ${
                    i === selectedImage ? 'border-gray-900 ring-1 ring-gray-900/20' : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          {product.category && typeof product.category === 'object' && (
            <Link
              to={`/categories/${(product.category as any).slug}`}
              className="text-xs uppercase tracking-widest font-semibold mb-2 block"
              style={{ color: 'var(--color-primary, #2563eb)' }}
            >
              {(product.category as any).name}
            </Link>
          )}

          <h1 className="text-2xl lg:text-3xl font-bold mb-3">{product.name}</h1>

          {/* Rating */}
          {product.rating !== undefined && product.rating > 0 && (
            <RatingStars
              rating={product.rating}
              reviewCount={product.reviewCount}
              showNumber
              className="mb-4"
            />
          )}

          {/* Price (pre-order discount reflected when active) */}
          <PriceDisplay
            price={effectivePrice}
            compareAtPrice={effectiveCompareAt}
            size="lg"
            showDiscount
            className="mb-2"
          />
          {preState.mode === 'preorder' && preState.discountLabel && (
            <p className="text-xs font-semibold text-amber-700 mb-4">
              {preState.discountLabel}
            </p>
          )}

          {/* Variant picker */}
          {hasVariants && (
            <VariantPicker
              options={product.options || []}
              variants={(product.variants || []) as Variant[]}
              selection={variantSelection}
              onSelectionChange={setVariantSelection}
              onVariantChange={setActiveVariant}
              accentColor="var(--color-primary, #2563eb)"
              className="mb-6"
            />
          )}

          {/* Stock */}
          {requiresVariantSelection ? (
            <p className="text-sm text-gray-500 font-medium mb-6 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-gray-400 rounded-full" />
              {t('theme.product_detail.select_option_availability')}
            </p>
          ) : displayStock > 0 ? (
            <p className="text-sm text-green-600 font-medium mb-6 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              {t('theme.product_detail.in_stock', { count: displayStock })}
            </p>
          ) : isPreorderable ? (
            <div className="mb-6">
              <p className="text-sm text-amber-600 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                Pre-order{shipDateLabel ? ` — ships ${shipDateLabel}` : ''}
              </p>
              {preState.lowRemaining && preState.remaining !== null && (
                <p className="text-xs font-semibold text-amber-700 mt-1">
                  Only {preState.remaining} left
                </p>
              )}
              {preState.depositLabel && (
                <p className="text-xs text-amber-700 mt-1">{preState.depositLabel}</p>
              )}
              {preState.policyNote && (
                <p className="text-xs text-gray-500 mt-1">{preState.policyNote}</p>
              )}
            </div>
          ) : isPreorderSoldOut ? (
            <p className="text-sm text-red-500 font-medium mb-6 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              {t('theme.product_detail.sold_out')}
            </p>
          ) : (
            <p className="text-sm text-red-500 font-medium mb-6 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              {t('theme.product_detail.out_of_stock')}
            </p>
          )}

          {/* Short description */}
          {product.shortDescription && (
            <p className="text-gray-600 text-sm leading-relaxed mb-6">{product.shortDescription}</p>
          )}

          {/* Quantity + Add to Cart (or Pre-order) */}
          {!requiresVariantSelection && (displayStock > 0 || isPreorderable) && (
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-4">
                <QuantitySelector
                  value={quantity}
                  onChange={setQuantity}
                  max={isPreorderable ? 99 : displayStock}
                  size="md"
                />
                <button
                  onClick={handleAddToCart}
                  disabled={adding || preState.ctaDisabled}
                  className="flex-1 py-3.5 rounded-lg text-white font-semibold hover:opacity-90 transition disabled:opacity-50 text-sm"
                  style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
                >
                  {preState.ctaLabel}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <WishlistButton productId={product._id} variant="button" />
                <ProductCompare product={product} />
              </div>
            </div>
          )}

          <GuaranteedCheckout className="mt-6" />

          {/* Share */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <span className="text-sm text-gray-500">{t('theme.product_detail.share')}</span>
            <SocialShare
              url={window.location.href}
              title={product.name}
              description={product.shortDescription}
              size="sm"
            />
          </div>

          {/* SKU & Tags */}
          <div className="text-xs text-gray-400 space-y-1 mt-4 pt-4 border-t">
            {product.sku && <p>SKU: {product.sku}</p>}
            {product.tags && product.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {product.tags.map((tag: string) => (
                  <span key={tag} className="bg-gray-100 px-2 py-0.5 rounded text-xs">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rich extras: tabs, reviews, frequently bought together, similar products */}
      <ProductDetailExtras
        product={product}
        reviews={reviews}
        ratingDistribution={ratingDistribution}
        frequentlyBoughtWith={frequentlyBoughtWith}
        relatedProducts={relatedProducts}
      />
    </div>
  );
};

export default ProductDetail;
