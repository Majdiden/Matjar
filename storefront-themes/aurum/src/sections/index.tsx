/**
 * Aurum section registry + components.
 *
 * All theme-local sections live in this file. Each is keyed into
 * AURUM_SECTION_REGISTRY so the SectionRenderer can look them up by
 * `type`. Dark editorial luxury: Prata serif display, tracked uppercase
 * labels, thin outline buttons, slow elegant motion.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent, type SectionComponentProps } from '@shared/components/sections';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts, useCategories } from '@shared/hooks/useProducts';
import { useIntersectionObserver } from '@shared/hooks/useIntersectionObserver';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import AurumProductCard from '../components/AurumProductCard';

const serif = { fontFamily: 'var(--font-family-heading)' } as const;

/** Thin outline CTA — the theme's standard button. */
const OutlineLink: React.FC<{ to: string; children: React.ReactNode; className?: string }> = ({ to, children, className = '' }) => (
  <Link
    to={to}
    className={`inline-block border border-ink/60 px-8 py-3.5 text-[11px] tracking-[0.22em] uppercase text-ink hover:bg-ink hover:text-black transition-colors duration-300 ${className}`}
  >
    {children}
  </Link>
);

// ─── 1. Split hero ────────────────────────────────────────────────

const SplitHeroSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 md:h-[85vh] min-h-[70vh]">
      {/* Left: editorial image + copy */}
      <div className="relative overflow-hidden group min-h-[70vh] md:min-h-0">
        {s.image_left && (
          <img
            src={s.image_left}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="relative h-full flex flex-col justify-end items-start p-8 md:p-14">
          <h1
            className="text-4xl sm:text-5xl md:text-6xl leading-[1.1] text-white max-w-xl"
            style={serif}
          >
            {s.heading || t('theme.hero.heading')}
          </h1>
          <p className="mt-5 text-sm md:text-base text-white/75 max-w-md leading-relaxed">
            {s.subheading || t('theme.hero.subheading')}
          </p>
          <Link
            to={s.cta_url || '/products'}
            className="mt-8 inline-block bg-white text-black px-10 py-4 text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-neutral-200 transition-colors duration-300"
          >
            {s.cta_text || t('theme.hero.cta')}
          </Link>
        </div>
      </div>

      {/* Right: close-up */}
      <div className="relative overflow-hidden group hidden md:block">
        {s.image_right && (
          <img
            src={s.image_right}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-105"
          />
        )}
      </div>
    </section>
  );
};

// ─── 2. Press marquee ─────────────────────────────────────────────

const MarqueeSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const raw = (s.items as string) || t('theme.section.marquee.default_items');
  const items = raw.split(',').map((x: string) => x.trim()).filter(Boolean);
  const speed = Number(s.speed) || 30;
  // Duplicate the sequence so translateX(-50%) loops seamlessly.
  const doubled = [...items, ...items];

  return (
    <section
      className="aurum-marquee overflow-hidden bg-black border-y border-line py-8"
      style={{ '--aurum-marquee-duration': `${speed}s` } as React.CSSProperties}
      aria-label={t('theme.section.marquee.aria_label')}
    >
      <div className="aurum-marquee-track flex items-center w-max" dir="ltr">
        {doubled.map((item, i) => (
          <React.Fragment key={i}>
            <span
              className="text-3xl md:text-4xl text-ink/80 whitespace-nowrap px-8"
              style={serif}
              aria-hidden={i >= items.length}
            >
              {item}
            </span>
            <span className="w-1.5 h-1.5 rotate-45 bg-gold/70 shrink-0" aria-hidden />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};

// ─── 3. Editorial spotlight ───────────────────────────────────────

const SpotlightSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const { products: featured, loading: loadingFeatured } = useFeaturedProducts(1);
  const { products: fallback, loading: loadingFallback } = useProducts({ sort: 'newest', limit: 1 });
  const product = featured[0] || fallback[0];
  const loading = loadingFeatured && loadingFallback;

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-20 md:py-28">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
        <div className="lg:col-span-2 overflow-hidden group">
          {s.image && (
            <img
              src={s.image}
              alt=""
              className="w-full aspect-[4/3] object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />
          )}
        </div>
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-gold mb-4">
            {s.eyebrow || t('theme.section.spotlight.eyebrow')}
          </div>
          <h2 className="text-3xl md:text-4xl leading-snug mb-10" style={serif}>
            {s.heading || t('theme.section.spotlight.heading')}
          </h2>
          {loading ? (
            <Skeleton className="aspect-square" />
          ) : product ? (
            <div className="max-w-xs">
              <AurumProductCard product={product} onQuickView={onQuickView} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

// ─── 4. Collection tabs ───────────────────────────────────────────

const CollectionTabsSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 4;
  const { categories } = useCategories();
  const tabs = categories.slice(0, 5);
  const [active, setActive] = useState('');
  const activeSlug = active || tabs[0]?.slug || '';

  const params = useMemo(() => {
    const p: Record<string, string | number> = { sort: 'newest', limit };
    if (activeSlug) p.category = activeSlug;
    return p;
  }, [activeSlug, limit]);
  const { products, loading } = useProducts(params);

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-20 md:py-28">
      <h2 className="text-center text-3xl md:text-5xl mb-10" style={serif}>
        {s.heading || t('theme.section.collection_tabs.heading')}
      </h2>

      {tabs.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-14">
          {tabs.map((cat) => {
            const isActive = cat.slug === activeSlug;
            return (
              <button
                key={cat._id}
                onClick={() => setActive(cat.slug)}
                className={`pb-2 text-[11px] tracking-[0.22em] uppercase border-b transition-colors duration-300 ${
                  isActive ? 'text-ink border-ink' : 'text-mute border-transparent hover:text-ink'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="text-center text-mute py-16 text-sm">{t('theme.section.collection_tabs.empty')}</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {products.slice(0, limit).map((p: any) => (
            <AurumProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </div>
      )}
    </section>
  );
};

// ─── 5. Editorial story ───────────────────────────────────────────

const EditorialSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.15 });
  const reveal = (extra = '') =>
    `transition-all duration-700 ease-out ${isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${extra}`;

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="max-w-5xl mx-auto px-4 sm:px-8 py-20 md:py-28 text-center"
    >
      <h2 className={reveal('text-3xl md:text-5xl leading-snug max-w-2xl mx-auto')} style={serif}>
        {s.heading || t('theme.section.editorial.heading')}
      </h2>
      <p className={reveal('mt-6 text-sm md:text-base text-mute max-w-xl mx-auto leading-relaxed delay-150')}>
        {s.body || t('theme.section.editorial.body')}
      </p>

      <div className="mt-16 grid grid-cols-2 gap-6 md:gap-10 items-start">
        <div className={reveal('overflow-hidden delay-200')}>
          {s.image_1 && (
            <img src={s.image_1} alt="" className="w-full aspect-[3/4] object-cover" loading="lazy" />
          )}
        </div>
        <div className={reveal('overflow-hidden md:mt-20 delay-300')}>
          {s.image_2 && (
            <img src={s.image_2} alt="" className="w-full aspect-[3/4] object-cover" loading="lazy" />
          )}
        </div>
      </div>
    </section>
  );
};

// ─── 6. Product rail ──────────────────────────────────────────────

const ProductRailSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 4;
  const source = (s.source as string) || 'newest';
  const featured = useFeaturedProducts(limit);
  const regular = useProducts({ sort: source === 'popular' ? 'popular' : 'newest', limit });
  const { products, loading } = source === 'featured' ? featured : regular;

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-20 md:py-28">
      <div className="flex items-end justify-between mb-12">
        <h2 className="text-3xl md:text-5xl" style={serif}>
          {s.heading || t('theme.section.product_rail.heading')}
        </h2>
        <Link
          to="/products"
          className="text-[11px] tracking-[0.22em] uppercase text-mute hover:text-ink border-b border-transparent hover:border-ink pb-1 transition-colors"
        >
          {t('theme.section.product_rail.view_all')} <span className="inline-block rtl:rotate-180">&rarr;</span>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {products.slice(0, limit).map((p: any) => (
            <AurumProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </div>
      )}
    </section>
  );
};

// ─── 7. Trust columns ─────────────────────────────────────────────

const TRUST_ICONS: Record<string, React.ReactNode> = {
  returns: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  shipping: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  support: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  ),
};

const TrustSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const icons = ['returns', 'shipping', 'support'];
  const items = (blocks.length > 0 ? blocks : icons.map((icon, i) => ({ id: `t${i}`, settings: { icon } })))
    .slice(0, 3)
    .map((b: any, i: number) => {
      const bs = b.settings || {};
      const icon = bs.icon || icons[i % icons.length];
      return {
        id: b.id || i,
        icon,
        title: bs.title || t(`theme.section.trust.${icon}_title`),
        text: bs.text || t(`theme.section.trust.${icon}_text`),
      };
    });

  return (
    <section className="border-y border-line py-20 md:py-24">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        <h2 className="text-center text-3xl md:text-4xl mb-16 max-w-xl mx-auto leading-snug" style={serif}>
          {s.heading || t('theme.section.trust.heading')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 text-center">
          {items.map((item) => (
            <div key={item.id}>
              <div className="flex justify-center text-gold mb-5">{TRUST_ICONS[item.icon] || TRUST_ICONS.returns}</div>
              <h3 className="text-[12px] tracking-[0.22em] uppercase text-ink mb-3 font-medium" style={{ fontFamily: 'var(--font-family)' }}>
                {item.title}
              </h3>
              <p className="text-sm text-mute leading-relaxed max-w-[260px] mx-auto">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── 8. Collections showcase ──────────────────────────────────────

const CollectionsShowcaseSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const { categories } = useCategories();
  const fallbackImages = [s.image_1, s.image_2, s.image_3, s.image_4];

  const cards = (categories.length > 0
    ? categories.slice(0, 4).map((cat, i) => ({
        key: cat._id,
        label: cat.name,
        to: `/categories/${cat.slug}`,
        image: cat.image || fallbackImages[i % 4],
      }))
    : fallbackImages.map((img, i) => ({
        key: `f${i}`,
        label: t('theme.section.showcase.placeholder_label'),
        to: '/products',
        image: img,
      }))
  );

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-20 md:py-28">
      <h2 className="text-center text-3xl md:text-5xl mb-14" style={serif}>
        {s.heading || t('theme.section.showcase.heading')}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {cards.map((card) => (
          <Link key={card.key} to={card.to} className="group relative block aspect-[3/4] overflow-hidden bg-tile">
            {card.image && (
              <img
                src={card.image}
                alt={card.label}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors duration-500" />
            <div className="relative h-full flex flex-col items-center justify-center gap-5 p-4 text-center">
              <span className="text-[13px] md:text-sm tracking-[0.3em] uppercase text-white">
                {card.label}
              </span>
              <span className="border border-white/80 px-5 py-2.5 text-[10px] tracking-[0.22em] uppercase text-white group-hover:bg-white group-hover:text-black transition-colors duration-300">
                {t('theme.section.showcase.cta')}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

// ─── 9. Scroll statement ──────────────────────────────────────────

const StatementLine: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.6 });
  return (
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      className={`block transition-colors duration-700 ease-out ${isIntersecting ? 'text-ink' : 'text-neutral-700'}`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      {text}
    </span>
  );
};

const StatementSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const raw = (s.text as string) || t('theme.section.statement.default_text');
  const lines = raw.split('\n').map((l: string) => l.trim()).filter(Boolean);

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-8 py-24 md:py-36 text-center">
      <p className="text-4xl sm:text-5xl md:text-6xl leading-[1.25]" style={serif}>
        {lines.map((line, i) => (
          <StatementLine key={i} text={line} index={i} />
        ))}
      </p>
    </section>
  );
};

// ─── 10. Social gallery ───────────────────────────────────────────

const GallerySection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const tiles = blocks.filter((b: any) => b?.settings?.image).slice(0, 4);

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-20 md:py-28 text-center">
      <div className="text-[10px] tracking-[0.3em] uppercase text-gold mb-4">
        {s.eyebrow || t('theme.section.gallery.eyebrow')}
      </div>
      <h2 className="text-3xl md:text-5xl mb-14" style={serif}>
        {s.heading || t('theme.section.gallery.heading')}
      </h2>

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {tiles.map((tile: any, i: number) => {
            const ts = tile.settings || {};
            const img = (
              <img
                src={ts.image}
                alt=""
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                loading="lazy"
              />
            );
            const cls = 'group relative block aspect-square overflow-hidden bg-tile';
            return ts.link ? (
              <a key={tile.id || i} href={ts.link} target="_blank" rel="noopener noreferrer" className={cls}>{img}</a>
            ) : (
              <div key={tile.id || i} className={cls}>{img}</div>
            );
          })}
        </div>
      )}

      {s.handle_url ? (
          <a
            href={s.handle_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-12 inline-block border border-ink/60 px-8 py-3.5 text-[11px] tracking-[0.22em] uppercase text-ink hover:bg-ink hover:text-black transition-colors duration-300"
          >
            {s.handle || t('theme.section.gallery.handle')}
          </a>
      ) : (
        <OutlineLink to="/products" className="mt-12">
          {s.handle || t('theme.section.gallery.handle')}
        </OutlineLink>
      )}
    </section>
  );
};

// ─── Registry ─────────────────────────────────────────────────────

export const AURUM_SECTION_REGISTRY: Record<string, SectionComponent> = {
  ...DEFAULT_SECTION_REGISTRY,
  'aurum-split-hero': SplitHeroSection,
  'aurum-marquee': MarqueeSection,
  'aurum-spotlight': SpotlightSection,
  'aurum-collection-tabs': CollectionTabsSection,
  'aurum-editorial': EditorialSection,
  'aurum-product-rail': ProductRailSection,
  'aurum-trust': TrustSection,
  'aurum-collections-showcase': CollectionsShowcaseSection,
  'aurum-statement': StatementSection,
  'aurum-gallery': GallerySection,
  // Shadow universal feeds so dashboard-added sections use our card style
  'featured-products': ProductRailSection,
  'new-arrivals': ProductRailSection,
  'product-grid': ProductRailSection,
};
