import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useViewport } from '../../hooks/useViewport';
import { Carousel } from '../primitives/Carousel';
import { Skeleton } from '../primitives/Skeleton';
import { ProductCard } from './ProductCard';
import type { Product } from '../../types/commerce';

/**
 * ProductCarousel — a premium, swipeable rail of product cards built ON TOP
 * of the shared Carousel primitive (live touch drag, RTL-aware slide math,
 * keyboard navigation, reduced-motion + autoplay etiquette all inherited).
 *
 * Responsive slides-per-view with an edge peek on phones (~1.2 cards
 * visible, the next card peeking to signal swipeability), 2 cards on small
 * screens and `desktopSlides` (default 4) on desktop.
 *
 * Each slide renders the premium compound ProductCard (badges, quick view,
 * rating, compare-at pricing, add-to-cart), so a theme converts a grid rail
 * into a carousel without re-plumbing any commerce behavior. Optional
 * heading / subheading / view-all render the same section bar the theme
 * homepages use, keeping the header and the rail as one drop-in unit.
 *
 * Fully token-driven (`--color-*`, `--radius-*`, `--shadow-*`,
 * `--font-family-heading`, `--duration-*`, `--ease-*`) — no OS `dark:`
 * variants, logical (RTL-safe) utilities only.
 */

export interface ProductCarouselProps {
  products: Product[];
  /** Section heading. Omit (with `viewAllHref`) to render the bare rail. */
  heading?: string;
  subheading?: string;
  /** "View all" link target. Internal paths use the SPA router. */
  viewAllHref?: string;
  /** Label for the view-all link (pass a translated string). */
  viewAllLabel?: string;
  /** QuickView callback — wires the card's quick-view eye button. */
  onQuickView?: (product: Product) => void;
  /** Render skeleton cards while the products request is in flight. */
  loading?: boolean;
  /** Cards visible at once on desktop (lg+). Default: 4 */
  desktopSlides?: 2 | 3 | 4 | 5;
  /** Show the star rating row. Default: true */
  showRating?: boolean;
  /** Show the add-to-cart CTA. Default: true */
  showAddToCart?: boolean;
  /** Translated add-to-cart label (falls back to the shared default). */
  addToCartLabel?: string;
  /** Swap to the product's 2nd image on hover. Default: false */
  hoverSwap?: boolean;
  /** Autoplay interval in ms (0 = off). Default: 0 */
  autoPlay?: number;
  /**
   * Wrap around at the ends. Default: false (bounded rails read better) —
   * unless `autoPlay` is on, where looping keeps the rotation going.
   */
  loop?: boolean;
  /** Show pagination dots under the rail. Default: true */
  showDots?: boolean;
  className?: string;
}

/** Internal SPA paths ("/products") route through react-router. */
const isExternalHref = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');

export function ProductCarousel({
  products,
  heading,
  subheading,
  viewAllHref,
  viewAllLabel,
  onQuickView,
  loading = false,
  desktopSlides = 4,
  showRating = true,
  showAddToCart = true,
  addToCartLabel,
  hoverSwap = false,
  autoPlay = 0,
  loop,
  showDots = true,
  className,
}: ProductCarouselProps) {
  const { width } = useViewport();
  const shouldLoop = loop ?? autoPlay > 0;

  // Responsive geometry: phones get one full card with the next card
  // peeking (~1.2 visible) so the rail is obviously swipeable; small
  // screens fit 2; desktop fits `desktopSlides`.
  const { slidesPerView, peek, gap } =
    width < 640
      ? { slidesPerView: 1, peek: 56, gap: 12 }
      : width < 1024
        ? { slidesPerView: 2, peek: 40, gap: 16 }
        : { slidesPerView: desktopSlides, peek: 0, gap: 24 };

  if (!loading && products.length === 0) return null;

  const viewAll =
    viewAllHref && viewAllLabel ? (
      (() => {
        const cls =
          'group/link inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline underline-offset-4 ' +
          'rounded-[var(--radius-sm,6px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)] focus-visible:ring-offset-2';
        const style = { color: 'var(--color-primary, #2563eb)' };
        const arrow = (
          <svg
            className="h-4 w-4 rtl:rotate-180 transition-transform duration-[var(--duration-fast,150ms)] motion-safe:group-hover/link:translate-x-0.5 motion-safe:rtl:group-hover/link:-translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        );
        return isExternalHref(viewAllHref) ? (
          <a href={viewAllHref} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
            {viewAllLabel}
            {arrow}
          </a>
        ) : (
          <Link to={viewAllHref} className={cls} style={style}>
            {viewAllLabel}
            {arrow}
          </Link>
        );
      })()
    ) : null;

  return (
    <div className={className}>
      {/* Section bar — same premium header the theme homepages use. */}
      {(heading || viewAll) && (
        <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
          <div className="min-w-0">
            {heading && (
              <h2
                className="text-2xl font-bold tracking-tight text-balance sm:text-3xl text-[var(--color-foreground,#111827)]"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {heading}
              </h2>
            )}
            {subheading && (
              <p className="mt-1 text-sm sm:text-base" style={{ color: 'var(--color-muted, #6b7280)' }}>
                {subheading}
              </p>
            )}
          </div>
          {viewAll}
        </div>
      )}

      {loading ? (
        <Skeleton.ProductGrid
          count={desktopSlides}
          columns={cn(
            'grid-cols-1 sm:grid-cols-2',
            desktopSlides === 2 && 'lg:grid-cols-2',
            desktopSlides === 3 && 'lg:grid-cols-3',
            desktopSlides === 4 && 'lg:grid-cols-4',
            desktopSlides === 5 && 'lg:grid-cols-5'
          )}
        />
      ) : (
        <Carousel
          slidesPerView={slidesPerView}
          peek={peek}
          gap={gap}
          loop={shouldLoop}
          autoPlay={autoPlay}
          showArrows
          showDots={showDots}
          dotStyle="line"
          arrowStyle="floating"
        >
          {products.map((product) => (
            // Inner padding gives the card's hover lift + shadow breathing
            // room inside the track's overflow-hidden clip box.
            <div key={product._id} className="h-full px-0.5 pb-3 pt-2">
              <ProductCard product={product} onQuickView={onQuickView} className="h-full">
                <ProductCard.Image showBadge showQuickView={!!onQuickView} hoverSwap={hoverSwap} />
                <ProductCard.Body>
                  <ProductCard.Title />
                  {showRating && <ProductCard.Rating />}
                  <ProductCard.Price showCompareAt showDiscount className="mt-2" />
                  {showAddToCart && <ProductCard.Actions fullWidth className="mt-3" addToCartText={addToCartLabel} />}
                </ProductCard.Body>
              </ProductCard>
            </div>
          ))}
        </Carousel>
      )}
    </div>
  );
}

export default ProductCarousel;
