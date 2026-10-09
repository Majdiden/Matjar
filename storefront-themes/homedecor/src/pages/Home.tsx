import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useMerchantBlocks, useTemplateSections } from '@matjar/theme-shared/theme/ThemeProvider';
import { DEFAULT_SECTION_REGISTRY } from '@matjar/theme-shared/components/sections';
import { useFeaturedProducts, useCategories, useProducts } from '@matjar/theme-shared/hooks/useProducts';
import { ProductCard } from '@matjar/theme-shared/components/commerce/ProductCard';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { useIntersectionObserver } from '@matjar/theme-shared/hooks/useIntersectionObserver';
import { Hero } from '@matjar/theme-shared/components/sections/Hero';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { merchantImage, merchantText } from '@matjar/theme-shared/theme/heroContent';
import type { Product } from '@matjar/theme-shared/types/commerce';

// Niche default hero image — a calm, styled interior — so the hero is never
// empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&q=80&auto=format&fit=crop';

const ROOM_KEYS = [
  { nameKey: 'theme.rooms.living_room', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { nameKey: 'theme.rooms.bedroom', icon: 'M20 12V8a2 2 0 00-2-2H6a2 2 0 00-2 2v4m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4' },
  { nameKey: 'theme.rooms.kitchen', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
  { nameKey: 'theme.rooms.dining', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { nameKey: 'theme.rooms.office', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { nameKey: 'theme.rooms.outdoor', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
];

type SectionProps = { id: string; onQuickView: (product: Product) => void };

// Each bespoke section reads its settings / blocks by its own INSTANCE id, so
// a copy added from the advanced editor keeps its own values.

/**
 * Hero — bespoke architectural interior hero (reads the same hero settings +
 * i18n keys this theme always fed the shared Hero, so merchant
 * customizations + translations keep working).
 */
function HeroBlock({ id }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const hero = useThemeSettings(id);
  const { store } = useStore();
  const { products: featured } = useFeaturedProducts(4);
  // Only the merchant's own copy: the title falls back to the store name, and
  // the second heading line / second button show only when set.
  const title = [merchantText(hero.heading_line1) || store?.name || '', merchantText(hero.heading_line2)].filter(Boolean).join(' ');
  const secondaryText = merchantText(hero.secondary_button_text);

  return (
    <Hero
      variant="editorial"
      align="start"
      title={title}
      subtitle={merchantText(hero.subheading) || undefined}
      primaryCta={{ label: merchantText(hero.primary_button_text) || t('theme.hero.primary_cta'), href: hero.primary_button_url || '/products' }}
      secondaryCta={secondaryText ? { label: secondaryText, href: hero.secondary_button_url || '/categories' } : undefined}
      backgroundImage={merchantImage(hero.background_image) || undefined}
      media={featured?.find((p) => p.images?.[0])?.images?.[0]}
      defaultImage={HERO_DEFAULT_IMAGE}
      overlayOpacity={hero.overlay_opacity || 0}
    />
  );
}

/** Freshly added products, newest first, in the same editorial look as the curated picks */
function NewArrivalsBlock({ id, onQuickView }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const arrivals = useThemeSettings(id);
  const { products: newArrivals, loading: newLoading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 8 });

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-12">
          <div>
            <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-2">
              {t('theme.section.new_arrivals.eyebrow')}
            </p>
            <h2 className="text-3xl font-semibold">{arrivals.heading || t('theme.section.new_arrivals.title')}</h2>
            {arrivals.subheading && <p className="text-gray-500 mt-2">{arrivals.subheading}</p>}
          </div>
          <Link to={arrivals.view_all_url || '/products?sort=newest'} className="text-[#d4a76a] text-sm font-medium hover:underline">
            {t('theme.section.new_arrivals.view_all')} <span className="inline-block rtl:rotate-180">&rarr;</span>
          </Link>
        </div>

        {newLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-lg" />
            ))}
          </div>
        ) : (
          <ProductRail columns={4}>
            {newArrivals.map((p) => (
              <ProductCard key={p._id} product={p} onQuickView={onQuickView}>
                <ProductCard.Image showBadge showQuickView hoverSwap />
                <ProductCard.Body>
                  <ProductCard.Title />
                  <ProductCard.Price showCompareAt className="mt-2" />
                  {arrivals.show_add_to_cart !== false && (
                    <ProductCard.Actions fullWidth className="mt-3" addToCartText={t('theme.section.featured_products.add_to_cart')} />
                  )}
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </div>
    </section>
  );
}

/** Shop by Room - Category Grid */
function CategoriesBlock({ id }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const cats = useThemeSettings(id);
  const { categories } = useCategories();
  const { ref: categoriesRef, isIntersecting: categoriesVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section
      ref={categoriesRef as React.RefObject<HTMLElement>}
      className={`max-w-7xl mx-auto px-6 py-20 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${categoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div className="text-center mb-12">
        <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-2">
          {cats.eyebrow || t('theme.section.categories.eyebrow')}
        </p>
        <h2 className="text-3xl font-semibold">{cats.heading || t('theme.section.categories.title')}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {(categories.length > 0 ? categories.slice(0, cats.max_categories || 6) : ROOM_KEYS).map((item, i) => {
          const cat = categories[i];
          const room = ROOM_KEYS[i] || ROOM_KEYS[0];
          return (
            <Link
              key={cat?._id || room.nameKey}
              to={cat ? `/categories/${cat.slug}` : '/products'}
              className="group relative rounded-lg p-8 flex flex-col items-center justify-center h-48 transition-colors"
              style={{ backgroundColor: cats.tile_background_color || '#f0ebe3' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = cats.tile_hover_color || '#e8e0d4'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = cats.tile_background_color || '#f0ebe3'; }}
            >
              <svg className="w-10 h-10 text-[#d4a76a] mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={room.icon} />
              </svg>
              <h3 className="font-medium text-gray-700 group-hover:text-[#d4a76a] transition">
                {cat?.name || t(room.nameKey)}
              </h3>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Curated Picks */
function FeaturedBlock({ id, onQuickView }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const feat = useThemeSettings(id);
  const { products: featured, loading } = useFeaturedProducts(feat.product_limit || 9);
  const { ref: productsRef, isIntersecting: productsVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section
      ref={productsRef as React.RefObject<HTMLElement>}
      className={`bg-white py-20 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${productsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-12">
          <div>
            <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-2">
              {feat.eyebrow || t('theme.section.featured_products.eyebrow')}
            </p>
            <h2 className="text-3xl font-semibold">{feat.heading || t('theme.section.featured_products.title')}</h2>
          </div>
          <Link to={feat.view_all_url || '/products'} className="text-[#d4a76a] text-sm font-medium hover:underline">
            {feat.view_all_text || t('theme.section.featured_products.view_all')} <span className="inline-block rtl:rotate-180">&rarr;</span>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-lg" />
            ))}
          </div>
        ) : (
          <ProductRail columns={(Number(feat.columns) || 3) as 2 | 3 | 4 | 5}>
            {featured.map((p) => (
              <ProductCard key={p._id} product={p} onQuickView={feat.show_quick_view !== false ? onQuickView : undefined}>
                <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
                <ProductCard.Body>
                  <ProductCard.Title />
                  {feat.show_rating !== false && <ProductCard.Rating />}
                  <ProductCard.Price showCompareAt showDiscount className="mt-2" />
                  <ProductCard.Actions fullWidth className="mt-3" addToCartText={feat.add_to_cart_text || t('theme.section.featured_products.add_to_cart')} />
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </div>
    </section>
  );
}

/** Demo pillars this theme used to ship; sections saved back then still carry them. */
const LEGACY_DEMO_PILLARS = [
  { title: 'Sustainably Sourced', description: 'Responsibly harvested materials from certified suppliers.' },
  { title: 'Built to Endure', description: 'Rigorous quality testing ensures lasting beauty and function.' },
  { title: 'Thoughtful Design', description: 'Each piece balances form, function, and timeless aesthetics.' },
];

/**
 * Designed to Last - Philosophy Section. The merchant's own words only (body
 * text, else the store description) and the pillars they wrote — the demo
 * copy claims sourcing and quality testing the store never stated
 * ("sustainably sourced… certified suppliers"). Nothing written → no section.
 */
function PhilosophyBlock({ id }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const philosophy = useThemeSettings(id);
  const { store } = useStore();
  const pillarBlocks = useMerchantBlocks(id, ['title', 'description'], LEGACY_DEMO_PILLARS);
  const { ref: philosophyRef, isIntersecting: philosophyVisible } = useIntersectionObserver({ threshold: 0.1 });
  const body = merchantText(philosophy.body_text) || merchantText(store?.description);
  if (!body && pillarBlocks.length === 0) return null;

  return (
    <section
      ref={philosophyRef as React.RefObject<HTMLElement>}
      className={`py-24 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${philosophyVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ backgroundColor: philosophy.background_color || '#f9f7f4' }}
    >
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-4">
          {philosophy.eyebrow || t('theme.section.philosophy.eyebrow')}
        </p>
        <h2 className="text-3xl font-semibold mb-6">{philosophy.heading || t('theme.section.philosophy.title')}</h2>
        {body && (
          <p className="text-gray-500 leading-relaxed max-w-2xl mx-auto mb-10">
            {body}
          </p>
        )}
        {pillarBlocks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {pillarBlocks.map((block) => (
            <div key={block.id} className="text-center">
              <div className="w-12 h-12 bg-[#d4a76a]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-3 h-3 bg-[#d4a76a] rounded-full" />
              </div>
              {merchantText(block.settings.title) && <h3 className="font-medium text-gray-800 mb-2">{block.settings.title}</h3>}
              {merchantText(block.settings.description) && <p className="text-sm text-gray-500">{block.settings.description}</p>}
            </div>
          ))}
        </div>
        )}
      </div>
    </section>
  );
}

/** Inspiration Carousel (hidden until enough featured products exist) */
function TrendingBlock({ id, onQuickView }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const trending = useThemeSettings(id);
  const trendingLimit = trending.product_limit || 6;
  const minProductsToShow = trending.min_products_to_show || 3;
  const { products: featured } = useFeaturedProducts(trendingLimit);
  if (featured.length < minProductsToShow) return null;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-2">
            {trending.eyebrow || t('theme.section.trending.eyebrow')}
          </p>
          <h2 className="text-3xl font-semibold">{trending.heading || t('theme.section.trending.title')}</h2>
        </div>
        <ProductRail columns={4}>
          {featured.slice(0, trendingLimit).map((p) => (
            <ProductCard key={p._id} product={p} onQuickView={onQuickView}>
              <ProductCard.Image showBadge hoverSwap />
              <ProductCard.Body>
                <ProductCard.Title />
                <ProductCard.Price showCompareAt />
              </ProductCard.Body>
            </ProductCard>
          ))}
        </ProductRail>
      </div>
    </section>
  );
}

/** Newsletter with Gold CTA */
function NewsletterBlock({ id }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const news = useThemeSettings(id);
  const { ref: newsletterRef, isIntersecting: newsletterVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section
      ref={newsletterRef as React.RefObject<HTMLElement>}
      className={`py-20 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${newsletterVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ backgroundColor: news.background_color || '#2d2d2d' }}
    >
      <div className="max-w-xl mx-auto px-6 text-center">
        <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-4">
          {news.eyebrow || t('theme.section.newsletter.eyebrow')}
        </p>
        <h2 className="text-2xl font-semibold text-white mb-4">{news.heading || t('theme.section.newsletter.title')}</h2>
        <p className="text-gray-300 mb-8">
          {news.subheading || t('theme.section.newsletter.subtitle')}
        </p>
        <form onSubmit={(e) => e.preventDefault()} className="flex gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder={news.placeholder || t('theme.section.newsletter.placeholder')}
            className="flex-1 bg-[#3d3d3d] text-white px-4 py-3 border border-gray-600 focus:border-[#d4a76a] focus:outline-none placeholder-gray-500"
          />
          <button type="submit" className="bg-[#d4a76a] text-[#2d2d2d] px-6 py-3 font-medium hover:bg-[#c49a5f] transition whitespace-nowrap">
            {news.button_text || t('theme.section.newsletter.button')}
          </button>
        </form>
      </div>
    </section>
  );
}

// Bespoke components keyed by section TYPE, in this theme's own look.
const SECTION_COMPONENTS: Record<string, React.FC<SectionProps>> = {
  'hero': HeroBlock,
  'new-arrivals': NewArrivalsBlock,
  'categories': CategoriesBlock,
  'featured-products': FeaturedBlock,
  'philosophy': PhilosophyBlock,
  'trending-carousel': TrendingBlock,
  'newsletter': NewsletterBlock,
};

const Home: React.FC = () => {
  // The merchant's composed homepage — ORDERED and enabled-filtered (falls
  // back to the manifest's templates.index). Rendering in THIS order is what
  // makes reordering in the editor work and keeps removed sections away.
  const orderedSections = useTemplateSections('index');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  return (
    <div>
      {/* Every section in the merchant's composed order — bespoke components for
          this theme's own types, the shared registry for any other section
          added from the editor — so added sections land where they were placed. */}
      {orderedSections.map((s) => {
        const Bespoke = SECTION_COMPONENTS[s.type];
        const Shared = DEFAULT_SECTION_REGISTRY[s.type];
        if (!Bespoke && !Shared) return null; // unknown type — silently skipped for shoppers
        return (
          <div key={s.id} data-section-id={s.id} className="scroll-mt-20">
            {Bespoke
              ? <Bespoke id={s.id} onQuickView={setQuickViewProduct} />
              : <Shared id={s.id} section={s} onQuickView={setQuickViewProduct} />}
          </div>
        );
      })}

      {/* QuickView Modal */}
      <QuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
};

export default Home;
