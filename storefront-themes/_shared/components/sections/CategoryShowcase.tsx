import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import type { Category } from '../../types/commerce';

export interface CategoryShowcaseProps {
  categories: Category[];
  heading: string;
  subheading?: string;
  /** Max tiles to render (merchant setting `max_categories`, default 6). */
  maxCategories?: number;
  /** Show the per-category product count (merchant setting `show_product_count`). */
  showCount?: boolean;
  /** Localised count label, e.g. (n) => t('items_count', { count: n }). */
  countLabel?: (count: number) => string;
  /**
   * Drives the staggered card entrance. Pass the host page's
   * IntersectionObserver flag; defaults to true (cards visible immediately)
   * for hosts that don't wire scroll reveal.
   */
  visible?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Premium "shop by category" section (shared across themes).
 *
 * Editorial, image-led category tiles with a legibility scrim and the name
 * set in the theme's heading font. Mobile-first: a horizontal snap-scroll
 * rail on phones, a uniform grid on tablets, and — when there are 5+
 * categories — a bento layout on desktop where the first category becomes a
 * double-size feature tile. Categories without an image get a token-coloured
 * panel (primary/accent gradient + dot texture + oversized ghost initial) so
 * they read as designed, not missing.
 *
 * Token-driven (palette, radius, shadows, motion, heading font), RTL-safe
 * (logical utilities only), and all hover/entrance motion is gated behind
 * `motion-safe:` / disabled via `motion-reduce:`.
 */
export const CategoryShowcase = React.forwardRef<HTMLElement, CategoryShowcaseProps>(
  (
    {
      categories,
      heading,
      subheading,
      maxCategories = 6,
      showCount = true,
      countLabel,
      visible = true,
      className,
      style,
    },
    ref
  ) => {
    const items = categories.slice(0, maxCategories);
    if (items.length === 0) return null;
    // Desktop bento: promote the first category to a 2x2 feature tile once
    // there are enough tiles to wrap around it (5+ keeps the grid balanced).
    const hasFeature = items.length >= 5;

    return (
      <section ref={ref} className={cn('py-16 sm:py-20', className)} style={style}>
        <div className="mx-auto w-full max-w-[var(--layout-max-width,1280px)] px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-12">
            <span
              aria-hidden="true"
              className="mx-auto mb-4 block h-[3px] w-12 rounded-[var(--radius-pill,9999px)]"
              style={{ background: 'linear-gradient(90deg, var(--color-primary, #2563eb), var(--color-accent, #f59e0b))' }}
            />
            <h2
              className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {heading}
            </h2>
            {subheading && (
              <p className="mt-3 text-base sm:text-lg" style={{ color: 'var(--color-muted, #6b7280)' }}>
                {subheading}
              </p>
            )}
          </div>

          {/* Mobile: edge-to-edge snap rail. sm+: grid. lg: bento when 5+. */}
          <div
            className={cn(
              'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2',
              '-mx-4 px-4 scroll-ps-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              'sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0',
              'md:grid-cols-3 lg:gap-5'
            )}
          >
            {items.map((cat, i) => (
              <CategoryCard
                key={cat._id}
                category={cat}
                index={i}
                featured={hasFeature && i === 0}
                showCount={showCount}
                countLabel={countLabel}
                visible={visible}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }
);

CategoryShowcase.displayName = 'CategoryShowcase';

function CategoryCard({
  category,
  index,
  featured,
  showCount,
  countLabel,
  visible,
}: {
  category: Category;
  index: number;
  featured: boolean;
  showCount: boolean;
  countLabel?: (count: number) => string;
  visible: boolean;
}) {
  // A broken/blocked image URL degrades to the designed token panel instead
  // of white text floating over nothing.
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!category.image && !imgFailed;
  const initial = (category.name || '?').trim().charAt(0);
  const count =
    showCount && category.productCount !== undefined && countLabel
      ? countLabel(category.productCount)
      : null;

  return (
    // Outer wrapper owns layout (rail width / grid span) + the staggered
    // entrance, so the transition-delay never lags the hover motion inside.
    <div
      className={cn(
        'w-[46vw] min-w-[160px] max-w-[230px] shrink-0 snap-start',
        'sm:w-auto sm:min-w-0 sm:max-w-none sm:shrink',
        featured && 'lg:col-span-2 lg:row-span-2',
        'transition-[opacity,transform] duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))]',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none'
      )}
      style={{ transitionDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <Link
        to={`/categories/${category.slug}`}
        className={cn(
          'group relative isolate flex aspect-[4/5] w-full items-end overflow-hidden',
          'rounded-[var(--radius-lg,20px)] shadow-[var(--shadow-sm)]',
          'transition-[transform,box-shadow] duration-[var(--duration-base,250ms)] ease-[var(--ease-standard,ease)]',
          'hover:shadow-[var(--shadow-lg)] motion-safe:hover:-translate-y-1',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background,#fff)]',
          hasImage ? 'ring-1 ring-black/5' : 'ring-1 ring-[var(--color-border,#e5e7eb)]',
          featured && 'lg:aspect-auto lg:h-full'
        )}
      >
        {hasImage ? (
          <>
            {/* Photography fills the tile; scales on the compositor only. */}
            <img
              src={category.image}
              alt=""
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-[var(--duration-slow,500ms)] ease-[var(--ease-standard,ease)] motion-safe:group-hover:scale-[1.06]"
            />
            {/* Legibility scrim — neutral, photo-agnostic (same approach as the shared Hero). */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />
            {/* Theme-coloured tint rises on hover so the interaction inherits the palette. */}
            <div
              className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-[var(--duration-base,250ms)] motion-safe:group-hover:opacity-30"
              style={{ background: 'linear-gradient(to top, var(--color-primary, #2563eb), transparent 75%)' }}
            />
          </>
        ) : (
          <>
            {/* Token-coloured editorial panel for image-less categories. */}
            <div
              className="absolute inset-0 -z-10"
              style={{
                background:
                  'linear-gradient(140deg, color-mix(in srgb, var(--color-primary, #2563eb) 12%, var(--color-background, #ffffff)) 0%, color-mix(in srgb, var(--color-accent, #f59e0b) 16%, var(--color-background, #ffffff)) 100%)',
              }}
            />
            <div
              className="absolute inset-0 -z-10 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-foreground, #111827) 12%, transparent) 1px, transparent 0)',
                backgroundSize: '18px 18px',
              }}
            />
            {/* Oversized ghost initial in the heading font. */}
            <span
              aria-hidden="true"
              className={cn(
                '-z-10 absolute -end-2 -top-4 select-none text-[6.5rem] font-bold leading-none opacity-[0.12]',
                'motion-safe:transition-transform motion-safe:duration-[var(--duration-slow,500ms)] motion-safe:ease-[var(--ease-standard,ease)] motion-safe:group-hover:-rotate-6 motion-safe:group-hover:scale-110',
                featured && 'lg:-top-8 lg:text-[11rem]'
              )}
              style={{ color: 'var(--color-primary, #2563eb)', fontFamily: 'var(--font-family-heading)' }}
            >
              {initial}
            </span>
          </>
        )}

        {/* Name + count + arrow affordance */}
        <div className={cn('relative z-10 flex w-full items-end justify-between gap-3 p-4 sm:p-5', featured && 'lg:p-7')}>
          <div className="min-w-0">
            <h3
              className={cn('text-base font-semibold leading-snug text-balance sm:text-lg', featured && 'lg:text-2xl')}
              style={{
                fontFamily: 'var(--font-family-heading)',
                color: hasImage ? '#ffffff' : 'var(--color-foreground, #111827)',
              }}
            >
              {category.name}
            </h3>
            {count && (
              <p
                className="mt-1 text-xs sm:text-sm"
                style={{ color: hasImage ? 'rgba(255,255,255,0.78)' : 'var(--color-muted, #6b7280)' }}
              >
                {count}
              </p>
            )}
          </div>
          <span
            aria-hidden="true"
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-pill,9999px)]',
              'transition-[transform,background-color,color] duration-[var(--duration-base,250ms)] ease-[var(--ease-standard,ease)]',
              'motion-safe:group-hover:-translate-y-0.5',
              hasImage
                ? 'bg-white/15 text-white backdrop-blur-sm group-hover:bg-white group-hover:text-[color:var(--color-primary,#2563eb)]'
                : 'bg-[color-mix(in_srgb,var(--color-primary,#2563eb)_12%,transparent)] text-[color:var(--color-primary,#2563eb)] group-hover:bg-[var(--color-primary,#2563eb)] group-hover:text-white'
            )}
          >
            <svg
              className="h-4 w-4 transition-transform duration-[var(--duration-fast,150ms)] rtl:rotate-180 motion-safe:group-hover:translate-x-0.5 motion-safe:rtl:group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        </div>
      </Link>
    </div>
  );
}

export default CategoryShowcase;
