import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useThemeSettings } from '@shared/theme/ThemeProvider';

interface EditorialHeroProps {
  /** Featured-product photo used as the full-bleed image when the merchant
   *  hasn't set a background image (mirrors the old shared-Hero `media` prop). */
  media?: string;
}

/**
 * Elegance — Editorial full-bleed hero.
 *
 * A fashion-magazine cover: one full-bleed photograph, a dark bottom-anchored
 * legibility gradient, a hairline gold eyebrow, a large light-weight serif
 * headline pinned to the bottom-start, and a single minimal underlined CTA.
 *
 * Reads the SAME hero settings + i18n keys the theme already fed the shared
 * Hero (`season_label`/`heading`/`subheading`/`button_text`/`button_url`/
 * `background_image`/`overlay_opacity`) so merchant edits + translations keep
 * working. Fully token-driven and RTL-safe; if the photo 404s/CSP-blocks it
 * drops to the brand gradient instead of a broken band.
 */
export default function EditorialHero({ media }: EditorialHeroProps) {
  const { t } = useTranslation(['theme']);
  const { store } = useStore();
  const hero = useThemeSettings('hero') as Record<string, any>;
  const [imageOk, setImageOk] = useState(true);

  const eyebrow = hero.season_label || t('theme.section.hero.season_label');
  const title = hero.heading || store?.name || t('theme.section.hero.heading');
  const subtitle = hero.subheading || store?.description || t('theme.section.hero.subheading');
  const ctaLabel = hero.button_text || t('theme.section.hero.cta');
  const ctaHref = hero.button_url || '/products';
  const overlayOpacity = hero.overlay_opacity || 0;
  // Background image wins; otherwise fall back to a featured-product photo.
  const image = hero.background_image || media;

  return (
    <section
      className="relative isolate flex min-h-[32rem] h-[82vh] max-h-[44rem] items-end overflow-hidden text-white lg:max-h-[860px]"
      style={{
        background:
          'linear-gradient(160deg, var(--color-primary, #1a1a2e) 0%, var(--color-secondary, #c9a96e) 135%)',
      }}
    >
      {/* Full-bleed photograph (as <img> so a 404 / CSP block drops it to the gradient) */}
      {image && imageOk && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          onError={() => setImageOk(false)}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
        />
      )}

      {/* Editorial legibility gradients: bottom + start side */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/55 via-transparent to-transparent" />
      {overlayOpacity > 0 && (
        <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: overlayOpacity / 100 }} />
      )}

      {/* Hairline inner frame for editorial restraint */}
      <div className="pointer-events-none absolute inset-4 -z-10 border border-white/15 sm:inset-6 lg:inset-8" />

      <div className="relative z-10 mx-auto w-full max-w-[var(--layout-max-width,1280px)] px-6 pb-12 sm:px-8 sm:pb-16 lg:px-12 lg:pb-20">
        <div className="max-w-2xl">
          {eyebrow && (
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-[var(--color-secondary,#c9a96e)]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.4em] text-white/90 sm:text-xs">
                {eyebrow}
              </span>
            </div>
          )}
          <h1
            className="mt-5 text-balance text-5xl font-light leading-[0.95] sm:text-6xl lg:text-7xl xl:text-8xl"
            style={{ fontFamily: 'var(--font-family-heading, "Playfair Display", Georgia, serif)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 max-w-md text-base font-light leading-relaxed text-white/80 sm:text-lg">
              {subtitle}
            </p>
          )}
          <Link
            to={ctaHref}
            className="group mt-8 inline-flex items-center gap-3 text-xs font-medium uppercase tracking-[0.28em] text-white transition-colors duration-[var(--duration-base,250ms)] sm:text-sm"
          >
            <span className="border-b border-white/50 pb-1.5 transition-colors duration-[var(--duration-base,250ms)] group-hover:border-[var(--color-secondary,#c9a96e)]">
              {ctaLabel}
            </span>
            <svg
              className="h-4 w-4 transition-transform duration-[var(--duration-base,250ms)] group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
