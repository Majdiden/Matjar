import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { cn } from '@shared/utils/cn';

interface ModernHeroProps {
  /** Featured-product image, used as the floating "device showcase" when no
   *  full-bleed background image is set. Passed from Home, where the featured
   *  products are already fetched. */
  media?: string;
}

/**
 * Modern — premium split "device showcase" hero.
 *
 * Clean tech / electronics energy: an oversized, tight-tracking headline on
 * the start side and the product image floating on a soft gradient pedestal
 * (with a dot-grid texture) on the end side, plus a specs / trust ticker row
 * under the CTAs. Lots of negative space.
 *
 * Self-contained + customizer-aware: reads the exact same
 * `useThemeSettings('hero')` values and i18n fallback keys Home previously fed
 * the shared Hero, so merchant edits + translations keep working. When a
 * merchant sets a full-bleed background image we switch to a crisp dark photo
 * composition (with legibility gradient + overlay), otherwise the light split.
 */
const ModernHero: React.FC<ModernHeroProps> = ({ media }) => {
  const { t } = useTranslation('theme');
  const { store } = useStore();
  const hero = useThemeSettings('hero');

  const eyebrow = hero.badge_text || t('theme.section.hero.badge');
  const title = hero.heading || store?.name || t('theme.section.hero.headline');
  const subtitle = hero.subheading || store?.description || t('theme.section.hero.subheadline');
  const primaryCta = {
    label: hero.primary_button_text || t('theme.section.hero.primary_cta'),
    href: hero.primary_button_url || '/products',
  };
  const secondaryCta = {
    label: hero.secondary_button_text || t('theme.section.hero.secondary_cta'),
    href: hero.secondary_button_url || '/categories',
  };
  const backgroundImage: string | undefined = hero.background_image || undefined;
  const overlayOpacity: number = hero.overlay_opacity || 0;

  // Floating product showcase only when there is no full-bleed photo.
  const showcase = backgroundImage ? undefined : media;
  const [showcaseFailed, setShowcaseFailed] = React.useState(false);
  const onDark = !!backgroundImage;

  // Specs / trust ticker. New keys carry a defaultValue so they render even
  // before a translator adds them — existing hero keys are untouched.
  const ticker = [
    {
      label: t('theme.section.hero.ticker_shipping', { defaultValue: 'Free shipping' }),
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7" /><circle cx="6" cy="19" r="2" /><circle cx="18.5" cy="19" r="2" />
        </svg>
      ),
    },
    {
      label: t('theme.section.hero.ticker_warranty', { defaultValue: '2-year warranty' }),
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: t('theme.section.hero.ticker_support', { defaultValue: '24/7 support' }),
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 1a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h1v-7H5v-2a7 7 0 0 1 14 0v2h-2v7h1a3 3 0 0 0 3-3v-6a9 9 0 0 0-9-9z" />
        </svg>
      ),
    },
  ];

  const Copy = (
    <div className={cn('relative z-10 flex flex-col items-start text-start max-w-xl', onDark && 'text-white')}>
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-[var(--radius-pill,9999px)] px-3.5 py-1.5 text-xs sm:text-sm font-semibold tracking-wide ring-1',
          onDark ? 'bg-white/15 text-white ring-white/25 backdrop-blur-sm' : 'ring-[var(--color-border,#e5e7eb)]'
        )}
        style={onDark ? undefined : { background: 'color-mix(in srgb, var(--color-primary, #2563eb) 10%, transparent)', color: 'var(--color-primary, #2563eb)' }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: onDark ? 'currentColor' : 'var(--color-primary, #2563eb)' }} />
        {eyebrow}
      </span>

      <h1
        className="mt-5 text-4xl sm:text-5xl lg:text-[3.75rem] font-extrabold leading-[1.04] tracking-tight text-balance"
        style={{ fontFamily: 'var(--font-family-heading)', color: onDark ? '#fff' : 'var(--color-foreground, #1f2937)' }}
      >
        {title}
      </h1>

      <p
        className="mt-5 text-base sm:text-lg leading-relaxed max-w-lg"
        style={{ color: onDark ? 'rgba(255,255,255,0.85)' : 'var(--color-muted, #6b7280)' }}
      >
        {subtitle}
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Link
          to={primaryCta.href}
          className="group inline-flex items-center justify-center gap-2 rounded-[var(--radius,12px)] px-7 py-3.5 text-sm sm:text-base font-semibold text-white shadow-[var(--shadow-lg)] transition-[transform,filter] duration-[var(--duration-fast,150ms)] hover:[transform:translateY(var(--hover-lift,-3px))] hover:brightness-110 active:translate-y-0"
          style={{ background: 'linear-gradient(135deg, var(--color-primary, #2563eb), var(--color-secondary, #1e40af))' }}
        >
          {primaryCta.label}
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
        <Link
          to={secondaryCta.href}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-[var(--radius,12px)] px-7 py-3.5 text-sm sm:text-base font-semibold transition-colors duration-[var(--duration-fast,150ms)]',
            onDark ? 'border border-white/40 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15' : 'border border-[var(--color-border,#e5e7eb)] hover:bg-[var(--color-muted,#6b7280)]/5'
          )}
          style={onDark ? undefined : { color: 'var(--color-foreground, #1f2937)' }}
        >
          {secondaryCta.label}
        </Link>
      </div>

      {/* Specs / trust ticker */}
      <div className="mt-8 flex flex-wrap gap-2.5">
        {ticker.map((item) => (
          <span
            key={item.label}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[var(--radius-pill,9999px)] px-3 py-1.5 text-xs font-medium ring-1',
              onDark ? 'bg-white/10 text-white/90 ring-white/20 backdrop-blur-sm' : 'ring-[var(--color-border,#e5e7eb)]'
            )}
            style={onDark ? undefined : { color: 'var(--color-muted, #6b7280)' }}
          >
            <span style={{ color: 'var(--color-primary, #2563eb)' }}>{item.icon}</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <section
      className="relative isolate overflow-hidden"
      style={{
        background: onDark
          ? 'linear-gradient(135deg, var(--color-primary, #2563eb) 0%, var(--color-secondary, #1e40af) 100%)'
          : 'var(--color-background, #ffffff)',
      }}
    >
      {/* Full-bleed photo composition (degrades to the base gradient on error) */}
      {onDark && (
        <>
          <img
            src={backgroundImage}
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="absolute inset-0 -z-10 w-full h-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
          {overlayOpacity > 0 && <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: overlayOpacity / 100 }} />}
        </>
      )}

      {/* Light-composition texture: subtle dot grid + soft tinted glow */}
      {!onDark && (
        <>
          <div
            className="absolute inset-0 -z-10 opacity-60"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-foreground, #1f2937) 9%, transparent) 1px, transparent 0)',
              backgroundSize: '26px 26px',
              maskImage: 'radial-gradient(120% 90% at 80% 10%, #000 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(120% 90% at 80% 10%, #000 30%, transparent 75%)',
            }}
          />
          <div
            className="pointer-events-none absolute -top-32 -end-24 -z-10 w-[34rem] h-[34rem] rounded-full blur-3xl opacity-30"
            style={{ background: 'radial-gradient(circle, var(--color-primary, #2563eb), transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-40 -start-24 -z-10 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, var(--color-accent, #f59e0b), transparent 70%)' }}
          />
        </>
      )}

      <div
        className={cn(
          'mx-auto w-full max-w-[var(--layout-max-width,1280px)] px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28',
          !onDark && showcase ? 'grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]' : ''
        )}
      >
        {Copy}

        {/* Device showcase — product floating on a gradient pedestal */}
        {!onDark && showcase && (
          <div className="relative mt-4 lg:mt-0">
            {/* dot-grid texture behind the pedestal */}
            <div
              className="pointer-events-none absolute -inset-x-6 -top-6 bottom-8 -z-10 rounded-[var(--radius-lg,20px)] opacity-70"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-primary, #2563eb) 22%, transparent) 1px, transparent 0)',
                backgroundSize: '20px 20px',
              }}
            />
            <div
              className="relative overflow-hidden rounded-[var(--radius-lg,20px)] p-6 sm:p-8 shadow-[var(--shadow-xl)] ring-1 ring-[var(--color-border,#e5e7eb)]"
              style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--color-primary, #2563eb) 12%, var(--color-background, #fff)), color-mix(in srgb, var(--color-accent, #f59e0b) 8%, var(--color-background, #fff)))' }}
            >
              <div className="relative aspect-[4/3] w-full">
                {showcase && !showcaseFailed ? (
                  <img
                    src={showcase}
                    alt=""
                    loading="eager"
                    onError={() => setShowcaseFailed(true)}
                    className="h-full w-full object-contain drop-shadow-2xl [transform:perspective(1200px)_rotateY(-7deg)] rtl:[transform:perspective(1200px)_rotateY(7deg)]"
                  />
                ) : (
                  // Never a blank band: a themed device glyph fallback.
                  <div className="flex h-full w-full items-center justify-center">
                    <svg className="w-2/3 h-2/3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--color-primary, #2563eb)' }} aria-hidden="true">
                      <rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" />
                    </svg>
                  </div>
                )}
              </div>
              {/* pedestal reflection bar */}
              <div className="mt-5 h-1.5 w-2/3 mx-auto rounded-[var(--radius-pill,9999px)] opacity-50" style={{ background: 'var(--color-primary, #2563eb)' }} />
            </div>
            {/* floating spec chip */}
            <div
              className="absolute -bottom-4 end-2 sm:end-6 inline-flex items-center gap-2 rounded-[var(--radius-pill,9999px)] bg-[var(--color-background,#fff)] px-3.5 py-2 text-xs font-semibold shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border,#e5e7eb)]"
              style={{ color: 'var(--color-foreground, #1f2937)' }}
            >
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--color-success, #10b981)' }} />
              {t('theme.section.hero.in_stock', { defaultValue: 'In stock' })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ModernHero;
