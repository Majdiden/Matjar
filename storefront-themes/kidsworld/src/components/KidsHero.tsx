import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings } from '@shared/theme/ThemeProvider';

/**
 * KidsHero — a super-playful toy-store hero.
 *
 * Concept: a joyful, springy playground band — bouncy rounded shapes,
 * floating star/cloud/balloon doodles, a chunky two-line headline with a
 * winking sparkle, a confetti polka-dot backdrop, big pill CTAs, and the
 * featured `media` toy nestled in a wobbly rounded bubble. Hover springs
 * use the theme's bouncy easing + hover-lift tokens.
 *
 * Token-driven only (`--color-*`, `--radius*`, `--shadow-*`, `--duration-*`,
 * `--ease-*`, `--hover-lift`, `--font-family-heading`). It reads the very
 * same `hero` settings + i18n fallback keys the theme previously fed the
 * shared Hero (heading_line1/2, subheading, button_text/url, background_image,
 * overlay_opacity) so merchant customization + translations keep working.
 * `media` (a featured product image, gated on background_image upstream) is
 * passed in from Home.
 */

interface KidsHeroProps {
  /** Featured product image shown in the toy bubble (no background image). */
  media?: string;
}

// Decorative confetti dots scattered behind the copy. Positions/colors are a
// theme-local visual concern; white dots use rgba (not hex) and the accent
// dots pull `--color-accent` so they track the merchant palette.
const CONFETTI: Array<{ top: string; start: string; size: number; accent?: boolean; delay: string }> = [
  { top: '14%', start: '6%', size: 16, accent: true, delay: '0s' },
  { top: '70%', start: '10%', size: 10, delay: '0.4s' },
  { top: '30%', start: '22%', size: 8, delay: '0.9s' },
  { top: '82%', start: '30%', size: 12, accent: true, delay: '0.2s' },
  { top: '18%', start: '52%', size: 9, delay: '0.7s' },
  { top: '60%', start: '60%', size: 14, accent: true, delay: '1.1s' },
  { top: '38%', start: '88%', size: 11, delay: '0.3s' },
  { top: '78%', start: '82%', size: 9, delay: '0.6s' },
];

// Friendly toy emojis used as the degrade-proof fallback scene when there is
// no featured product image. Emojis are decorative (no i18n needed).
const TOY_EMOJIS = ['🧸', '🚂', '🎨', '⭐', '🎈', '🎲'];

export default function KidsHero({ media }: KidsHeroProps) {
  const { t } = useTranslation('theme');
  const hero = useThemeSettings('hero');

  const line1 = hero.heading_line1 || t('theme.hero.heading_line1');
  const line2 = hero.heading_line2 || t('theme.hero.heading_line2');
  const subheading = hero.subheading || t('theme.hero.subheading');
  const ctaLabel = hero.button_text || t('theme.hero.cta');
  const ctaHref = hero.button_url || '/products';
  const backgroundImage: string | undefined = hero.background_image || undefined;
  const overlayOpacity: number = hero.overlay_opacity || 0;

  const [bgOk, setBgOk] = useState(true);
  const [mediaOk, setMediaOk] = useState(true);
  const showBg = !!backgroundImage && bgOk;
  const showMedia = !!media && !backgroundImage && mediaOk;

  return (
    <section
      className="relative isolate overflow-hidden text-white rounded-[var(--radius-lg,20px)]"
      // Gradient is ALWAYS the base, so a blocked/404 background image degrades
      // to the playful gradient instead of a broken band.
      style={{ background: 'linear-gradient(135deg, var(--color-primary,#ec4899) 0%, var(--color-secondary,#8b5cf6) 100%)' }}
    >
      {showBg ? (
        <>
          <img
            src={backgroundImage}
            alt=""
            aria-hidden="true"
            onError={() => setBgOk(false)}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/60 via-black/25 to-black/10" />
          {overlayOpacity > 0 && (
            <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: overlayOpacity / 100 }} />
          )}
        </>
      ) : (
        <>
          {/* polka-dot texture */}
          <div
            className="absolute inset-0 -z-10 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 2px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />
          {/* glow blobs */}
          <div className="pointer-events-none absolute -top-20 -start-16 -z-10 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div
            className="pointer-events-none absolute -bottom-24 -end-10 -z-10 h-80 w-80 rounded-full opacity-50 blur-3xl"
            style={{ background: 'var(--color-accent,#fbbf24)' }}
          />
          {/* confetti dots */}
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute -z-10 rounded-full animate-pulse"
              style={{
                top: c.top,
                insetInlineStart: c.start,
                width: c.size,
                height: c.size,
                background: c.accent ? 'var(--color-accent,#fbbf24)' : 'rgba(255,255,255,0.85)',
                animationDelay: c.delay,
                animationDuration: '2.4s',
              }}
            />
          ))}
          {/* floating cloud doodle */}
          <svg aria-hidden="true" className="pointer-events-none absolute top-8 end-6 h-12 w-20 text-white/40 animate-bounce" style={{ animationDuration: '4s' }} viewBox="0 0 64 40" fill="currentColor">
            <ellipse cx="20" cy="26" rx="16" ry="12" />
            <ellipse cx="38" cy="20" rx="18" ry="14" />
            <ellipse cx="48" cy="28" rx="12" ry="10" />
          </svg>
        </>
      )}

      <div className="relative z-10 mx-auto grid w-full max-w-[var(--layout-max-width,1280px)] items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-10 lg:px-8 lg:py-24">
        {/* Copy */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-start">
          {/* decorative sparkle row (no copy, so no new i18n key) */}
          <span aria-hidden="true" className="mb-3 inline-flex items-center gap-1 rounded-[var(--radius-pill,9999px)] bg-white/20 px-4 py-1.5 text-sm font-extrabold ring-1 ring-white/30 backdrop-blur-sm">
            <span className="animate-pulse">✨</span>
            <span style={{ color: 'var(--color-accent,#fbbf24)' }}>★</span>
            <span className="animate-pulse">✨</span>
          </span>

          <h1
            className="text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            <span className="block drop-shadow-[0_2px_0_rgba(0,0,0,0.12)]">{line1}</span>
            <span className="mt-1 inline-flex items-center gap-2">
              <span style={{ color: 'var(--color-accent,#fbbf24)' }} className="drop-shadow-[0_2px_0_rgba(0,0,0,0.18)]">
                {line2}
              </span>
              {/* winking sparkle */}
              <svg aria-hidden="true" className="inline h-7 w-7 shrink-0 animate-pulse sm:h-9 sm:w-9" viewBox="0 0 24 24" fill="var(--color-accent,#fbbf24)">
                <path d="M12 2l2.2 6.3L20.5 9l-5 4.2L17 20l-5-3.4L7 20l1.5-6.8-5-4.2 6.3-.7z" />
              </svg>
            </span>
          </h1>

          <p className="mt-4 max-w-md text-base font-semibold text-white/90 sm:text-lg">
            {subheading}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              to={ctaHref}
              className="group inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill,9999px)] bg-white px-8 py-4 text-base font-extrabold shadow-[var(--shadow-lg)] transition-transform duration-[var(--duration-base,300ms)] ease-[var(--ease-entrance,cubic-bezier(0.34,1.56,0.64,1))] hover:[transform:var(--hover-lift,translateY(-6px)_scale(1.03))] active:scale-95"
              style={{ color: 'var(--color-primary,#ec4899)' }}
            >
              {ctaLabel}
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Toy bubble / playful fallback scene */}
        {!showBg && (
          <div className="relative mx-auto w-full max-w-xs sm:max-w-sm lg:max-w-md">
            {/* wobbly bubble */}
            <div
              className="relative aspect-square w-full overflow-hidden bg-white/15 shadow-[var(--shadow-xl)] ring-4 ring-white/40 transition-transform duration-[var(--duration-base,300ms)] ease-[var(--ease-entrance,cubic-bezier(0.34,1.56,0.64,1))] hover:[transform:var(--hover-lift,translateY(-6px)_scale(1.03))]"
              style={{ borderRadius: '46% 54% 57% 43% / 54% 46% 54% 46%' }}
            >
              {showMedia ? (
                <img
                  src={media}
                  alt=""
                  loading="eager"
                  onError={() => setMediaOk(false)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full grid-cols-2 grid-rows-3 gap-3 p-6 sm:p-8">
                  {TOY_EMOJIS.map((e, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className="grid place-items-center rounded-[var(--radius,16px)] bg-white/85 text-3xl shadow-[var(--shadow-sm)] sm:text-4xl"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {/* floating mini stars around the bubble */}
            <svg aria-hidden="true" className="pointer-events-none absolute -top-4 -end-2 h-10 w-10 animate-bounce" style={{ color: 'var(--color-accent,#fbbf24)', animationDuration: '3s' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.2 6.3L20.5 9l-5 4.2L17 20l-5-3.4L7 20l1.5-6.8-5-4.2 6.3-.7z" />
            </svg>
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-3 -start-3 h-8 w-8 animate-pulse rounded-full bg-white/70" />
          </div>
        )}
      </div>
    </section>
  );
}
