import React, { createContext, useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useStore } from '../../contexts/StoreContext';
import { useCart } from '../../contexts/CartContext';
import { calculateDiscount } from '../../utils/formatCurrency';
import { getPreorderState } from '../../utils/preorder';
import type { Product } from '../../types/commerce';

// ─── Context ─────────────────────────────────────────────────────

interface ProductCardContextValue {
  product: Product;
  discount: number;
  onQuickView?: (product: Product) => void;
}

const ProductCardContext = createContext<ProductCardContextValue | null>(null);

function useProductCard() {
  const ctx = useContext(ProductCardContext);
  if (!ctx) throw new Error('ProductCard subcomponents must be used within <ProductCard>');
  return ctx;
}

// ─── Root ────────────────────────────────────────────────────────

interface ProductCardRootProps {
  product: Product;
  children: React.ReactNode;
  className?: string;
  layout?: 'grid' | 'list';
  onQuickView?: (product: Product) => void;
}

function ProductCardRoot({ product, children, className, layout = 'grid', onQuickView }: ProductCardRootProps) {
  // Preorder-aware discount. When a pre-order discount is active we use
  // the effective (post-discount) price for the strike-through %, otherwise
  // fall back to the standard compareAtPrice calculation.
  const preorder = getPreorderState(product);
  const discount =
    preorder.mode !== 'buy' && preorder.savingsPct > 0
      ? preorder.savingsPct
      : calculateDiscount(product.price, product.compareAtPrice);

  return (
    <ProductCardContext.Provider value={{ product, discount, onQuickView }}>
      <Link
        to={`/products/${product.slug}`}
        className={cn(
          'group block border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300',
          layout === 'list' ? 'flex gap-4 p-4' : '',
          className
        )}
      >
        {children}
      </Link>
    </ProductCardContext.Provider>
  );
}

// ─── Image ───────────────────────────────────────────────────────

interface ImageProps {
  className?: string;
  aspectRatio?: string;
  showBadge?: boolean;
  showQuickView?: boolean;
  showWishlist?: boolean;
  /** Second image for hover swap effect */
  hoverSwap?: boolean;
  /** Image fit mode — 'cover' crops to fill, 'contain' shows full image with padding */
  fit?: 'cover' | 'contain';
}

function ProductImage({
  className,
  aspectRatio = 'aspect-[4/5]',
  showBadge = true,
  showQuickView = false,
  hoverSwap = false,
  fit = 'cover',
}: ImageProps) {
  const { product, discount, onQuickView } = useProductCard();
  const imgSrc = product.images?.[0] || 'https://placehold.co/400x400?text=No+Image';
  const hoverSrc = product.images?.[1];

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  return (
    <div className={cn('relative overflow-hidden', aspectRatio, className)}>
      <img
        src={imgSrc}
        alt={product.name}
        className={cn(
          `w-full h-full transition-all duration-500 ${fit === 'contain' ? 'object-contain p-2' : 'object-cover'}`,
          hoverSwap && hoverSrc ? 'group-hover:opacity-0' : 'group-hover:scale-105'
        )}
        loading="lazy"
      />
      {hoverSwap && hoverSrc && (
        <img
          src={hoverSrc}
          alt={product.name}
          className={`absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${fit === 'contain' ? 'object-contain p-2' : 'object-cover'}`}
          loading="lazy"
        />
      )}

      {/* Badges */}
      {showBadge && (() => {
        const pre = getPreorderState(product);
        const isPreorder = pre.mode === 'preorder';
        const isPreorderSoldOut = pre.mode === 'soldOut';
        // Suppress the generic "Sold Out" tile when the product has no
        // preorder config but is genuinely out of stock — that is still
        // a valid bucket below.
        return (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                -{discount}%
              </span>
            )}
            {isPreorder && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
                Pre-order
              </span>
            )}
            {product.isFeatured && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
                Featured
              </span>
            )}
            {(product.stock === 0 && pre.mode === 'buy') || isPreorderSoldOut ? (
              <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded">
                Sold Out
              </span>
            ) : null}
          </div>
        );
      })()}

      {/* Quick View overlay */}
      {showQuickView && onQuickView && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
          <button
            onClick={handleQuickView}
            className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-gray-50"
          >
            Quick View
          </button>
        </div>
      )}

      {/* Out of stock overlay (suppressed when product can be pre-ordered) */}
      {product.stock === 0 && !showBadge && !getPreorderState(product).config && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <span className="bg-white text-gray-800 px-3 py-1 rounded font-medium text-sm">Out of Stock</span>
        </div>
      )}
    </div>
  );
}

// ─── Title ───────────────────────────────────────────────────────

function ProductTitle({
  className,
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  const { product } = useProductCard();
  return (
    <h3
      className={cn(
        'font-medium text-sm',
        lines === 1 && 'truncate',
        lines === 2 && 'line-clamp-2',
        lines === 3 && 'line-clamp-3',
        className
      )}
    >
      {product.name}
    </h3>
  );
}

// ─── Price ───────────────────────────────────────────────────────

function ProductPrice({
  className,
  showCompareAt = true,
  showDiscount = false,
}: {
  className?: string;
  showCompareAt?: boolean;
  showDiscount?: boolean;
}) {
  const { product, discount } = useProductCard();
  const { formatPrice } = useStore();

  // When a pre-order discount is active we render the discounted price
  // as the headline and strike-through the original. Otherwise we use
  // the usual compareAtPrice comparison.
  const pre = getPreorderState(product);
  const hasPreorderDiscount = pre.mode !== 'buy' && pre.savingsPct > 0;
  const headline = hasPreorderDiscount ? pre.effectivePrice : product.price;
  const strike = hasPreorderDiscount ? pre.originalPrice : product.compareAtPrice;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn('font-bold', discount > 0 && 'text-red-600')}>
        {formatPrice(headline)}
      </span>
      {showCompareAt && discount > 0 && strike && strike > headline && (
        <span className="text-sm text-gray-400 line-through">
          {formatPrice(strike)}
        </span>
      )}
      {showDiscount && discount > 0 && (
        <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
          -{discount}%
        </span>
      )}
    </div>
  );
}

// ─── Rating ──────────────────────────────────────────────────────

function ProductRating({ className }: { className?: string }) {
  const { product } = useProductCard();
  if (!product.rating || product.rating === 0) return null;

  return (
    <div className={cn('flex items-center gap-1 text-xs text-gray-500', className)}>
      <span className="text-yellow-400">{'★'.repeat(Math.round(product.rating))}</span>
      <span className="text-gray-300">{'★'.repeat(5 - Math.round(product.rating))}</span>
      {product.reviewCount !== undefined && <span>({product.reviewCount})</span>}
    </div>
  );
}

// ─── Actions ─────────────────────────────────────────────────────

function ProductActions({
  className,
  showAddToCart = true,
  addToCartText = 'Add',
  addToCartClassName,
}: {
  className?: string;
  showAddToCart?: boolean;
  /** Label when the product is purchasable. Preorder/sold-out labels are derived. */
  addToCartText?: string;
  addToCartClassName?: string;
}) {
  const { product } = useProductCard();
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);

  const pre = getPreorderState(product, null, { adding, buyLabel: addToCartText });
  const requiresOptions = Boolean(
    product.hasVariants || product.variants?.length || product.options?.length
  );
  // Hide the card CTA entirely only when the product is truly
  // unavailable: out of stock AND not configured for pre-order.
  const hidden =
    !showAddToCart || (product.stock === 0 && pre.mode === 'buy');

  const handleAdd = async (e: React.MouseEvent) => {
    if (requiresOptions) return;
    e.preventDefault();
    e.stopPropagation();
    if (pre.ctaDisabled) return;
    setAdding(true);
    try {
      // The backend has atomic preorder reservation on the checkout path;
      // addItem remains the same for both buy and pre-order flows.
      await addItem(product._id);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setAdding(false);
    }
  };

  if (hidden) return null;

  return (
    <div className={className}>
      <button
        onClick={handleAdd}
        disabled={adding || pre.ctaDisabled}
        className={cn(
          'text-xs px-3 py-1.5 rounded font-medium transition',
          'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50',
          addToCartClassName
        )}
        title={
          requiresOptions
            ? 'Select options on the product page'
            : pre.mode === 'preorder'
            ? [pre.shipByLabel, pre.depositLabel].filter(Boolean).join(' · ') || undefined
            : undefined
        }
      >
        {requiresOptions
          ? 'Choose options'
          : pre.ctaLabel === addToCartText
          ? (adding ? '…' : addToCartText)
          : pre.ctaLabel}
      </button>
      {pre.lowRemaining && pre.remaining !== null && (
        <span className="ml-2 text-[10px] font-semibold text-amber-600">
          Only {pre.remaining} left
        </span>
      )}
    </div>
  );
}

// ─── Body (content wrapper) ──────────────────────────────────────

function ProductBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-3', className)}>{children}</div>;
}

// ─── Compose ─────────────────────────────────────────────────────

export const ProductCard = Object.assign(ProductCardRoot, {
  Image: ProductImage,
  Title: ProductTitle,
  Price: ProductPrice,
  Rating: ProductRating,
  Actions: ProductActions,
  Body: ProductBody,
});
