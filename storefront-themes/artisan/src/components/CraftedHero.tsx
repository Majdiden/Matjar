import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useThemeSettings } from '@shared/theme/ThemeProvider';

interface CraftedHeroProps {
  /** Featured-product photo shown in the polaroid frame (mirrors the old
   *  shared-Hero `media` prop). */
  media?: string;
}

/**
 * Artisan — Crafted, tactile hero.
 *
 * Cozy and human: a warm cream/terracotta wash with a subtle paper grain, a
 * script headline with a hand-drawn underline, a "handmade" stamp badge, and
 * the featured product set in a slightly-rotated polaroid with washi tape.
 *
 * Reads the SAME hero settings + i18n keys the theme already fed the shared
 * Hero (`eyebrow_text`/`heading_line1`/`heading_line2`/`subheading`/
 * `primary_button_*`/`secondary_button_*`) so merchant edits + translations
 * keep working. Token-driven + RTL-safe; if the photo fails it degrades to a
 * themed terracotta panel.
 */
export default function CraftedHero({ media }: CraftedHeroProps) {
  const { t } = useTranslation(['theme']);
  const { store } = useStore();
  const hero = useThemeSettings('hero') as Record<string, any>;
  const [mediaOk, setMediaOk] = useState(true);

  const eyebrow = hero.eyebrow_text || t('theme.section.hero.eyebrow');
  const line1 = hero.heading_line1 || t('theme.section.hero.heading_line1');
  const line2 = hero.heading_line2 || t('theme.section.hero.heading_line2');
  const subtitle = hero.subheading || store?.description || t('theme.section.hero.subheading');
  const primaryLabel = hero.primary_button_text || t('theme.section.hero.primary_cta');
  const primaryHref = hero.primary_button_url || '/products';
  const secondaryLabel = hero.secondary_button_text || t('theme.section.hero.secondary_cta');
  const secondaryHref = hero.secondary_button_url || '/categories';

  const showMedia = !!media && mediaOk;

  return (
    <section className="relative isolate overflow-hidden bg-[var(--color-background,#fffbf5)]">
      {/* Warm terracotta wash + soft glows (token-driven, no image needed) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
        style={{ background: 'linear-gradient(135deg, transparent 30%, var(--color-accent, #d97706) 100%)' }}
      />
      <div
        className="pointer-events-none absolute -end-16 -top-24 -z-10 h-96 w-96 rounded-full opacity-[0.12] blur-3xl"
        style={{ background: 'var(--color-accent, #d97706)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -start-20 -z-10 h-[26rem] w-[26rem] rounded-full opacity-[0.10] blur-3xl"
        style={{ background: 'var(--color-primary, #92400e)' }}
      />
      {/* Subtle paper / linen grain */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />

      <div className="mx-auto grid w-full max-w-[var(--layout-max-width,1280px)] items-center gap-10 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:gap-12 lg:py-24">
        {/* Copy */}
        <div className="text-center lg:text-start">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill,9999px)] border border-[var(--color-accent,#d97706)]/40 bg-[var(--color-accent,#d97706)]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary,#92400e)]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 21s-6.7-4.35-9.33-8.04C.9 10.36 1.4 7.3 3.6 5.9c1.74-1.1 3.9-.62 5.1.86L12 9.9l3.3-3.14c1.2-1.48 3.36-1.96 5.1-.86 2.2 1.4 2.7 4.46.93 7.06C18.7 16.65 12 21 12 21z" />
              </svg>
              {eyebrow}
            </span>
          )}
          <h1
            className="mt-5 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl"
            style={{ fontFamily: 'var(--font-family-heading, "Caveat", cursive)' }}
          >
            <span className="block text-[var(--color-primary,#92400e)]">{line1}</span>
            <span className="relative inline-block text-[var(--color-accent,#d97706)]">
              {line2}
              {/* hand-drawn underline */}
              <svg
                className="absolute -bottom-3 start-0 w-full"
                height="14"
                viewBox="0 0 200 14"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M2 8c40-6 120-7 196-3" stroke="var(--color-accent, #d97706)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          {subtitle && (
            <p className="mx-auto mt-7 max-w-md text-base leading-relaxed text-[var(--color-secondary,#78350f)]/80 lg:mx-0">
              {subtitle}
            </p>
          )}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              to={primaryHref}
              className="group inline-flex items-center justify-center gap-2 rounded-[var(--radius,12px)] bg-[var(--color-primary,#92400e)] px-7 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-md)] transition-transform duration-[var(--duration-fast,150ms)] hover:[transform:var(--hover-lift,translateY(-2px))] active:translate-y-0"
            >
              {primaryLabel}
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            {secondaryLabel && (
              <Link
                to={secondaryHref}
                className="inline-flex items-center justify-center rounded-[var(--radius,12px)] border-2 border-[var(--color-primary,#92400e)]/30 px-7 py-3.5 text-sm font-semibold text-[var(--color-primary,#92400e)] transition-colors duration-[var(--duration-fast,150ms)] hover:border-[var(--color-primary,#92400e)] hover:bg-[var(--color-primary,#92400e)]/5"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>

        {/* Polaroid showcase */}
        <div className="flex justify-center lg:justify-end">
          <div className="relative w-[78%] max-w-sm rotate-[-3deg] rtl:rotate-[3deg]">
            {/* washi tape */}
            <span className="absolute -top-3 left-1/2 z-10 h-6 w-24 -translate-x-1/2 -rotate-2 bg-white/50 shadow-[var(--shadow-xs)] backdrop-blur-sm" />
            <div className="rounded-[var(--radius-sm,6px)] bg-white p-3 pb-12 shadow-[var(--shadow-xl)] ring-1 ring-black/5">
              <div
                className="aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-sm,6px)]"
                style={{ background: 'linear-gradient(135deg, var(--color-accent, #d97706), var(--color-primary, #92400e))' }}
              >
                {showMedia ? (
                  <img
                    src={media}
                    alt=""
                    onError={() => setMediaOk(false)}
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/70">
                    <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7" />
                    </svg>
                  </div>
                )}
              </div>
              {/* handwritten caption */}
              <p
                className="absolute inset-x-0 bottom-3 text-center text-2xl text-[var(--color-primary,#92400e)]"
                style={{ fontFamily: 'var(--font-family-heading, "Caveat", cursive)' }}
              >
                {eyebrow || line1}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
