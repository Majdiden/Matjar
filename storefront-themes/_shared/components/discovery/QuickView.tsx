import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { Modal } from '../primitives/Modal';
import { PriceDisplay } from '../commerce/PriceDisplay';
import { QuantitySelector } from '../commerce/QuantitySelector';
import { RatingStars } from '../commerce/RatingStars';
import { WishlistButton } from '../commerce/WishlistButton';
import { useCart } from '../../contexts/CartContext';
import type { Product } from '../../types/commerce';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'quickView';

interface QuickViewProps {
  product: Product | null;
  /** Optional — defaults to `!!product` so callers can pass just `product`. */
  isOpen?: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * QuickView modal — Shopify-quality product preview launched from a
 * product card. Renders an image gallery, options/variants, price with
 * sale badge, quantity selector, add-to-cart, wishlist, and a link to
 * the full PDP.
 *
 * The modal auto-resets internal state (selected image, quantity, option
 * selections) whenever a different product is opened so reopening with
 * a fresh product feels clean.
 */
export function QuickView(props: QuickViewProps) {
  const Override = useThemeSlot<React.ComponentType<QuickViewProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { product, isOpen, onClose, className } = props;
  const { addItem } = useCart();
  const open = isOpen ?? !!product;

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);

  // Reset state when opening a different product
  useEffect(() => {
    if (product) {
      setSelectedImage(0);
      setQuantity(1);
      setJustAdded(false);
      setSelectedVariantId(product.variants?.[0]?._id);
    }
  }, [product?._id]);

  // NOTE: every hook below MUST run on every render — calling them after the
  // `if (!product) return null` below would change the hook count between
  // null and non-null product renders and crash with React error #310.
  const selectedVariant = product?.variants?.find((v) => v._id === selectedVariantId);
  const effectivePrice = selectedVariant?.price ?? product?.price ?? 0;
  const effectiveCompareAt = selectedVariant?.compareAtPrice ?? product?.compareAtPrice;
  const effectiveStock = selectedVariant?.stock ?? product?.stock;

  const savingsPct = useMemo(() => {
    if (!effectiveCompareAt || effectiveCompareAt <= effectivePrice) return null;
    return Math.round(((effectiveCompareAt - effectivePrice) / effectiveCompareAt) * 100);
  }, [effectivePrice, effectiveCompareAt]);

  if (!product) return null;

  const images = product.images?.length
    ? product.images
    : ['https://placehold.co/600x600?text=No+Image'];

  const variantLabel = (v: typeof selectedVariant) =>
    v?.optionValues?.map((o) => o.value).join(' / ') || v?.sku || 'Variant';

  const handleAddToCart = async () => {
    setAdding(true);
    try {
      await addItem(product._id, quantity, selectedVariantId);
      setJustAdded(true);
      // Brief celebration before closing so the user sees the success state
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setAdding(false);
    }
  };

  const inStock = effectiveStock === undefined || effectiveStock > 0;
  const lowStock = effectiveStock !== undefined && effectiveStock > 0 && effectiveStock <= 5;

  return (
    <Modal isOpen={open} onClose={onClose} size="xl" className={cn('!p-0 overflow-hidden', className)}>
      {/* Floating close button — overlays the gallery for an edge-to-edge look */}
      <button
        onClick={onClose}
        aria-label="Close quick view"
        className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:scale-105 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="grid md:grid-cols-2">
        {/* Gallery column */}
        <div className="relative bg-gray-50 dark:bg-gray-800">
          {/* Sale badge */}
          {savingsPct !== null && (
            <div className="absolute top-4 left-4 z-10 bg-rose-600 text-white text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg">
              -{savingsPct}%
            </div>
          )}

          {/* Main image */}
          <div className="aspect-square overflow-hidden">
            <img
              key={selectedImage}
              src={images[selectedImage]}
              alt={product.name}
              className="w-full h-full object-cover animate-in fade-in duration-300"
            />
          </div>

          {/* Image dots / thumbnails */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-white/90 backdrop-blur rounded-full px-2.5 py-1.5 shadow-md">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  aria-label={`View image ${i + 1}`}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    i === selectedImage ? 'w-6 bg-gray-900' : 'w-2 bg-gray-400 hover:bg-gray-600'
                  )}
                />
              ))}
            </div>
          )}

          {/* Arrow nav (desktop) */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setSelectedImage((i) => (i === 0 ? images.length - 1 : i - 1))}
                aria-label="Previous image"
                className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow-md items-center justify-center text-gray-700 hover:bg-white transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setSelectedImage((i) => (i === images.length - 1 ? 0 : i + 1))}
                aria-label="Next image"
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow-md items-center justify-center text-gray-700 hover:bg-white transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Info column */}
        <div className="flex flex-col p-6 md:p-8 max-h-[90vh] md:max-h-[80vh] overflow-y-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
            {product.name}
          </h2>

          {/* Rating */}
          {product.rating !== undefined && product.rating > 0 && (
            <div className="mb-4">
              <RatingStars rating={product.rating} reviewCount={product.reviewCount} />
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-1">
            <PriceDisplay
              price={effectivePrice}
              compareAtPrice={effectiveCompareAt}
              size="lg"
            />
            {savingsPct !== null && (
              <span className="text-sm font-semibold text-rose-600">
                Save {savingsPct}%
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mb-5">Tax included. Shipping calculated at checkout.</div>

          {/* Short description */}
          {product.shortDescription && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed line-clamp-4">
              {product.shortDescription}
            </p>
          )}

          {/* Variants */}
          {product.variants && product.variants.length > 1 && (
            <div className="mb-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                Variant: <span className="font-normal text-gray-500">{variantLabel(selectedVariant)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v._id}
                    onClick={() => setSelectedVariantId(v._id)}
                    disabled={v.stock === 0}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition',
                      selectedVariantId === v._id
                        ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400',
                      v.stock === 0 && 'opacity-40 cursor-not-allowed line-through'
                    )}
                  >
                    {variantLabel(v)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock indicator */}
          <div className="mb-5">
            {!inStock ? (
              <div className="inline-flex items-center gap-1.5 text-sm text-rose-600 font-medium">
                <span className="h-2 w-2 rounded-full bg-rose-600" />
                Out of stock
              </div>
            ) : lowStock ? (
              <div className="inline-flex items-center gap-1.5 text-sm text-amber-600 font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Only {effectiveStock} left in stock
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                In stock
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Quantity
            </span>
            <QuantitySelector
              value={quantity}
              onChange={setQuantity}
              max={effectiveStock}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-auto">
            <button
              onClick={handleAddToCart}
              disabled={adding || !inStock || justAdded}
              className={cn(
                'flex-1 h-12 rounded-lg font-semibold text-white transition-all',
                'shadow-sm hover:shadow-md active:scale-[0.98]',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-sm',
                justAdded ? 'bg-emerald-600' : ''
              )}
              style={justAdded ? undefined : { backgroundColor: 'var(--color-primary, #111827)' }}
            >
              {!inStock ? (
                'Out of stock'
              ) : justAdded ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Added to cart
                </span>
              ) : adding ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Adding…
                </span>
              ) : (
                'Add to cart'
              )}
            </button>

            <WishlistButton productId={product._id} className="h-12 w-12 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 transition flex items-center justify-center" />
          </div>

          {/* View full details */}
          <Link
            to={`/products/${product.slug}`}
            onClick={onClose}
            className="mt-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline underline-offset-4 transition"
          >
            View full details &rarr;
          </Link>
        </div>
      </div>
    </Modal>
  );
}
