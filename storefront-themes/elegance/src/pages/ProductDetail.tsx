import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProduct } from '@shared/hooks/useProducts';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import ProductDetailExtras from '@shared/components/commerce/ProductDetailExtras';
import GuaranteedCheckout from '@shared/components/commerce/GuaranteedCheckout';
import { VariantPicker, type Variant } from '@shared/components/commerce/VariantPicker';
import { getPreorderState } from '@shared/utils/preorder';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation(['theme']);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [variantSelection, setVariantSelection] = useState<Record<string, string>>({});
  const [activeVariant, setActiveVariant] = useState<Variant | null>(null);

  // When a variant has its own image, jump the gallery to that index
  useEffect(() => {
    if (!activeVariant?.image || !product?.images) return;
    const idx = product.images.findIndex((src: string) => src === activeVariant.image);
    if (idx >= 0) setSelectedImage(idx);
  }, [activeVariant?.image, product?.images]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="animate-pulse bg-gray-100 rounded-lg aspect-square" />
          <div className="space-y-4">
            <div className="animate-pulse bg-gray-100 h-8 w-3/4 rounded" />
            <div className="animate-pulse bg-gray-100 h-6 w-1/4 rounded" />
            <div className="animate-pulse bg-gray-100 h-32 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <svg className="w-14 h-14 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" /></svg>
        <h2 className="text-2xl font-bold mb-2">{t('theme.product_detail.product_not_found')}</h2>
        <Link to="/products" className="text-sm underline" style={{ color: 'var(--color-primary)' }}>
          {t('theme.product_detail.back_to_shop')}
        </Link>
      </div>
    );
  }

  // Variant-aware derived state. Variants own price/stock when present.
  const hasVariants = Boolean(product.hasVariants || product.variants?.length || product.options?.length);
  const displayPrice =
    activeVariant && typeof activeVariant.price === 'number' ? activeVariant.price : product.price;
  const displayCompareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice;
  const displayStock = hasVariants ? (activeVariant?.stock ?? 0) : product.stock;
  const requiresVariantSelection = hasVariants && !activeVariant;

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
  const effectivePrice = preState.effectivePrice;
  const effectiveCompareAt =
    preState.savingsPct > 0 ? preState.originalPrice : displayCompareAt;

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

  const images = product.images?.length > 0 ? product.images : ['https://placehold.co/600x600?text=No+Image'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-gray-700">{t('theme.product_detail.breadcrumb_home')}</Link>
        <span className="mx-2">/</span>
        <Link to="/products" className="hover:text-gray-700">{t('theme.product_detail.breadcrumb_products')}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Images */}
        <div>
          <div className="aspect-[4/5] rounded-lg overflow-hidden mb-4">
            <img src={images[selectedImage]} alt={product.name} className="w-full h-full object-cover" />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded border-2 overflow-hidden ${i === selectedImage ? 'border-primary' : 'border-transparent'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          {product.category?.name && (
            <Link
              to={`/categories/${product.category.slug}`}
              className="text-sm uppercase tracking-wide mb-2 block"
              style={{ color: 'var(--color-primary)' }}
            >
              {product.category.name}
            </Link>
          )}
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>

          {/* Price */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl font-bold">{formatPrice(effectivePrice)}</span>
            {effectiveCompareAt && effectiveCompareAt > effectivePrice && (
              <>
                <span className="text-lg text-gray-400 line-through">{formatPrice(effectiveCompareAt)}</span>
                <span className="bg-red-100 text-red-700 text-sm font-bold px-2 py-1 rounded">
                  -{Math.round((1 - effectivePrice / effectiveCompareAt) * 100)}%
                </span>
              </>
            )}
          </div>
          {isPreorderable && preState.discountLabel && (
            <p className="text-xs font-semibold text-amber-700 mb-4">{preState.discountLabel}</p>
          )}

          {/* Variant picker */}
          {hasVariants && (
            <VariantPicker
              options={product.options || []}
              variants={(product.variants || []) as Variant[]}
              selection={variantSelection}
              onSelectionChange={setVariantSelection}
              onVariantChange={setActiveVariant}
              accentColor="var(--color-primary, #111827)"
              className="mb-6"
            />
          )}

          {/* Stock */}
          {requiresVariantSelection ? (
            <p className="text-sm text-gray-500 mb-6">{t('theme.product_detail.select_option')}</p>
          ) : displayStock > 0 ? (
            <p className="text-sm text-green-600 mb-6">{t('theme.product_detail.in_stock', { count: displayStock })}</p>
          ) : isPreorderable ? (
            <div className="mb-6">
              <p className="text-sm text-amber-600">
                {t('theme.product_detail.preorder')}{shipDateLabel ? ` — ${t('theme.product_detail.preorder_ships', { date: shipDateLabel })}` : ''}
              </p>
              {preState.lowRemaining && preState.remaining !== null && (
                <p className="text-xs font-semibold text-amber-700 mt-1">{t('theme.product_detail.only_left', { count: preState.remaining })}</p>
              )}
              {preState.depositLabel && (
                <p className="text-xs text-amber-700 mt-1">{preState.depositLabel}</p>
              )}
              {preState.policyNote && (
                <p className="text-xs text-gray-500 mt-1">{preState.policyNote}</p>
              )}
            </div>
          ) : isPreorderSoldOut ? (
            <p className="text-sm text-red-500 mb-6">{t('theme.product_detail.sold_out')}</p>
          ) : (
            <p className="text-sm text-red-500 mb-6">{t('theme.product_detail.out_of_stock')}</p>
          )}

          {/* Quantity + Add to Cart */}
          {!requiresVariantSelection && (displayStock > 0 || isPreorderable) && (
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center border rounded-lg">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-3 py-2 hover:bg-gray-50"
                >
                  -
                </button>
                <span className="px-4 py-2 border-x">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => isPreorderable ? q + 1 : Math.min(displayStock, q + 1))}
                  className="px-3 py-2 hover:bg-gray-50"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={adding || preState.ctaDisabled}
                className="flex-1 py-3 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {preState.mode === 'preorder'
                  ? (adding ? t('product:card.reserving') : t('product:card.preorder'))
                  : (adding ? t('product:card.adding') : t('product:card.add'))}
              </button>
            </div>
          )}

          <GuaranteedCheckout className="mt-6 mb-6" />

          {/* Description */}
          {product.description && (
            <div className="prose prose-sm max-w-none mb-8">
              <h3 className="font-semibold mb-2">{t('theme.product_detail.description_heading')}</h3>
              <p className="text-gray-600 whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {/* SKU & Tags */}
          <div className="text-sm text-gray-500 space-y-1">
            {product.sku && <p>{t('theme.product_detail.sku_label', { sku: product.sku })}</p>}
            {product.tags?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {product.tags.map((tag: string) => (
                  <span key={tag} className="bg-gray-100 px-2 py-1 rounded text-xs">{tag}</span>
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
