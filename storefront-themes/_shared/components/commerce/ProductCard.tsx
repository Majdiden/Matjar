import React, { createContext, useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useStore } from '../../contexts/StoreContext';
import { useCart } from '../../contexts/CartContext';
import { calculateDiscount } from '../../utils/formatCurrency';
import { getPreorderState } from '../../utils/preorder';
import { PRODUCT_PLACEHOLDER } from '../../utils/placeholder';
import { WishlistButton } from './WishlistButton';
import type { Product } from '../../types/commerce';

/**
 * Shared compound ProductCard.
 *
 * Redesigned to a premium, mobile-first, fully token-driven baseline
 * (the bar set by NutrekoProductCard): every colour, radius, shadow and
 * motion value reads from the CSS custom properties ThemeProvider injects
 * (`--color-*`, `--shadow-*`, `--radius*`, `--hover-lift`, `--duration-*`,
 * `--ease-*`), so each theme's palette + customizer edits flow through for
 * free and no card ever looks like the flat default template again.
 *
 * Stability guarantees (looks right on ANY store's catalog):
 *   - fixed image aspect ratio + neutral backdrop, so a missing/404 image
 *     never collapses the tile (an `onError` swaps in a placeholder once);
 *   - the title reserves two lines (`min-h`) so cards in a grid keep a
 *     uniform height regardless of name length.
 *
 * All user-facing strings are translated via the shared `product` / `common`
 * namespaces — no hardcoded English.
 *
 * The compound API (`<ProductCard>` + `.Image/.Body/.Title/.Price/.Rating/
 * .Actions`) is unchanged so existing theme usages keep working.
 */

const PLACEHOLDER = PRODUCT_PLACEHOLDER;

const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const el = e.currentTarget;
  if (el.src !== PLACEHOLDER) el.src = PLACEHOLDER;
};

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
          'group relative block overflow-hidden bg-[var(--color-background,#fff)]',
          'border border-[var(--color-border,#e5e7eb)]',
          'shadow-[var(--shadow-sm)] transition-[transform,box-shadow,border-color]',
          'duration-[var(--duration-base,250ms)] ease-[var(--ease-emphasized,cubic-bezier(0.2,0,0,1))]',
          'hover:shadow-[var(--shadow-lg)] motion-safe:hover:[transform:var(--hover-lift,translateY(-4px))] hover:border-transparent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)] focus-visible:ring-offset-2',
          layout === 'list' ? 'flex gap-4 p-3' : 'flex flex-col',
          className
        )}
        style={{ borderRadius: 'var(--radius, 12px)' }}
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
  showWishlist = true,
  hoverSwap = false,
  fit = 'cover',
}: ImageProps) {
  const { t } = useTranslation(['product', 'common']);
  const { product, discount, onQuickView } = useProductCard();
  const imgSrc = product.images?.[0] || PLACEHOLDER;
  const hoverSrc = product.images?.[1];

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  const fitCls = fit === 'contain' ? 'object-contain p-3' : 'object-cover';

  return (
    // Neutral backdrop keeps a uniform tile even when an image is missing
    // or a 'contain' image leaves letterbox gaps.
    <div className={cn('relative overflow-hidden bg-black/[0.03]', aspectRatio, className)}>
      <img
        src={imgSrc}
        alt={product.name}
        onError={onImgError}
        className={cn(
          'w-full h-full transition-[transform,opacity] duration-[var(--duration-slow,400ms)] ease-[var(--ease-standard,cubic-bezier(0.4,0,0.2,1))]',
          fitCls,
          hoverSwap && hoverSrc ? 'group-hover:opacity-0' : 'motion-safe:group-hover:scale-[1.06]'
        )}
        loading="lazy"
      />
      {hoverSwap && hoverSrc && (
        <img
          src={hoverSrc}
          alt={product.name}
          onError={onImgError}
          className={cn(
            'absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--duration-slow,400ms)]',
            fitCls
          )}
          loading="lazy"
        />
      )}

      {/* Hairline inset keeps light images from bleeding into the card edge */}
      <div className="pointer-events-none absolute inset-0 z-[1] ring-1 ring-inset ring-black/[0.04]" aria-hidden="true" />

      {/* Badges — token-coloured, translated, stacked top-start */}
      {showBadge && (() => {
        const pre = getPreorderState(product);
        const isPreorder = pre.mode === 'preorder';
        const isPreorderSoldOut = pre.mode === 'soldOut';
        const badge =
          'inline-flex items-center text-[10px] font-bold uppercase tracking-[0.06em] leading-none px-2.5 py-[5px] ' +
          'rounded-[var(--radius-pill,9999px)] text-white shadow-[var(--shadow-sm)] ring-1 ring-white/20';
        return (
          <div className="absolute top-2.5 start-2.5 z-10 flex flex-col items-start gap-1">
            {discount > 0 && (
              <span className={badge} style={{ backgroundColor: 'var(--color-error, #ef4444)' }}>
                -{discount}%
              </span>
            )}
            {isPreorder && (
              <span className={badge} style={{ backgroundColor: 'var(--color-accent, #f59e0b)' }}>
                {t('product:preorder_badge', 'Pre-order')}
              </span>
            )}
            {product.isFeatured && (
              <span className={badge} style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}>
                {t('product:featured_badge', 'Featured')}
              </span>
            )}
            {(product.stock === 0 && pre.mode === 'buy') || isPreorderSoldOut ? (
              <span className={badge} style={{ backgroundColor: 'var(--color-secondary, #1f2937)' }}>
                {t('product:sold_out', 'Sold out')}
              </span>
            ) : null}
          </div>
        );
      })()}

      {/* Top-end action stack — wishlist heart + optional quick view.
          Stacked in a logical (RTL-safe) column so they never overlap. The
          heart is always tappable; quick view fades in on hover (desktop) and
          stays visible on touch. */}
      {(showWishlist || (showQuickView && onQuickView)) && (
        <div className="absolute top-2.5 end-2.5 z-10 flex flex-col items-center gap-1.5">
          {showWishlist && (
            <WishlistButton
              productId={product._id}
              product={product}
              size="md"
              className={cn(
                'grid place-items-center w-9 h-9 rounded-[var(--radius-pill,9999px)] p-0',
                'shadow-[var(--shadow-md)] backdrop-blur ring-1 ring-black/[0.06]',
                'transition-all duration-[var(--duration-base,250ms)] motion-safe:hover:scale-110 motion-safe:active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)]',
                'bg-[color-mix(in_srgb,var(--color-background,#fff)_94%,transparent)]'
              )}
            />
          )}
          {showQuickView && onQuickView && (
            <button
              type="button"
              onClick={handleQuickView}
              aria-label={t('common:aria.quick_view', 'Quick view')}
              className={cn(
                'grid place-items-center w-9 h-9 rounded-[var(--radius-pill,9999px)]',
                'shadow-[var(--shadow-md)] backdrop-blur ring-1 ring-black/[0.06]',
                'transition-all duration-[var(--duration-base,250ms)] motion-safe:hover:scale-110 motion-safe:active:scale-95',
                'opacity-100 md:opacity-0 md:translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)] md:focus-visible:opacity-100'
              )}
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-background, #fff) 94%, transparent)',
                color: 'var(--color-foreground, #111)',
              }}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Out of stock overlay (only when badges are off, to avoid doubling up) */}
      {product.stock === 0 && !showBadge && !getPreorderState(product).config && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <span className="bg-white text-gray-800 px-3 py-1 rounded-[var(--radius-sm,6px)] font-medium text-sm">
            {t('product:out_of_stock', 'Out of stock')}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Title ───────────────────────────────────────────────────────

function ProductTitle({
  className,
  lines = 2,
}: {
  className?: string;
  lines?: number;
}) {
  const { product } = useProductCard();
  return (
    <h3
      className={cn(
        'font-semibold text-sm md:text-[15px] leading-snug text-[var(--color-foreground,#111)]',
        // Reserve the line box so grids stay aligned regardless of name length.
        lines === 1 && 'truncate',
        lines === 2 && 'line-clamp-2 min-h-[2.6em]',
        lines === 3 && 'line-clamp-3 min-h-[3.9em]',
        'transition-colors duration-[var(--duration-fast,150ms)] group-hover:text-[var(--color-primary,#2563eb)]',
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
    <div className={cn('flex items-baseline gap-2', className)}>
      <span
        className="font-bold text-base md:text-lg tracking-tight tabular-nums"
        style={discount > 0 ? { color: 'var(--color-error, #dc2626)' } : { color: 'var(--color-foreground, #111)' }}
      >
        {formatPrice(headline)}
      </span>
      {showCompareAt && discount > 0 && strike && strike > headline && (
        <span className="text-[13px] text-[var(--color-muted,#9ca3af)] line-through decoration-from-font tabular-nums">
          {formatPrice(strike)}
        </span>
      )}
      {showDiscount && discount > 0 && (
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-[var(--radius-sm,6px)]"
          style={{ color: 'var(--color-error, #dc2626)', backgroundColor: 'color-mix(in srgb, var(--color-error, #dc2626) 12%, transparent)' }}
        >
          -{discount}%
        </span>
      )}
    </div>
  );
}

// ─── Rating ──────────────────────────────────────────────────────

function ProductRating({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const { product } = useProductCard();
  if (!product.rating || product.rating === 0) return null;

  const rounded = Math.round(product.rating);

  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-[var(--color-muted,#6b7280)]', className)} aria-label={t('aria.rating', 'Rating')}>
      <div className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            className={cn('w-3.5 h-3.5', i <= rounded ? '' : 'opacity-25')}
            style={{ color: 'var(--color-accent, #f59e0b)' }}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      {product.reviewCount !== undefined && <span>({product.reviewCount})</span>}
    </div>
  );
}

// ─── Actions ─────────────────────────────────────────────────────

function ProductActions({
  className,
  showAddToCart = true,
  addToCartText,
  addToCartClassName,
  fullWidth = false,
}: {
  className?: string;
  showAddToCart?: boolean;
  /** Label when the product is purchasable. Preorder/sold-out labels are derived. */
  addToCartText?: string;
  addToCartClassName?: string;
  /**
   * Render the CTA as a full-width button below the price (the premium,
   * never-clipped pattern). Use this instead of cramming the button into a
   * `justify-between` row with the price, where a discounted price leaves
   * no room and the button gets cut off on narrow cards.
   */
  fullWidth?: boolean;
}) {
  const { t } = useTranslation('product');
  const { product } = useProductCard();
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);

  const buyLabel = addToCartText ?? t('card.add', 'Add');
  const pre = getPreorderState(product, null, { adding, buyLabel });
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

  // Derive the CTA label from the pre-order MODE via i18n — preorder.ts only
  // supplies English ctaLabels, so using them directly left the pre-order /
  // sold-out buttons untranslated in Arabic.
  let label;
  if (requiresOptions) {
    label = t('card.options', 'Options');
  } else if (pre.mode === 'preorder') {
    label = adding ? t('card.reserving', 'Reserving…') : t('card.preorder', 'Pre-order');
  } else if (pre.mode === 'soldOut') {
    label = t('card.sold_out', 'Sold out');
  } else {
    label = adding ? t('card.adding', '…') : buyLabel;
  }

  return (
    <div className={cn(fullWidth && 'w-full', className)}>
      <button
        onClick={handleAdd}
        disabled={adding || pre.ctaDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white',
          'px-3 py-2 rounded-[var(--radius-sm,6px)] min-h-[38px] whitespace-nowrap shrink-0',
          'shadow-[var(--shadow-xs)] transition-[filter,transform,box-shadow] duration-[var(--duration-fast,150ms)]',
          'hover:brightness-110 hover:shadow-[var(--shadow-sm)] motion-safe:active:scale-95',
          'disabled:opacity-50 disabled:pointer-events-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)] focus-visible:ring-offset-2',
          fullWidth && 'w-full',
          addToCartClassName
        )}
        style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
        title={
          requiresOptions
            ? t('select_options_hint', 'Select options on the product page')
            : pre.mode === 'preorder'
            ? [pre.shipByLabel, pre.depositLabel].filter(Boolean).join(' · ') || undefined
            : undefined
        }
      >
        {!requiresOptions && pre.mode === 'buy' && !adding && (
          <svg className="w-3.5 h-3.5 -ms-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
        )}
        {label}
      </button>
      {pre.lowRemaining && pre.remaining !== null && (
        <span className="ms-2 text-[10px] font-semibold" style={{ color: 'var(--color-accent, #d97706)' }}>
          {t('only_remaining', { count: pre.remaining, defaultValue: 'Only {{count}} left' })}
        </span>
      )}
    </div>
  );
}

// ─── Body (content wrapper) ──────────────────────────────────────

function ProductBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-1.5 p-3 md:p-4', className)}>{children}</div>;
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
