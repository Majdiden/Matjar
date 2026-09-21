/**
 * Linen section registry — merged over the SDK defaults so the universal
 * sections (product-details, product-policies, rich-text…) stay available.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent, type SectionComponentProps } from '@matjar/theme-shared/components/sections';
import { useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { LinenProductCard } from '../components/LinenProductCard';
import { Reveal } from '../lib/Reveal';
import { I } from '../lib/icons';

const wrap = (s: Record<string, any>) => ({
  paddingTop: s.padding_top != null ? `${s.padding_top}px` : undefined,
  paddingBottom: s.padding_bottom != null ? `${s.padding_bottom}px` : undefined,
});
const blocksOf = (section: any): any[] => (Array.isArray(section?.blocks) ? section.blocks : []);

const SectionHead: React.FC<{ eyebrow?: string; heading?: string; action?: React.ReactNode; align?: 'center' | 'start' }> = ({ eyebrow, heading, action, align = 'center' }) => (
  <Reveal className={`mb-10 flex flex-col gap-3 ${align === 'center' ? 'items-center text-center' : 'items-start sm:flex-row sm:items-end sm:justify-between'}`}>
    <div>
      {eyebrow && <p className="linen-eyebrow text-clay">{eyebrow}</p>}
      {heading && <h2 className="font-heading mt-2 text-3xl leading-tight text-ink sm:text-4xl">{heading}</h2>}
    </div>
    {action}
  </Reveal>
);

// ─── 1. Hero slideshow ───────────────────────────────────────────

const HeroSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const slides = blocksOf(section).filter((b) => b.type === 'slide');
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const autoplay = s.autoplay !== false && slides.length > 1;
  const interval = Number(s.autoplay_interval) || 5000;
  const go = useCallback((n: number) => setIdx((i) => (n + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (!autoplay || paused) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id2 = window.setTimeout(() => go(idx + 1), interval);
    return () => window.clearTimeout(id2);
  }, [autoplay, paused, idx, interval, go]);

  if (!slides.length) return null;
  const pauseOnHover = s.pause_on_hover === true;

  return (
    <section
      className="relative overflow-hidden bg-tint"
      aria-roledescription="carousel"
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => pauseOnHover && setPaused(false)}
      style={{ '--linen-hero-duration': `${interval}ms` } as React.CSSProperties}
    >
      <div className="relative mx-auto grid max-w-[1280px] md:min-h-[720px]">
        {slides.map((slide, i) => {
          const b = slide.settings || {};
          const active = i === idx;
          return (
            <div
              key={slide.id || i}
              className={`grid transition-opacity duration-[600ms] ease-in-out md:min-h-[720px] md:grid-cols-2 ${active ? 'relative z-10 opacity-100' : 'absolute inset-0 z-0 opacity-0'}`}
              aria-hidden={!active}
              // @ts-expect-error inert is valid on modern browsers
              inert={active ? undefined : ''}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
            >
              <div className="relative h-[300px] md:h-full">
                {b.image && <img src={b.image} alt="" className="h-full w-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />}
                <div className="absolute inset-0 bg-gradient-to-t from-cream via-[#fcf7ee]/20 to-transparent md:hidden" />
              </div>
              <div className="relative flex items-center px-6 pb-28 pt-2 md:px-14 md:pb-32 md:pt-16 lg:px-20">
                {active && (
                  <div key={`cap-${idx}`} className="linen-caption max-w-lg">
                    {b.eyebrow && <p className="linen-eyebrow text-clay">{b.eyebrow}</p>}
                    {b.heading && <h1 className="font-heading mt-4 text-[2rem] leading-[1.08] text-ink sm:text-5xl lg:text-[3.4rem]">{b.heading}</h1>}
                    {b.body && <p className="mt-5 max-w-md text-base text-dune md:text-lg">{b.body}</p>}
                    {b.cta_text && <Link to={b.cta_url || '/products'} className="linen-btn linen-btn-solid mt-8">{b.cta_text} <I.arrowRight className="h-4 w-4 rtl:-scale-x-100" /></Link>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 pb-6 md:px-14 lg:px-20">
            {s.show_dots !== false ? (
              <div className="pointer-events-auto flex items-center gap-2" role="tablist" aria-label={t('theme.section.hero.slides')}>
                {slides.map((_, i) => (
                  <button key={i} type="button" role="tab" aria-selected={i === idx} aria-label={t('theme.section.hero.go_to', { n: i + 1 })} onClick={() => go(i)} className={`h-2 rounded-full text-cream transition-all duration-300 ${i === idx ? 'w-8 bg-bronze' : 'w-2 bg-black/60 hover:bg-black/80'}`} />
                ))}
              </div>
            ) : <span />}
            {s.show_arrows !== false && (
              <div className="pointer-events-auto flex gap-2">
                <button type="button" onClick={() => go(idx - 1)} className="grid h-11 w-11 place-items-center rounded-full border border-bronze bg-cream text-clay transition-colors duration-300 hover:bg-bronze hover:text-cream" aria-label={t('theme.section.hero.prev')}><I.chevronLeft className="h-5 w-5 rtl:-scale-x-100" /></button>
                <button type="button" onClick={() => go(idx + 1)} className="grid h-11 w-11 place-items-center rounded-full border border-bronze bg-cream text-clay transition-colors duration-300 hover:bg-bronze hover:text-cream" aria-label={t('theme.section.hero.next')}><I.chevronRight className="h-5 w-5 rtl:-scale-x-100" /></button>
              </div>
            )}
          </div>
          {autoplay && !paused && (
            <div className="h-[3px] w-full bg-black/10"><div key={`bar-${idx}`} className="linen-hero-progress h-full bg-bronze" /></div>
          )}
        </div>
      )}
    </section>
  );
};

// ─── 2. Support strip ────────────────────────────────────────────

const SupportStripSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const items = blocksOf(section);
  if (!items.length) return null;
  return (
    <section className="bg-sand" style={wrap(s)}>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((b, i) => {
          const v = b.settings || {};
          const Icon = (I as any)[v.icon] || I.shield;
          return (
            <Reveal key={b.id || i} delay={(i % 4) as 0 | 1 | 2 | 3} className={`flex items-center gap-4 px-6 py-6 ${i > 0 ? 'border-t border-black/10 sm:border-t-0 sm:border-s' : ''} ${i === 2 ? 'sm:border-t sm:border-s-0 lg:border-t-0 lg:border-s' : ''} ${i === 3 ? 'sm:border-t lg:border-t-0' : ''}`}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/15 text-ink"><Icon className="h-5 w-5" /></span>
              <span>
                <span className="linen-eyebrow block text-ink">{v.title}</span>
                <span className="block text-sm text-dune">{v.text}</span>
              </span>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
};

// ─── 3 / 6. Product grid ─────────────────────────────────────────

const ProductGridSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const limit = Number(s.product_limit) || 4;
  const source = s.product_source || 'featured';
  const featured = useFeaturedProducts(source === 'featured' ? limit : 1);
  const listed = useProducts(source === 'featured' ? { limit: 1 } : { limit, sort: source === 'popular' ? 'popular' : 'newest' });
  const products = source === 'featured' ? featured.products : listed.products;
  const loading = source === 'featured' ? featured.loading : listed.loading;
  if (!loading && !products.length) return null;
  return (
    <section style={wrap(s)}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <SectionHead eyebrow={s.eyebrow} heading={s.heading} align="start" action={
          s.view_all_text ? <Link to={s.view_all_url || '/products'} className="linen-eyebrow inline-flex items-center gap-2 border-b border-ink pb-1 text-ink transition-colors hover:border-bronze hover:text-clay">{s.view_all_text} <I.arrowRight className="h-4 w-4 rtl:-scale-x-100" /></Link> : null
        } />
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {loading
            ? Array.from({ length: limit }).map((_, i) => <div key={i}><Skeleton className="aspect-square" /><Skeleton className="mt-4 h-5 w-3/4" /><Skeleton className="mt-2 h-4 w-1/3" /></div>)
            : products.slice(0, limit).map((p: any, i: number) => (
              <Reveal key={p._id} delay={(i % 4) as 0 | 1 | 2 | 3}>
                <LinenProductCard product={p} showRating={s.show_rating !== false} showBadge={s.show_badge !== false} newDays={Number(s.new_days) || 30} onQuickView={s.show_quick_view !== false ? onQuickView : undefined} />
              </Reveal>
            ))}
        </div>
        {!loading && !products.length && <p className="text-center text-dune">{t('theme.section.products.empty')}</p>}
      </div>
    </section>
  );
};

// ─── 4. Promo banner ─────────────────────────────────────────────

const PromoBannerSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  return (
    <section className="relative flex items-center justify-center overflow-hidden" style={{ ...wrap(s), minHeight: `${Number(s.min_height) || 520}px` }}>
      {s.image && <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
      <div className="absolute inset-0 bg-black/10" />
      <Reveal className="relative mx-4 my-16 max-w-xl bg-cream px-8 py-12 text-center shadow-[0_30px_60px_-30px_rgba(15,15,15,0.35)] sm:px-14">
        {s.heading && <h2 className="font-heading text-3xl leading-tight text-ink sm:text-4xl">{s.heading}</h2>}
        {s.body && <p className="mt-4 text-dune">{s.body}</p>}
        {s.cta_text && <Link to={s.cta_url || '/products'} className="linen-btn linen-btn-dark mt-8">{s.cta_text}</Link>}
      </Reveal>
    </section>
  );
};

// ─── 5. Category masonry ─────────────────────────────────────────

const CategoryMasonrySection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const { categories, loading } = useCategories();
  const list = useMemo(() => categories.filter((c: any) => !c.parent).slice(0, 5), [categories]);
  if (!loading && list.length < 2) return null;
  const Tile: React.FC<{ cat: any; tall?: boolean; i: number }> = ({ cat, tall, i }) => (
    <Reveal delay={(i % 4) as 0 | 1 | 2 | 3} className={`group relative overflow-hidden bg-sand ${tall ? 'row-span-2 min-h-[420px]' : 'min-h-[200px]'}`}>
      <Link to={`/categories/${cat.slug}`} className="block h-full w-full">
        <img src={cat.image || s.tall_image} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-cream sm:p-6">
          <p className="linen-eyebrow text-white/85">{t('theme.section.masonry.kicker')}</p>
          <p className={`font-heading mt-1 ${tall ? 'text-3xl' : 'text-2xl'}`}>{cat.name}</p>
          <span className="linen-eyebrow mt-3 inline-flex items-center gap-2 border-b border-white/60 pb-0.5 text-[0.68rem] text-cream transition-colors group-hover:border-cream">{s.cta_text || t('theme.section.masonry.cta')} <I.arrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" /></span>
        </div>
      </Link>
    </Reveal>
  );
  return (
    <section style={wrap(s)}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <SectionHead eyebrow={s.eyebrow} heading={s.heading} />
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-[420px] md:col-span-1" /><Skeleton className="h-[200px]" /><Skeleton className="h-[200px]" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:grid-rows-2">
            {list.slice(1).map((c, i) => <Tile key={c._id} cat={c} i={i} />)}
            <div className="col-span-2 md:col-span-1 md:col-start-3 md:row-span-2 md:row-start-1"><Tile cat={list[0]} tall i={3} /></div>
          </div>
        )}
      </div>
    </section>
  );
};

// ─── 7. Editorial split ──────────────────────────────────────────

const EditorialSplitSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const right = s.layout === 'image-right';
  return (
    <section style={wrap(s)}>
      <div className={`mx-auto grid max-w-[1280px] items-center gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-16`}>
        <Reveal className={`aspect-[4/5] overflow-hidden bg-sand ${right ? 'md:order-2' : ''}`}>
          {s.image && <img src={s.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
        </Reveal>
        <Reveal delay={1} className="max-w-md">
          {s.eyebrow && <p className="linen-eyebrow text-clay">{s.eyebrow}</p>}
          {s.heading && <h2 className="font-heading mt-3 text-3xl leading-tight text-ink sm:text-4xl">{s.heading}</h2>}
          {s.body && <p className="mt-5 text-dune">{s.body}</p>}
          {s.cta_text && <Link to={s.cta_url || '/products'} className="linen-btn linen-btn-outline mt-8">{s.cta_text}</Link>}
        </Reveal>
      </div>
    </section>
  );
};

// ─── 8. Testimonials ─────────────────────────────────────────────

const TestimonialsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const items = blocksOf(section);
  if (!items.length) return null;
  return (
    <section className="bg-tint" style={wrap(s)}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <SectionHead eyebrow={s.eyebrow} heading={s.heading} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((b, i) => {
            const v = b.settings || {};
            return (
              <Reveal key={b.id || i} delay={(i % 4) as 0 | 1 | 2 | 3} as="figure" className="flex flex-col bg-cream p-7">
                <I.quote className="h-8 w-8 text-bronze" />
                <blockquote className="mt-4 flex-1 text-[0.95rem] text-ink">{v.quote}</blockquote>
                <figcaption className="mt-6 border-t border-line pt-4">
                  <span className="font-heading block text-lg text-ink">{v.name}</span>
                  {v.role && <span className="text-sm text-dune">{v.role}</span>}
                </figcaption>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── 9. Stories ──────────────────────────────────────────────────

const StoriesSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const items = blocksOf(section);
  if (!items.length) return null;
  return (
    <section style={wrap(s)}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <SectionHead eyebrow={s.eyebrow} heading={s.heading} />
        <div className="grid gap-8 md:grid-cols-3">
          {items.slice(0, 3).map((b, i) => {
            const v = b.settings || {};
            return (
              <Reveal key={b.id || i} delay={(i % 4) as 0 | 1 | 2 | 3} as="article" className="group">
                <Link to={v.link_url || '/'} className="relative block aspect-[4/3] overflow-hidden bg-sand">
                  {v.image && <img src={v.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />}
                  {v.date && <span className="linen-eyebrow absolute start-4 top-4 bg-cream px-3 py-1.5 text-[0.65rem] text-ink">{v.date}</span>}
                </Link>
                <h3 className="font-heading mt-5 text-2xl leading-snug text-ink"><Link to={v.link_url || '/'} className="transition-colors hover:text-clay">{v.title}</Link></h3>
                {v.excerpt && <p className="mt-2 text-[0.95rem] text-dune">{v.excerpt}</p>}
                <Link to={v.link_url || '/'} className="linen-eyebrow mt-4 inline-flex items-center gap-2 border-b border-ink pb-0.5 text-[0.68rem] text-ink transition-colors hover:border-bronze hover:text-clay">{t('theme.section.stories.read_more')} <I.arrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" /></Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── 10. Instagram row ───────────────────────────────────────────

const InstagramSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const items = blocksOf(section).slice(0, 6);
  if (!items.length) return null;
  return (
    <section style={wrap(s)}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <SectionHead eyebrow={s.eyebrow} heading={s.handle} action={
          s.handle_url ? <a href={s.handle_url} target="_blank" rel="noopener noreferrer" className="linen-eyebrow inline-flex items-center gap-2 text-clay"><I.instagram className="h-4 w-4" /> {s.handle}</a> : null
        } />
      </div>
      <div className="grid grid-cols-3 gap-1 md:grid-cols-6">
        {items.map((b, i) => {
          const v = b.settings || {};
          const inner = (
            <span className="group relative block aspect-square overflow-hidden bg-sand">
              {v.image && <img src={v.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />}
              <span className="absolute inset-0 grid place-items-center bg-black/0 text-cream opacity-0 transition-all duration-300 group-hover:bg-black/35 group-hover:opacity-100"><I.instagram className="h-6 w-6" /></span>
            </span>
          );
          return v.link ? <a key={b.id || i} href={v.link} target="_blank" rel="noopener noreferrer" aria-label="Instagram">{inner}</a> : <div key={b.id || i}>{inner}</div>;
        })}
      </div>
    </section>
  );
};

export const LINEN_SECTION_REGISTRY: Record<string, SectionComponent> = {
  ...DEFAULT_SECTION_REGISTRY,
  'linen-hero': HeroSection,
  'linen-support-strip': SupportStripSection,
  'linen-product-grid': ProductGridSection,
  'linen-promo-banner': PromoBannerSection,
  'linen-category-masonry': CategoryMasonrySection,
  'linen-editorial-split': EditorialSplitSection,
  'linen-testimonials': TestimonialsSection,
  'linen-stories': StoriesSection,
  'linen-instagram': InstagramSection,
};

// Silence unused-import lint in case a section stops using it.
void useRef;
