import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';

interface SportzoneHeroProps {
  /** Featured-product image used full-bleed when the merchant hasn't set a
   *  background image. Passed from Home where featured products are fetched. */
  media?: string;
}

/**
 * Sportzone — high-energy, full-bleed athletic hero.
 *
 * Aggressive and dynamic: a dark stage with diagonal/skewed red colour blocks
 * and motion accent stripes, an ALL-CAPS condensed italic headline, and a big
 * angular (parallelogram) primary CTA. When a background image or featured
 * product photo is present it goes full-bleed under a dark diagonal overlay
 * gradient so the copy stays legible; a broken URL degrades to the dark
 * gradient + colour blocks (never a blank band).
 *
 * Self-contained + customizer-aware: reads the same `useThemeSettings('hero')`
 * values and i18n fallback keys Home fed the shared Hero.
 */
const SportzoneHero: React.FC<SportzoneHeroProps> = ({ media }) => {
  const { t } = useTranslation('theme');
  const { store } = useStore();
  const hero = useThemeSettings('hero');

  const eyebrow = hero.eyebrow_text || t('theme.hero.main.eyebrow');
  const line1 = hero.heading_line1 || t('theme.hero.main.headline_line1');
  const line2 = hero.heading_line2 || t('theme.hero.main.headline_line2');
  const subtitle = hero.subheading || store?.description || t('theme.hero.main.subheadline');
  const primaryCta = {
    label: hero.primary_button_text || t('theme.hero.main.cta_primary'),
    href: hero.primary_button_url || '/products',
  };
  const secondaryCta = {
    label: hero.secondary_button_text || t('theme.hero.main.cta_secondary'),
    href: hero.secondary_button_url || '/categories',
  };
  const backgroundImage: string | undefined = hero.background_image || undefined;
  const overlayOpacity: number = hero.overlay_opacity || 0;
  const image = backgroundImage || media;

  return (
    <section
      className="relative isolate overflow-hidden text-white"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--color-foreground, #111827) 88%, #000) 0%, var(--color-foreground, #111827) 60%, color-mix(in srgb, var(--color-secondary, #b91c1c) 35%, #000) 100%)',
      }}
    >
      {/* Full-bleed action shot (degrades to the dark gradient on error) */}
      {image && (
        <>
          <img
            src={image}
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="absolute inset-0 -z-10 w-full h-full object-cover opacity-70"
          />
          {/* dark diagonal legibility overlay, biased to the copy (start) side */}
          <div
            className="absolute inset-0 -z-10"
            style={{ background: 'linear-gradient(100deg, rgba(0,0,0,0.92) 18%, rgba(0,0,0,0.55) 52%, rgba(0,0,0,0.15) 100%)' }}
          />
          {overlayOpacity > 0 && <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: overlayOpacity / 100 }} />}
        </>
      )}

      {/* Diagonal skewed colour block on the end side */}
      <div
        className="pointer-events-none absolute inset-y-0 end-0 -z-10 w-1/2"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary, #dc2626), color-mix(in srgb, var(--color-primary, #dc2626) 55%, #000))',
          clipPath: 'polygon(28% 0, 100% 0, 100% 100%, 0% 100%)',
          opacity: image ? 0.45 : 0.92,
        }}
      />

      {/* Motion accent stripes */}
      <div
        className="pointer-events-none absolute -top-10 end-[18%] -z-10 h-[140%] w-2 sm:w-3 rotate-12 opacity-80"
        style={{ background: 'var(--color-accent, #ef4444)' }}
      />
      <div
        className="pointer-events-none absolute -top-10 end-[22%] -z-10 h-[140%] w-1 sm:w-1.5 rotate-12 opacity-50"
        style={{ background: '#fff' }}
      />
      <div
        className="pointer-events-none absolute -bottom-10 start-[-2%] -z-10 h-1.5 w-1/2 -rotate-3"
        style={{ background: 'linear-gradient(90deg, var(--color-primary, #dc2626), transparent)' }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[var(--layout-max-width,1280px)] px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
        <div className="max-w-2xl">
          {/* Eyebrow — angular accent bar + label (no filled pill) */}
          {eyebrow && (
            <span className="inline-flex items-center gap-3 text-xs sm:text-sm font-black uppercase italic tracking-[0.15em] text-white">
              <span className="h-3 w-7 -skew-x-12" aria-hidden="true" style={{ background: 'var(--color-primary, #dc2626)' }} />
              {eyebrow}
            </span>
          )}

          {/* Condensed italic ALL-CAPS headline */}
          <h1
            className="mt-5 font-black italic uppercase leading-[0.92] tracking-tight text-balance text-5xl sm:text-6xl lg:text-7xl xl:text-8xl"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            <span className="block">{line1}</span>
            <span
              className="block"
              style={{
                color: 'transparent',
                WebkitTextStroke: '1.5px #fff',
                // graceful fallback for browsers without text-stroke
                textShadow: '0 0 0 #fff',
              }}
            >
              {line2}
            </span>
          </h1>

          <p className="mt-5 max-w-lg text-base sm:text-lg font-medium text-white/85">
            {subtitle}
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Big angular (parallelogram) primary CTA */}
            <Link
              to={primaryCta.href}
              className="group inline-flex items-center justify-center gap-2 px-9 py-4 text-base font-black uppercase italic tracking-wider text-white shadow-[var(--shadow-lg)] [transform:skewX(-10deg)] transition-[transform,filter] duration-[var(--duration-fast,150ms)] hover:brightness-110 hover:[transform:skewX(-10deg)_translateY(var(--hover-lift,-3px))]"
              style={{ background: 'var(--color-primary, #dc2626)' }}
            >
              <span className="inline-flex items-center gap-2 [transform:skewX(10deg)]">
                {primaryCta.label}
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>

            <Link
              to={secondaryCta.href}
              className="inline-flex items-center justify-center px-9 py-4 text-base font-black uppercase italic tracking-wider text-white border-2 border-white/30 [transform:skewX(-10deg)] transition-colors duration-[var(--duration-fast,150ms)] hover:border-white hover:bg-white/10"
            >
              <span className="[transform:skewX(10deg)]">{secondaryCta.label}</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SportzoneHero;
