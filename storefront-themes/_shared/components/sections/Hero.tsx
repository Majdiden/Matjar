import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

export interface HeroCta {
  label: string;
  href: string;
}

/** Imagery-forward e-commerce hero layouts (Shopify-style). */
export type HeroVariant = 'spotlight' | 'editorial' | 'split';

export interface HeroProps {
  title: string;
  subtitle?: string;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  /**
   * Layout archetype:
   *  - 'spotlight' : product/lifestyle photo dominant on one side, copy on the
   *                  other (e.g. a headphone/shoe spotlight with a Shop CTA).
   *  - 'editorial' : full-bleed lifestyle photo with copy overlaid (fashion).
   *  - 'split'     : a solid colour copy panel beside a full image panel.
   */
  variant?: HeroVariant;
  /** Merchant-set hero image (customizer). Highest precedence. */
  backgroundImage?: string;
  /** Featured-product / lifestyle image passed by the theme (2nd precedence). */
  media?: string;
  /** Theme's baked-in niche default image (final precedence) — so the hero is
   *  never empty and always looks like a real store. */
  defaultImage?: string;
  /** Extra darkening over an editorial image, 0–100. */
  overlayOpacity?: number;
  /** Small promo line (e.g. "Up to 40% off"). NO emojis. */
  saleText?: string;
  /** Copy-on-surface tone for spotlight/split text panels. */
  tone?: 'light' | 'dark';
  /** Editorial copy anchor. */
  align?: 'start' | 'center';
  /** Image focal point for cover crops, e.g. 'center', 'top'. */
  imagePosition?: string;
  className?: string;
}

/**
 * Shared, imagery-forward e-commerce hero.
 *
 * One shared component, distinct per theme via `variant` + design tokens
 * (palette, heading font, radius, shadow, motion) + the resolved image +
 * copy. Always image-first (never a bare gradient/SaaS block), never empty:
 * image precedence is backgroundImage → media → defaultImage, and an
 * `onError` falls through so a blocked/404 URL degrades gracefully.
 *
 * Token-driven, mobile-first, RTL-safe. No eyebrow pill. No emojis.
 */
export function Hero({
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  variant = 'spotlight',
  backgroundImage,
  media,
  defaultImage,
  overlayOpacity = 0,
  saleText,
  tone = 'light',
  align = 'start',
  imagePosition = 'center',
  className,
}: HeroProps) {
  const image = backgroundImage || media || defaultImage;
  const onDark = tone === 'dark';

  const arrow = (
    <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );

  // ── Editorial: full-bleed photo, copy overlaid with a legibility gradient ──
  if (variant === 'editorial') {
    return (
      <section
        className={cn('relative isolate overflow-hidden text-white', className)}
        style={{ background: 'linear-gradient(135deg, var(--color-secondary, #1e293b) 0%, var(--color-primary, #334155) 100%)' }}
      >
        {image && (
          <img
            src={image}
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="absolute inset-0 -z-10 w-full h-full object-cover"
            style={{ objectPosition: imagePosition }}
          />
        )}
        <div className={cn('absolute inset-0 -z-10', align === 'center'
          ? 'bg-black/40'
          : 'bg-gradient-to-t from-black/75 via-black/30 to-black/10 rtl:bg-gradient-to-t')} />
        {overlayOpacity > 0 && <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: overlayOpacity / 100 }} />}

        <div className={cn(
          'mx-auto w-full max-w-[var(--layout-max-width,1280px)] px-4 sm:px-6 lg:px-8',
          'min-h-[460px] sm:min-h-[540px] lg:min-h-[600px] flex flex-col justify-end py-12 sm:py-16 lg:py-20',
          align === 'center' && 'items-center justify-center text-center'
        )}>
          <div className={cn('max-w-xl', align === 'center' && 'max-w-2xl')}>
            {saleText && (
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/90">{saleText}</p>
            )}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-balance" style={{ fontFamily: 'var(--font-family-heading)' }}>
              {title}
            </h1>
            {subtitle && <p className="mt-4 text-base sm:text-lg text-white/85 leading-relaxed max-w-lg">{subtitle}</p>}
            <HeroCtas primaryCta={primaryCta} secondaryCta={secondaryCta} arrow={arrow} centered={align === 'center'} overImage />
          </div>
        </div>
      </section>
    );
  }

  // ── Split: colour copy panel beside a full image panel ──
  if (variant === 'split') {
    return (
      <section className={cn('relative isolate overflow-hidden', className)}>
        <div className="grid lg:grid-cols-2 min-h-[440px] sm:min-h-[520px]">
          {/* Copy panel */}
          <div
            className={cn('relative flex items-center order-2 lg:order-1', onDark ? 'text-white' : 'text-[var(--color-foreground,#111)]')}
            style={onDark
              ? { background: 'linear-gradient(135deg, var(--color-primary, #2563eb) 0%, var(--color-secondary, #1e40af) 100%)' }
              : { backgroundColor: 'var(--color-background, #fff)' }}
          >
            <div className="w-full px-6 sm:px-10 lg:px-14 py-12 lg:py-16 lg:ms-auto lg:max-w-[36rem]">
              {saleText && (
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: onDark ? 'rgba(255,255,255,.9)' : 'var(--color-primary,#2563eb)' }}>{saleText}</p>
              )}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.06] tracking-tight text-balance" style={{ fontFamily: 'var(--font-family-heading)' }}>
                {title}
              </h1>
              {subtitle && <p className={cn('mt-4 text-base sm:text-lg leading-relaxed max-w-md', onDark ? 'text-white/85' : 'text-[var(--color-muted,#6b7280)]')}>{subtitle}</p>}
              <HeroCtas primaryCta={primaryCta} secondaryCta={secondaryCta} arrow={arrow} onDark={onDark} />
            </div>
          </div>
          {/* Image panel */}
          <div className="relative order-1 lg:order-2 min-h-[260px] sm:min-h-[340px] lg:min-h-0 bg-[var(--color-muted,#e5e7eb)]/20">
            {image && (
              <img
                src={image}
                alt=""
                aria-hidden="true"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: imagePosition }}
              />
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── Spotlight (default): product photo dominant + copy beside it ──
  return (
    <section
      className={cn('relative isolate overflow-hidden', onDark ? 'text-white' : 'text-[var(--color-foreground,#111)]', className)}
      style={onDark
        ? { background: 'linear-gradient(135deg, var(--color-secondary, #0f172a) 0%, var(--color-primary, #1e293b) 100%)' }
        : { background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary, #2563eb) 7%, #fff) 0%, color-mix(in srgb, var(--color-accent, #f59e0b) 8%, #fff) 100%)' }}
    >
      {/* soft dot texture */}
      <div className="absolute inset-0 -z-10 opacity-[0.5]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, ${onDark ? 'rgba(255,255,255,.10)' : 'color-mix(in srgb, var(--color-foreground,#111) 7%, transparent)'} 1px, transparent 0)`,
        backgroundSize: '22px 22px',
      }} />
      <div className="mx-auto w-full max-w-[var(--layout-max-width,1280px)] px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 grid items-center gap-8 lg:gap-12 lg:grid-cols-2">
        {/* Copy */}
        <div className="relative z-10">
          {saleText && (
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: onDark ? 'rgba(255,255,255,.9)' : 'var(--color-primary,#2563eb)' }}>{saleText}</p>
          )}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-balance" style={{ fontFamily: 'var(--font-family-heading)' }}>
            {title}
          </h1>
          {subtitle && <p className={cn('mt-4 text-base sm:text-lg lg:text-xl leading-relaxed max-w-lg', onDark ? 'text-white/85' : 'text-[var(--color-muted,#6b7280)]')}>{subtitle}</p>}
          <HeroCtas primaryCta={primaryCta} secondaryCta={secondaryCta} arrow={arrow} onDark={onDark} />
        </div>
        {/* Product showcase */}
        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-4 sm:-inset-6 -z-10 rounded-full opacity-40 blur-3xl"
            style={{ background: 'var(--color-accent, #f59e0b)' }}
          />
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg,20px)] bg-white/60 shadow-[var(--shadow-xl)] ring-1 ring-black/5">
            {image && (
              <img
                src={image}
                alt=""
                aria-hidden="true"
                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                className="w-full h-full object-cover"
                style={{ objectPosition: imagePosition }}
                loading="eager"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroCtas({
  primaryCta,
  secondaryCta,
  arrow,
  onDark,
  overImage,
  centered,
}: {
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  arrow: React.ReactNode;
  onDark?: boolean;
  overImage?: boolean;
  centered?: boolean;
}) {
  if (!primaryCta && !secondaryCta) return null;
  // On an image/dark surface the primary button is white with theme-coloured
  // text; on a light surface it's the theme primary with white text.
  const primaryStyle: React.CSSProperties =
    overImage || onDark
      ? { backgroundColor: '#fff', color: 'var(--color-primary, #2563eb)' }
      : { backgroundColor: 'var(--color-primary, #2563eb)', color: '#fff' };
  const secondaryCls = overImage || onDark
    ? 'border-white/40 text-white hover:bg-white/15'
    : 'border-[var(--color-border,#e5e7eb)] text-[var(--color-foreground,#111)] hover:bg-black/[0.04]';
  return (
    <div className={cn('mt-7 flex flex-col sm:flex-row gap-3', centered && 'sm:justify-center')}>
      {primaryCta && (
        <Link
          to={primaryCta.href}
          className="group inline-flex items-center justify-center gap-2 rounded-[var(--radius,12px)] px-7 py-3.5 text-sm sm:text-base font-semibold shadow-[var(--shadow-lg)] transition-[transform,filter] duration-[var(--duration-fast,150ms)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
          style={primaryStyle}
        >
          {primaryCta.label}
          {arrow}
        </Link>
      )}
      {secondaryCta && (
        <Link
          to={secondaryCta.href}
          className={cn('inline-flex items-center justify-center gap-2 rounded-[var(--radius,12px)] border px-7 py-3.5 text-sm sm:text-base font-semibold backdrop-blur-sm transition-colors duration-[var(--duration-fast,150ms)]', secondaryCls)}
        >
          {secondaryCta.label}
        </Link>
      )}
    </div>
  );
}

export default Hero;
