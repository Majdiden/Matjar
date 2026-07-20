import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { Carousel } from '../primitives/Carousel';

/**
 * ImageCarousel — a premium, CLICKABLE image/banner slideshow built on the
 * shared Carousel primitive (touch drag, RTL slide math, autoplay etiquette,
 * reduced-motion handling all inherited).
 *
 * Each slide is a full-bleed `object-cover` image. When `href` is set the
 * WHOLE slide becomes a link — internal `/paths` route through the SPA
 * router, external URLs open in a new tab (same detection the theme footers
 * use). Optional overlay copy (title/subtitle in the theme heading font over
 * a legibility scrim) and a CTA button.
 *
 * Link anatomy avoids invalid nested anchors: the slide link is a
 * "stretched" absolutely-positioned sibling behind the copy; the copy layer
 * is pointer-transparent so taps fall through, and only a CTA with its OWN
 * `ctaHref` becomes a second real link layered above.
 *
 * Robustness: a missing/404 image degrades to a token-coloured editorial
 * panel (never a broken-image glyph); 0 slides render nothing; 1 slide
 * renders without arrows/dots.
 *
 * Fully token-driven, mobile-first, RTL-safe (logical utilities only).
 */

export interface ImageCarouselSlide {
  image: string;
  /** Makes the whole slide clickable. Internal "/path" → SPA Link. */
  href?: string;
  /** Accessible description of the banner image / destination. */
  alt?: string;
  /** Overlay headline (theme heading font). */
  title?: string;
  /** Overlay supporting line. */
  subtitle?: string;
  /** CTA button label. Rendered when a destination exists (ctaHref or href). */
  ctaLabel?: string;
  /** CTA destination. Falls back to the slide `href`. */
  ctaHref?: string;
  /** Overlay copy anchor. Default: 'start' (logical — flips in RTL). */
  align?: 'start' | 'center' | 'end';
}

export interface ImageCarouselProps {
  slides: ImageCarouselSlide[];
  /** Autoplay interval in ms (0 = off). Default: 5000 */
  autoPlay?: number;
  /** Default: true */
  showArrows?: boolean;
  /** Default: true (overlaid on the bottom edge) */
  showDots?: boolean;
  /** Default: true */
  loop?: boolean;
  /** Round the banner corners with the theme radius. Default: true */
  rounded?: boolean;
  /**
   * Banner shape: '16/9' (tall) | '21/9' (standard) | '3/1' (slim) or any
   * CSS aspect-ratio string. A min-height keeps slim ratios legible on
   * phones. Default: '21/9'
   */
  aspect?: '16/9' | '21/9' | '3/1' | (string & {});
  className?: string;
  onSlideChange?: (index: number) => void;
}

/** Same internal/external detection the theme footers + menus use. */
const isExternalHref = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');

function SmartLink({
  href,
  className,
  children,
  ...rest
}: { href: string; className?: string; children?: React.ReactNode } & Record<string, any>) {
  return isExternalHref(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
      {children}
    </a>
  ) : (
    <Link to={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

export function ImageCarousel({
  slides,
  autoPlay = 5000,
  showArrows = true,
  showDots = true,
  loop = true,
  rounded = true,
  aspect = '21/9',
  className,
  onSlideChange,
}: ImageCarouselProps) {
  if (!slides || slides.length === 0) return null;

  return (
    <Carousel
      autoPlay={autoPlay}
      showArrows={showArrows}
      showDots={showDots}
      loop={loop}
      dotStyle="pill"
      dotPosition="overlay"
      arrowStyle="floating"
      onSlideChange={onSlideChange}
      className={className}
    >
      {slides.map((slide, i) => (
        <BannerSlide key={i} slide={slide} rounded={rounded} aspect={aspect} eager={i === 0} />
      ))}
    </Carousel>
  );
}

function BannerSlide({
  slide,
  rounded,
  aspect,
  eager,
}: {
  slide: ImageCarouselSlide;
  rounded: boolean;
  aspect: string;
  eager: boolean;
}) {
  const { t } = useTranslation('marketing');
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!slide.image && !imgFailed;
  const align = slide.align || 'start';
  const ctaHref = slide.ctaHref || slide.href;
  const hasCta = !!slide.ctaLabel && !!ctaHref;
  const hasCopy = !!slide.title || !!slide.subtitle || hasCta;
  // The CTA needs to be its own link only when it points somewhere the
  // stretched slide link doesn't already go.
  const ctaIsOwnLink = hasCta && (!slide.href || (slide.ctaHref !== undefined && slide.ctaHref !== slide.href));
  const linkLabel = slide.title || slide.alt || slide.ctaLabel || t('banner.open', 'View offer');

  const ctaClasses = cn(
    'inline-flex items-center gap-2 whitespace-nowrap rounded-[var(--radius,12px)] bg-white px-5 py-2.5',
    'text-sm font-semibold shadow-[var(--shadow-md)]',
    'transition-[transform,filter,box-shadow] duration-[var(--duration-fast,150ms)]',
    'motion-safe:hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[var(--shadow-lg)] motion-safe:active:translate-y-0'
  );
  const ctaStyle: React.CSSProperties = { color: 'var(--color-primary, #2563eb)' };
  const ctaArrow = (
    <svg className="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );

  return (
    <div
      className={cn(
        'group/banner relative isolate w-full overflow-hidden',
        'min-h-[200px] sm:min-h-[240px]',
        rounded && 'rounded-[var(--radius-lg,20px)] ring-1 ring-black/5 shadow-[var(--shadow-sm)]'
      )}
      style={{ aspectRatio: aspect }}
    >
      {/* ── Imagery (or the designed token panel when it's missing) ── */}
      {hasImage ? (
        <img
          src={slide.image}
          alt={slide.alt || ''}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setImgFailed(true)}
          className={cn(
            'absolute inset-0 -z-10 h-full w-full object-cover',
            'transition-transform duration-[var(--duration-slow,400ms)] ease-[var(--ease-standard,ease)]',
            slide.href && 'motion-safe:group-hover/banner:scale-[1.03]'
          )}
        />
      ) : (
        <>
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                'linear-gradient(135deg, var(--color-primary, #2563eb) 0%, color-mix(in srgb, var(--color-primary, #2563eb) 45%, var(--color-secondary, #1e293b)) 55%, var(--color-accent, #f59e0b) 130%)',
            }}
          />
          <div
            className="absolute inset-0 -z-10 opacity-[0.16]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
          />
        </>
      )}

      {/* Legibility scrim — only when copy sits on the image. */}
      {hasCopy && hasImage && (
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/65 via-black/30 to-black/10" aria-hidden="true" />
      )}

      {/* ── Stretched slide link (sibling, not a nested anchor) ── */}
      {slide.href && (
        <SmartLink
          href={slide.href}
          className={cn(
            'absolute inset-0 z-[1]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)] focus-visible:ring-inset',
            rounded && 'rounded-[var(--radius-lg,20px)]'
          )}
          aria-label={linkLabel}
        />
      )}

      {/* ── Overlay copy — pointer-transparent so taps reach the link ── */}
      {hasCopy && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-[2] flex flex-col justify-center gap-2 sm:gap-3',
            'p-5 sm:p-8 lg:p-12 text-white',
            align === 'center' && 'items-center text-center',
            align === 'end' && 'items-end text-end',
            align === 'start' && 'items-start text-start'
          )}
        >
          {slide.title && (
            <h3
              className="max-w-xl text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {slide.title}
            </h3>
          )}
          {slide.subtitle && (
            <p className="max-w-md text-sm leading-relaxed text-white/90 sm:text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              {slide.subtitle}
            </p>
          )}
          {hasCta &&
            (ctaIsOwnLink ? (
              // Separate destination → the CTA is a real link above the
              // stretched slide link.
              <SmartLink
                href={ctaHref!}
                className={cn(
                  ctaClasses,
                  'pointer-events-auto mt-2 relative z-[3]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/30'
                )}
                style={ctaStyle}
              >
                {slide.ctaLabel}
                {ctaArrow}
              </SmartLink>
            ) : (
              // Same destination as the slide → decorative button; the tap
              // falls through to the stretched link (no duplicate anchors).
              <span className={cn(ctaClasses, 'mt-2')} style={ctaStyle} aria-hidden="true">
                {slide.ctaLabel}
                {ctaArrow}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

export default ImageCarousel;
