import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings } from '@shared/theme/ThemeProvider';

/**
 * BookHero — a cozy, literary "reading nook" hero.
 *
 * Concept: an editorial book-jacket feel — a serif headline set like a book
 * title, an oversized decorative quotation mark with a quote-style italic
 * subtitle, and the featured `media` rendered as a standing book cover with a
 * spine shadow and a faint shelf reflection. With no media it degrades to a
 * stacked-books CSS motif. Warm violet gradient, ruled column lines for a
 * page-margin texture.
 *
 * Token-driven only (`--color-*`, `--radius*`, `--shadow-*`, `--duration-*`,
 * `--ease-*`, `--hover-lift`, `--font-family-heading`). Reads the same `hero`
 * settings + i18n fallback keys the theme previously fed the shared Hero
 * (eyebrow_text, heading_line1/2, subheading, button_text/url) so merchant
 * customization + translations keep working. `media` (a featured book cover)
 * is passed in from Home.
 */

interface BookHeroProps {
  /** Featured product image shown as the standing book cover. */
  media?: string;
}

export default function BookHero({ media }: BookHeroProps) {
  const { t } = useTranslation('theme');
  const hero = useThemeSettings('hero');

  const eyebrow = hero.eyebrow_text || t('theme.section.hero.eyebrow');
  const line1 = hero.heading_line1 || t('theme.section.hero.heading_line1');
  const line2 = hero.heading_line2 || t('theme.section.hero.heading_line2');
  const subheading = hero.subheading || t('theme.section.hero.subheading');
  const ctaLabel = hero.button_text || t('theme.section.hero.cta');
  const ctaHref = hero.button_url || '/products';

  const [mediaOk, setMediaOk] = useState(true);
  const showCover = !!media && mediaOk;

  return (
    <section
      className="relative isolate overflow-hidden text-white"
      style={{ background: 'linear-gradient(140deg, var(--color-primary,#7c3aed) 0%, var(--color-secondary,#4c1d95) 100%)' }}
    >
      {/* page-margin ruled lines for a literary paper texture */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.9) 0 1px, transparent 1px 30px)',
        }}
        aria-hidden="true"
      />
      {/* soft glow */}
      <div className="pointer-events-none absolute -top-24 -end-16 -z-10 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div
        className="pointer-events-none absolute -bottom-28 -start-10 -z-10 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{ background: 'var(--color-accent,#a78bfa)' }}
      />

      <div className="mx-auto grid w-full max-w-[var(--layout-max-width,1280px)] items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
        {/* Copy — the title page */}
        <div className="relative flex flex-col items-start text-start">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill,9999px)] border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur-sm sm:text-sm">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-accent,#a78bfa)' }} />
              {eyebrow}
            </span>
          )}

          <h1
            className="mt-5 text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            <span className="block">{line1}</span>
            <span className="mt-1 block italic" style={{ color: 'var(--color-accent,#a78bfa)' }}>
              {line2}
            </span>
          </h1>

          {/* quote-style subtitle with an oversized opening mark */}
          <div className="relative mt-6 max-w-md ps-7">
            <span
              aria-hidden="true"
              className="absolute -top-3 start-0 select-none text-5xl leading-none opacity-50"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-accent,#a78bfa)' }}
            >
              &ldquo;
            </span>
            <p className="text-base italic leading-relaxed text-white/85 sm:text-lg">{subheading}</p>
          </div>

          <Link
            to={ctaHref}
            className="group mt-8 inline-flex items-center justify-center gap-2 rounded-[var(--radius,12px)] bg-white px-7 py-3.5 text-sm font-semibold shadow-[var(--shadow-lg)] transition-transform duration-[var(--duration-base,300ms)] ease-[var(--ease-entrance,cubic-bezier(0.22,1,0.36,1))] hover:[transform:var(--hover-lift,translateY(-4px))] active:translate-y-0 sm:text-base"
            style={{ color: 'var(--color-secondary,#4c1d95)' }}
          >
            {ctaLabel}
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* Book motif */}
        <div className="relative hidden justify-center lg:flex">
          {showCover ? (
            <div className="relative [perspective:1400px]">
              {/* glow behind the cover */}
              <div
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[var(--radius-lg,20px)] opacity-50 blur-2xl"
                style={{ background: 'var(--color-accent,#a78bfa)' }}
                aria-hidden="true"
              />
              <div className="relative aspect-[3/4] w-64 overflow-hidden rounded-e-[var(--radius,12px)] rounded-s-[var(--radius-sm,6px)] bg-white/10 shadow-[var(--shadow-xl)] ring-1 ring-white/20 [transform:rotateY(-14deg)]">
                <img
                  src={media}
                  alt=""
                  loading="eager"
                  onError={() => setMediaOk(false)}
                  className="h-full w-full object-cover"
                />
                {/* spine shadow down the start edge */}
                <div className="pointer-events-none absolute inset-y-0 start-0 w-6 bg-gradient-to-e from-black/45 to-transparent" aria-hidden="true" />
                {/* page-edge highlight on the end side */}
                <div className="pointer-events-none absolute inset-y-1 end-0 w-1.5 bg-white/30" aria-hidden="true" />
              </div>
              {/* shelf reflection */}
              <div className="mx-auto mt-3 h-3 w-52 rounded-[var(--radius-pill,9999px)] bg-black/30 blur-md" aria-hidden="true" />
            </div>
          ) : (
            // Stacked-books fallback — leaning spines in token tints.
            <div className="relative flex h-72 items-end gap-3" aria-hidden="true">
              <div className="h-56 w-12 rounded-[var(--radius-sm,6px)] bg-white/85 shadow-[var(--shadow-lg)] [transform:rotate(-5deg)]" />
              <div className="h-64 w-14 rounded-[var(--radius-sm,6px)] shadow-[var(--shadow-lg)]" style={{ background: 'var(--color-accent,#a78bfa)' }} />
              <div className="h-48 w-12 rounded-[var(--radius-sm,6px)] bg-white/70 shadow-[var(--shadow-lg)] [transform:rotate(4deg)]" />
              <div className="h-60 w-14 rounded-[var(--radius-sm,6px)] bg-white/90 shadow-[var(--shadow-lg)]" />
              <div className="mt-auto h-3 w-full max-w-[16rem]" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
