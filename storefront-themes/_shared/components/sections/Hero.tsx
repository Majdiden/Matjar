import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

export interface HeroCta {
  label: string;
  href: string;
}

export interface HeroProps {
  /** Small chip above the headline (e.g. "New Collection"). */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  /** Full-bleed background image URL. When set, a legibility gradient is
   *  layered automatically; `overlayOpacity` adds an extra darkening. */
  backgroundImage?: string;
  /** Extra dark overlay over a background image, 0–100. */
  overlayOpacity?: number;
  /** Product/lifestyle image shown as a floating showcase (desktop) when
   *  there is no full-bleed background image — turns the empty gradient
   *  hero into a real, premium composition. */
  media?: string;
  /** Horizontal alignment of the copy. Defaults to 'start' when a media
   *  showcase is present, 'center' otherwise. */
  align?: 'center' | 'start';
  className?: string;
}

/**
 * Shared premium hero.
 *
 * Mobile-first and fully token-driven: the gradient is built from
 * `--color-primary`/`--color-secondary`, depth comes from the platform
 * elevation + motion tokens, and corners/buttons honour `--radius*`. It is
 * label-agnostic — each theme passes already-translated copy, so the same
 * component serves every storefront while keeping per-theme personality
 * through its palette, fonts and motion tokens.
 *
 * Three compositions, chosen automatically:
 *   1. `backgroundImage`  → full-bleed photo + legibility gradient.
 *   2. `media` (no bg)    → split layout: copy + floating product card.
 *   3. neither            → rich gradient with layered glow + dot texture.
 *
 * There is always a primary CTA path (callers pass an i18n default), so a
 * brand-new store never renders a bare, button-less hero.
 */
export function Hero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  backgroundImage,
  overlayOpacity = 0,
  media,
  align,
  className,
}: HeroProps) {
  const hasMedia = !!media && !backgroundImage;
  const resolvedAlign = align ?? (hasMedia ? 'start' : 'center');
  const centered = resolvedAlign === 'center';

  const gradient =
    'linear-gradient(135deg, var(--color-primary, #2563eb) 0%, var(--color-secondary, #1e40af) 100%)';

  return (
    <section
      className={cn('relative isolate overflow-hidden text-white', className)}
      // Gradient is ALWAYS the base layer, so if a background image is blocked
      // (CSP) or 404s the hero degrades to the gradient instead of a blank/
      // broken band.
      style={{ background: gradient }}
    >
      {/* Background image (as <img> so onError can drop it) + legibility gradient */}
      {backgroundImage && (
        <>
          <img
            src={backgroundImage}
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="absolute inset-0 -z-10 w-full h-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
          {overlayOpacity > 0 && (
            <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: overlayOpacity / 100 }} />
          )}
        </>
      )}

      {/* Decorative depth for the gradient compositions */}
      {!backgroundImage && (
        <>
          {/* dotted texture */}
          <div
            className="absolute inset-0 -z-10 opacity-[0.18]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
          />
          {/* glow orbs */}
          <div className="pointer-events-none absolute -top-24 -start-24 -z-10 w-[28rem] h-[28rem] rounded-full bg-white/15 blur-3xl" />
          <div
            className="pointer-events-none absolute -bottom-32 -end-16 -z-10 w-[34rem] h-[34rem] rounded-full blur-3xl opacity-40"
            style={{ background: 'var(--color-accent, #f59e0b)' }}
          />
        </>
      )}

      <div
        className={cn(
          'mx-auto w-full max-w-[var(--layout-max-width,1280px)] px-4 sm:px-6 lg:px-8',
          'py-16 sm:py-20 lg:py-28',
          hasMedia ? 'grid items-center gap-10 lg:grid-cols-2' : ''
        )}
      >
        {/* Copy */}
        <div
          className={cn(
            'relative z-10 flex flex-col',
            centered ? 'items-center text-center mx-auto max-w-2xl' : 'items-start text-start max-w-xl'
          )}
        >
          {eyebrow && (
            <span className="inline-flex items-center rounded-[var(--radius-pill,9999px)] bg-white/15 backdrop-blur-sm px-3.5 py-1.5 text-xs sm:text-sm font-semibold tracking-wide ring-1 ring-white/20">
              {eyebrow}
            </span>
          )}
          <h1
            className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight text-balance"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className={cn('mt-4 text-base sm:text-lg lg:text-xl text-white/85 leading-relaxed', centered ? 'max-w-2xl' : 'max-w-lg')}>
              {subtitle}
            </p>
          )}

          {(primaryCta || secondaryCta) && (
            <div className={cn('mt-8 flex flex-col sm:flex-row gap-3', centered && 'sm:justify-center')}>
              {primaryCta && (
                <Link
                  to={primaryCta.href}
                  className="group inline-flex items-center justify-center gap-2 rounded-[var(--radius,12px)] bg-white px-7 py-3.5 text-sm sm:text-base font-semibold shadow-[var(--shadow-lg)] transition-[transform,filter] duration-[var(--duration-fast,150ms)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
                  style={{ color: 'var(--color-secondary, #1e40af)' }}
                >
                  {primaryCta.label}
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              )}
              {secondaryCta && (
                <Link
                  to={secondaryCta.href}
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--radius,12px)] border border-white/40 bg-white/5 px-7 py-3.5 text-sm sm:text-base font-semibold text-white backdrop-blur-sm transition-colors duration-[var(--duration-fast,150ms)] hover:bg-white/15"
                >
                  {secondaryCta.label}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Floating product showcase (desktop) */}
        {hasMedia && (
          <div className="relative hidden lg:block">
            <div
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[var(--radius-lg,20px)] opacity-50 blur-2xl"
              style={{ background: 'var(--color-accent, #f59e0b)' }}
            />
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg,20px)] bg-white/10 shadow-[var(--shadow-xl)] ring-1 ring-white/20 [transform:perspective(1200px)_rotateY(-6deg)]">
              <img src={media} alt="" className="h-full w-full object-cover" loading="eager" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Hero;
