import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useThemeSettings } from '@shared/theme/ThemeProvider';

interface FreshmartHeroProps {
  /** Featured-product image shown floating in the rounded "produce" card.
   *  Passed from Home where featured products are already fetched. */
  media?: string;
}

/**
 * Freshmart — friendly, bright "fresh deals" grocery hero.
 *
 * Cheerful and approachable: a soft green gradient with organic blob shapes, a
 * rounded "search or shop" bar (the primary CTA is its submit button, so it is
 * always rendered), and a floating produce image inside a big rounded card
 * with a discount sticker. A broken/missing image degrades to a friendly
 * basket glyph on the gradient card — never a blank band.
 *
 * Self-contained + customizer-aware: reads the same `useThemeSettings('hero')`
 * values and i18n fallback keys Home fed the shared Hero.
 */
const FreshmartHero: React.FC<FreshmartHeroProps> = ({ media }) => {
  const { t } = useTranslation('theme');
  const { store } = useStore();
  const navigate = useNavigate();
  const hero = useThemeSettings('hero');

  const eyebrow = hero.badge_text || t('theme.hero.badge_text');
  const line1 = hero.heading_line1 || t('theme.hero.heading_line1');
  const line2 = hero.heading_line2 || t('theme.hero.heading_line2');
  const subtitle = hero.subheading || store?.description || t('theme.hero.subheading');
  const primaryCta = {
    label: hero.primary_button_text || t('theme.hero.primary_cta'),
    href: hero.primary_button_url || '/products',
  };
  const secondaryCta = {
    label: hero.secondary_button_text || t('theme.hero.secondary_cta'),
    href: hero.secondary_button_url || '/categories',
  };
  // Support an optional merchant background image as the card visual too.
  const showcase = media || hero.background_image || undefined;

  const [query, setQuery] = React.useState('');
  const [imgFailed, setImgFailed] = React.useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : primaryCta.href);
  };

  return (
    <section
      className="relative isolate overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--color-primary, #16a34a) 14%, var(--color-background, #fff)) 0%, var(--color-background, #fff) 55%, color-mix(in srgb, var(--color-accent, #f59e0b) 12%, var(--color-background, #fff)) 100%)',
      }}
    >
      {/* Organic blob shapes */}
      <div
        className="pointer-events-none absolute -top-24 -end-16 -z-10 w-[28rem] h-[28rem] blur-2xl opacity-40"
        style={{ background: 'var(--color-primary, #16a34a)', borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%' }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -start-20 -z-10 w-[26rem] h-[26rem] blur-2xl opacity-30"
        style={{ background: 'var(--color-accent, #f59e0b)', borderRadius: '63% 37% 38% 62% / 49% 60% 40% 51%' }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-[var(--layout-max-width,1280px)] grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 lg:grid-cols-2">
        {/* Copy + search-or-shop */}
        <div className="flex flex-col items-start text-start">
          <span
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill,9999px)] px-4 py-1.5 text-xs sm:text-sm font-bold"
            style={{ background: 'color-mix(in srgb, var(--color-primary, #16a34a) 15%, transparent)', color: 'var(--color-secondary, #15803d)' }}
          >
            {/* leaf */}
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2C14 2 17 0 17 0c-3 0-7 4-7 4s-2-2-5-2c0 0 4 4 4 8z" />
            </svg>
            {eyebrow}
          </span>

          <h1
            className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight text-balance"
            style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground, #1f2937)' }}
          >
            {line1}{' '}
            <span style={{ color: 'var(--color-primary, #16a34a)' }}>{line2}</span>
          </h1>

          <p className="mt-4 max-w-md text-base sm:text-lg leading-relaxed" style={{ color: 'var(--color-muted, #6b7280)' }}>
            {subtitle}
          </p>

          {/* Search-or-shop bar — primary CTA is the submit button */}
          <form
            onSubmit={handleSearch}
            className="mt-7 flex w-full max-w-md items-center gap-2 rounded-[var(--radius-pill,9999px)] bg-[var(--color-background,#fff)] p-1.5 shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border,#e5e7eb)]"
          >
            <span className="ps-3" style={{ color: 'var(--color-muted, #6b7280)' }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('theme.hero.search_placeholder', { defaultValue: 'Search fresh produce…' })}
              aria-label={t('theme.hero.search_placeholder', { defaultValue: 'Search fresh produce…' })}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              style={{ color: 'var(--color-foreground, #1f2937)' }}
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill,9999px)] px-5 py-2.5 text-sm font-bold text-white transition-[transform,filter] duration-[var(--duration-fast,150ms)] hover:brightness-110 hover:[transform:translateY(var(--hover-lift,-2px))]"
              style={{ background: 'var(--color-primary, #16a34a)' }}
            >
              {primaryCta.label}
            </button>
          </form>

          <Link
            to={secondaryCta.href}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
            style={{ color: 'var(--color-secondary, #15803d)' }}
          >
            {secondaryCta.label}
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Floating produce card with discount sticker */}
        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:ms-auto">
          <div
            className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg,28px)] shadow-[var(--shadow-xl)] ring-1 ring-[var(--color-border,#e5e7eb)]"
            style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--color-primary, #16a34a) 16%, var(--color-background, #fff)), color-mix(in srgb, var(--color-accent, #f59e0b) 12%, var(--color-background, #fff)))' }}
          >
            {showcase && !imgFailed ? (
              <img
                src={showcase}
                alt=""
                loading="eager"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              // Friendly basket fallback so the card is never blank.
              <div className="flex h-full w-full items-center justify-center">
                <svg className="w-1/3 h-1/3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary, #16a34a)' }} aria-hidden="true">
                  <path d="M3 10h18l-1.5 9a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7L3 10z" /><path d="M8 10l2-6M16 10l-2-6" />
                </svg>
              </div>
            )}
          </div>

          {/* rotated discount sticker */}
          <div
            className="absolute -top-3 -end-3 sm:-top-4 sm:-end-4 flex h-20 w-20 sm:h-24 sm:w-24 -rotate-12 flex-col items-center justify-center rounded-full text-center text-white shadow-[var(--shadow-lg)]"
            style={{ background: 'var(--color-accent, #f59e0b)' }}
          >
            <span className="text-base sm:text-lg font-extrabold leading-none">{t('theme.hero.deal_amount', { defaultValue: 'Up to 30%' })}</span>
            <span className="mt-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide opacity-90">{t('theme.hero.deal_label', { defaultValue: 'Off' })}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FreshmartHero;
