import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings } from '@shared/theme/ThemeProvider';

interface InteriorHeroProps {
  /** Featured-product / interior photo used as the framed image when the
   *  merchant hasn't set a background image (mirrors the shared-Hero `media`). */
  media?: string;
}

/**
 * Home Decor — Calm, architectural hero.
 *
 * Magazine-interior feel: an asymmetric two-column layout (narrow text column
 * + a wide framed interior photo with an offset accent frame), generous
 * whitespace, a thin accent rule, a light serif headline, and an understated
 * CTA pair. Stacks on mobile with a bounded image height.
 *
 * Reads the SAME hero settings + i18n keys the theme already fed the shared
 * Hero (`badge_text`/`heading_line1`/`heading_line2`/`subheading`/
 * `primary_button_*`/`secondary_button_*`/`background_image`/`overlay_opacity`)
 * so merchant edits + translations keep working. Token-driven + RTL-safe; the
 * image degrades to a themed neutral panel if it fails to load.
 */
export default function InteriorHero({ media }: InteriorHeroProps) {
  const { t } = useTranslation(['theme']);
  const hero = useThemeSettings('hero') as Record<string, any>;
  const [imageOk, setImageOk] = useState(true);

  const eyebrow = hero.badge_text || t('theme.hero.badge_text');
  const line1 = hero.heading_line1 || t('theme.hero.heading_line1');
  const line2 = hero.heading_line2 || t('theme.hero.heading_line2');
  const subtitle = hero.subheading || t('theme.hero.subheading');
  const primaryLabel = hero.primary_button_text || t('theme.hero.primary_cta');
  const primaryHref = hero.primary_button_url || '/products';
  const secondaryLabel = hero.secondary_button_text || t('theme.hero.secondary_cta');
  const secondaryHref = hero.secondary_button_url || '/categories';
  const overlayOpacity = hero.overlay_opacity || 0;
  const image = hero.background_image || media;
  const showImage = !!image && imageOk;

  return (
    <section className="relative overflow-hidden bg-[var(--color-background,#f9fafb)]">
      <div className="mx-auto grid w-full max-w-[var(--layout-max-width,1280px)] items-center gap-10 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-12 lg:gap-14 lg:py-28">
        {/* Copy — narrow column */}
        <div className="lg:col-span-5">
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-[var(--color-accent,#d4a76a)]" />
            {eyebrow && (
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-[var(--color-primary,#6b7280)]">
                {eyebrow}
              </span>
            )}
          </div>
          <h1
            className="mt-6 text-4xl font-light leading-[1.1] text-[var(--color-secondary,#374151)] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--font-family-heading, "Cormorant Garamond", Georgia, serif)' }}
          >
            <span className="block">{line1}</span>
            <span className="block italic text-[var(--color-primary,#6b7280)]">{line2}</span>
          </h1>
          {subtitle && (
            <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--color-primary,#6b7280)] sm:text-lg">
              {subtitle}
            </p>
          )}
          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              to={primaryHref}
              className="inline-flex items-center justify-center rounded-[var(--radius,12px)] bg-[var(--color-secondary,#374151)] px-8 py-3.5 text-sm font-medium tracking-wide text-white shadow-[var(--shadow-sm)] transition-all duration-[var(--duration-base,250ms)] hover:shadow-[var(--shadow-md)] hover:[transform:var(--hover-lift,translateY(-2px))]"
            >
              {primaryLabel}
            </Link>
            {secondaryLabel && (
              <Link
                to={secondaryHref}
                className="group inline-flex items-center gap-2 text-sm font-medium text-[var(--color-secondary,#374151)] transition-colors hover:text-[var(--color-accent,#d4a76a)]"
              >
                {secondaryLabel}
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Framed interior image — wide column */}
        <div className="lg:col-span-7">
          <div className="relative isolate">
            {/* offset accent frame for architectural depth */}
            <div className="pointer-events-none absolute -bottom-4 -end-4 -z-10 hidden h-full w-full rounded-[var(--radius-lg,20px)] border border-[var(--color-accent,#d4a76a)]/40 sm:block" />
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg,20px)] bg-[var(--color-muted,#9ca3af)]/15 shadow-[var(--shadow-xl)]">
              {showImage ? (
                <>
                  <img
                    src={image}
                    alt=""
                    onError={() => setImageOk(false)}
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                  {overlayOpacity > 0 && (
                    <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity / 100 }} />
                  )}
                </>
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--color-primary, #6b7280) 0%, var(--color-secondary, #374151) 100%)',
                  }}
                >
                  <svg className="h-20 w-20 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
