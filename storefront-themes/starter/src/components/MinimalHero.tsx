import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings } from '@shared/theme/ThemeProvider';

/**
 * MinimalHero — the restrained "blank canvas" reference hero.
 *
 * Concept: generous whitespace, one strong headline, a thin muted subtitle,
 * a single clear CTA, and a small geometric accent mark (a short rule + dot).
 * The optional featured `media` sits in a plain rounded frame. If a merchant
 * sets a background image it switches to a quiet full-bleed mode with a light
 * legibility wash; a broken image degrades back to the clean light layout.
 *
 * Token-driven only (`--color-*`, `--radius*`, `--shadow-*`, `--duration-*`,
 * `--ease-*`, `--hover-lift`, `--font-family-heading`). Reads the same `hero`
 * settings + i18n fallback keys the theme previously fed the shared Hero
 * (heading, subheading, button_text/url, background_image, overlay_opacity)
 * so merchant customization + translations keep working. `media` (gated on
 * background_image upstream) is passed in from Home.
 */

interface MinimalHeroProps {
  /** Featured product image shown in the simple frame (no background image). */
  media?: string;
  className?: string;
}

export default function MinimalHero({ media, className }: MinimalHeroProps) {
  const { t } = useTranslation('theme');
  const hero = useThemeSettings('hero');

  const heading = hero.heading || t('theme.hero.main.headline');
  const subheading = hero.subheading || t('theme.hero.main.subheadline');
  const ctaLabel = hero.button_text || t('theme.hero.main.cta');
  const ctaHref = hero.button_url || '/products';
  const backgroundImage: string | undefined = hero.background_image || undefined;
  const overlayOpacity: number = hero.overlay_opacity || 0;

  const [bgOk, setBgOk] = useState(true);
  const [mediaOk, setMediaOk] = useState(true);
  const showBg = !!backgroundImage && bgOk;
  const showMedia = !!media && !backgroundImage && mediaOk;

  const cta = (light: boolean) => (
    <Link
      to={ctaHref}
      className="group inline-flex items-center justify-center gap-2 rounded-[var(--radius,12px)] px-7 py-3.5 text-sm font-semibold shadow-[var(--shadow-sm)] transition-[transform,filter] duration-[var(--duration-base,250ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] hover:[transform:var(--hover-lift,translateY(-4px))] hover:brightness-105 active:translate-y-0 sm:text-base"
      style={{ backgroundColor: light ? '#ffffff' : 'var(--color-primary,#3b82f6)', color: light ? 'var(--color-primary,#3b82f6)' : '#ffffff' }}
    >
      {ctaLabel}
      <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
    </Link>
  );

  // Quiet full-bleed mode when a merchant supplies a background image.
  if (showBg) {
    return (
      <section className={`relative isolate overflow-hidden rounded-[var(--radius-lg,20px)] text-white ${className ?? ''}`}>
        <img
          src={backgroundImage}
          alt=""
          aria-hidden="true"
          onError={() => setBgOk(false)}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/55 via-black/25 to-black/10" />
        {overlayOpacity > 0 && (
          <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: overlayOpacity / 100 }} />
        )}
        <div className="mx-auto flex max-w-2xl flex-col items-start px-6 py-20 sm:py-28">
          <span aria-hidden="true" className="h-0.5 w-10 rounded-full bg-white/80" />
          <h1 className="mt-5 text-3xl font-semibold leading-tight sm:text-5xl" style={{ fontFamily: 'var(--font-family-heading)' }}>
            {heading}
          </h1>
          <p className="mt-4 max-w-md text-base text-white/85 sm:text-lg">{subheading}</p>
          <div className="mt-8">{cta(true)}</div>
        </div>
      </section>
    );
  }

  // Clean light layout — the default minimal composition.
  return (
    <section className={`relative ${className ?? ''}`}>
      <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        {/* Copy */}
        <div className="flex flex-col items-start">
          {/* geometric accent mark: a short rule + a dot */}
          <span aria-hidden="true" className="flex items-center gap-2">
            <span className="h-0.5 w-10 rounded-full" style={{ backgroundColor: 'var(--color-primary,#3b82f6)' }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary,#3b82f6)' }} />
          </span>

          <h1
            className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl"
            style={{ color: 'var(--color-foreground,#111827)', fontFamily: 'var(--font-family-heading)' }}
          >
            {heading}
          </h1>

          <p className="mt-4 max-w-md text-base leading-relaxed sm:text-lg" style={{ color: 'var(--color-muted,#6b7280)' }}>
            {subheading}
          </p>

          <div className="mt-8">{cta(false)}</div>
        </div>

        {/* Optional media in a simple rounded frame */}
        {showMedia && (
          <div className="hidden md:block">
            <div
              className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg,20px)] border shadow-[var(--shadow-sm)]"
              style={{ borderColor: 'var(--color-border,#e5e7eb)' }}
            >
              <img
                src={media}
                alt=""
                loading="eager"
                onError={() => setMediaOk(false)}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
