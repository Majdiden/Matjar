import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionBlocks, useTemplateSections } from '@matjar/theme-shared/theme/ThemeProvider';
import { DEFAULT_SECTION_REGISTRY } from '@matjar/theme-shared/components/sections';
import { useFeaturedProducts, useCategories, useProducts } from '@matjar/theme-shared/hooks/useProducts';
import { ProductCarousel } from '@matjar/theme-shared/components/commerce/ProductCarousel';
import { Hero } from '@matjar/theme-shared/components/sections/Hero';
import { CategoryShowcase } from '@matjar/theme-shared/components/sections/CategoryShowcase';
import { Carousel } from '@matjar/theme-shared/components/primitives/Carousel';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { CountdownTimer } from '@matjar/theme-shared/components/marketing/CountdownTimer';
import { ImageCarousel } from '@matjar/theme-shared/components/marketing/ImageCarousel';
import { useIntersectionObserver } from '@matjar/theme-shared/hooks/useIntersectionObserver';
import type { Product } from '@matjar/theme-shared/types/commerce';

// Niche default hero image — a clean tech/gadget lifestyle shot — so the
// hero is never empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600&q=80&auto=format&fit=crop';

// Niche default promo-banner imagery (same Unsplash-style defaults as the
// hero) so the promo slideshow is never empty before the merchant uploads
// their own campaign art.
const PROMO_DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=1600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=1600&q=80&auto=format&fit=crop',
];

// Section types this theme renders with bespoke JSX. Anything else in the
// merchant's layout falls through to the shared section registry, rendered
// inline in the SAME position (order) so nothing is stuck at the bottom.
const HARDCODED_TYPES = ['hero', 'categories', 'featured-products', 'trust-badges', 'promo-banners', 'new-arrivals', 'newsletter'];

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);

  // Read section settings from the manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const cats = useThemeSettings('categories');
  const feat = useThemeSettings('featured-products');
  const trust = useThemeSettings('trust-badges');
  const promo = useThemeSettings('promo-banners');
  const arrivals = useThemeSettings('new-arrivals');
  const news = useThemeSettings('newsletter');
  const trustBadgeBlocks = useSectionBlocks('trust-badges');
  const promoBlocks = useSectionBlocks('promo-banners');

  // The merchant's composed layout for the home template — ORDERED and
  // enabled-filtered. Rendering in THIS order (instead of a fixed JSX order)
  // is what makes reordering sections in the visual editor actually work.
  const orderedSections = useTemplateSections('index');

  const { products: featured, loading: featuredLoading } = useFeaturedProducts(feat.product_limit || 8);
  const { products: newArrivals, loading: newLoading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 8 });
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Animate sections on scroll
  const { ref: categoriesRef, isIntersecting: categoriesVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: featuredRef, isIntersecting: featuredVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: promoRef, isIntersecting: promoVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: newArrivalsRef, isIntersecting: newArrivalsVisible } = useIntersectionObserver({ threshold: 0.1 });

  // Promo slideshow slides — merchant-configured blocks (dashboard) first;
  // when none carry an image yet, fall back to a tasteful translated default
  // pair so the section never renders empty frames.
  const configuredPromo = promoBlocks.filter((b) => b.type === 'slide' && b.settings?.image);
  const promoSlides = configuredPromo.length > 0
    ? configuredPromo.map((b) => ({
        image: b.settings.image as string,
        href: (b.settings.link as string) || undefined,
        alt: (b.settings.alt as string) || undefined,
        title: (b.settings.title as string) || undefined,
        subtitle: (b.settings.subtitle as string) || undefined,
        ctaLabel: (b.settings.cta_label as string) || undefined,
        ctaHref: (b.settings.cta_url as string) || undefined,
        align: (b.settings.align as 'start' | 'center' | 'end') || 'start',
      }))
    : [
        {
          image: PROMO_DEFAULT_IMAGES[0],
          href: '/products',
          alt: t('theme.section.promo-banners.slide1_title'),
          title: t('theme.section.promo-banners.slide1_title'),
          subtitle: t('theme.section.promo-banners.slide1_subtitle'),
          ctaLabel: t('theme.section.promo-banners.slide1_cta'),
          align: 'start' as const,
        },
        {
          image: PROMO_DEFAULT_IMAGES[1],
          href: '/products?sort=newest',
          alt: t('theme.section.promo-banners.slide2_title'),
          title: t('theme.section.promo-banners.slide2_title'),
          subtitle: t('theme.section.promo-banners.slide2_subtitle'),
          ctaLabel: t('theme.section.promo-banners.slide2_cta'),
          align: 'start' as const,
        },
      ];

  // Bespoke renderers keyed by section TYPE. `orderedSections` is already
  // enabled-filtered, so these only need their extra content conditions.
  const blockRenderers: Record<string, () => React.ReactNode> = {
    'hero': () => (
      <Carousel autoPlay={5000} showDots loop className="relative">
        {/* Slide 1 — premium shared hero. */}
        <Hero
          variant="spotlight"
          tone="light"
          title={hero.heading || t('theme.section.hero.headline')}
          subtitle={hero.subheading || t('theme.section.hero.subheadline')}
          primaryCta={{ label: hero.primary_button_text || t('theme.section.hero.primary_cta'), href: hero.primary_button_url || '/products' }}
          secondaryCta={{ label: hero.secondary_button_text || t('theme.section.hero.secondary_cta'), href: hero.secondary_button_url || '/categories' }}
          backgroundImage={hero.background_image || undefined}
          media={featured?.find((p) => p.images?.[0])?.images?.[0]}
          defaultImage={HERO_DEFAULT_IMAGE}
        />
        {/* Slide 2 — Sale (optional). */}
        {hero.show_sale_slide !== false && (
          <div
            className="relative isolate overflow-hidden py-16 sm:py-20 lg:py-28"
            style={{ background: 'linear-gradient(135deg, var(--color-accent, #f59e0b) 0%, color-mix(in srgb, var(--color-accent, #f59e0b) 55%, #111) 100%)' }}
          >
            <div
              className="absolute inset-0 -z-10 opacity-[0.18]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)', backgroundSize: '22px 22px' }}
            />
            <div className="max-w-[var(--layout-max-width,1280px)] mx-auto px-4 sm:px-6 lg:px-8 text-center text-white relative z-10">
              <span className="inline-flex items-center rounded-[var(--radius-pill,9999px)] bg-white/15 ring-1 ring-white/20 backdrop-blur-sm px-3.5 py-1.5 text-xs sm:text-sm font-semibold mb-4">
                {t('theme.section.hero.sale_badge')}
              </span>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>{hero.sale_heading || t('theme.section.hero.sale_heading')}</h2>
              <p className="text-lg sm:text-xl text-white/90 mb-6">{hero.sale_subheading || t('theme.section.hero.sale_subheading')}</p>
              {hero.show_countdown !== false && (
                <CountdownTimer
                  endDate={new Date(Date.now() + (hero.countdown_days || 3) * 24 * 60 * 60 * 1000).toISOString()}
                  variant="boxes"
                  className="mb-8"
                />
              )}
              <Link
                to={hero.sale_button_url || '/products'}
                className="inline-flex items-center justify-center bg-white font-semibold px-7 py-3.5 rounded-[var(--radius,12px)] shadow-[var(--shadow-lg)] hover:-translate-y-0.5 hover:brightness-105 transition-[transform,filter] duration-[var(--duration-fast,150ms)]"
                style={{ color: 'var(--color-accent, #d97706)' }}
              >
                {hero.sale_button_text || t('theme.section.hero.sale_cta')}
              </Link>
            </div>
          </div>
        )}
      </Carousel>
    ),

    'categories': () => categories.length > 0 && (
      <CategoryShowcase
        ref={categoriesRef as React.RefObject<HTMLElement>}
        className={`transition-opacity duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${categoriesVisible ? 'opacity-100' : 'opacity-0'}`}
        visible={categoriesVisible}
        categories={categories}
        heading={cats.heading || t('theme.section.categories.heading')}
        subheading={cats.subheading || t('theme.section.categories.subheading')}
        maxCategories={cats.max_categories || 6}
        showCount={cats.show_product_count !== false}
        countLabel={(count) => t('theme.section.categories.items_count', { count })}
      />
    ),

    'featured-products': () => (
      <section
        ref={featuredRef as React.RefObject<HTMLElement>}
        className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${featuredVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <ProductCarousel
          products={featured}
          loading={featuredLoading}
          heading={feat.heading || t('theme.section.featured-products.heading')}
          subheading={feat.subheading || undefined}
          viewAllHref={feat.view_all_url || '/products'}
          viewAllLabel={t('theme.section.featured-products.view_all')}
          desktopSlides={(Number(feat.columns) || 4) as 2 | 3 | 4 | 5}
          onQuickView={feat.show_quick_view !== false ? setQuickViewProduct : undefined}
          showRating={feat.show_rating !== false}
          showAddToCart={feat.show_add_to_cart !== false}
          addToCartLabel={t('theme.section.featured-products.add_to_cart')}
          hoverSwap
        />
      </section>
    ),

    'trust-badges': () => trust.show_section !== false && (
      <section style={{ backgroundColor: trust.background_color || 'var(--color-muted-background, #f9fafb)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {trustBadgeBlocks.map((block) => {
              const { icon, title, description } = block.settings;
              const iconSvgs: Record<string, React.ReactNode> = {
                shipping: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>,
                lock: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
                return: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>,
              };
              return (
                <div
                  key={block.id}
                  className="flex items-center gap-4 p-6 rounded-xl shadow-sm border"
                  style={{
                    backgroundColor: 'var(--color-background, #ffffff)',
                    borderColor: 'var(--color-border, #e5e7eb)',
                  }}
                >
                  <div className="shrink-0" style={{ color: trust.accent_color || 'var(--color-primary, #2563eb)' }}>{iconSvgs[icon] || iconSvgs.shipping}</div>
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--color-foreground, #111827)' }}>{title}</h3>
                    <p className="text-sm" style={{ color: 'var(--color-muted, #6b7280)' }}>{description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    ),

    'promo-banners': () => promoSlides.length > 0 && (
      <section
        ref={promoRef as React.RefObject<HTMLElement>}
        className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${promoVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <ImageCarousel
          slides={promoSlides}
          autoPlay={promo.autoplay === false ? 0 : (Number(promo.autoplay_interval) || 5) * 1000}
          aspect={promo.aspect_ratio || '21/9'}
          rounded={promo.rounded !== false}
          showArrows={promo.show_arrows !== false}
          showDots={promo.show_dots !== false}
        />
      </section>
    ),

    'new-arrivals': () => (
      <section
        ref={newArrivalsRef as React.RefObject<HTMLElement>}
        className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${newArrivalsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <ProductCarousel
          products={newArrivals}
          loading={newLoading}
          heading={arrivals.heading || t('theme.section.new-arrivals.heading')}
          subheading={arrivals.subheading || undefined}
          viewAllHref={arrivals.view_all_url || '/products?sort=newest'}
          viewAllLabel={t('theme.section.new-arrivals.see_more')}
          desktopSlides={4}
          onQuickView={setQuickViewProduct}
          showRating={false}
          showAddToCart={arrivals.show_add_to_cart !== false}
          addToCartLabel={t('theme.section.new-arrivals.add_to_cart')}
          autoPlay={arrivals.autoplay ? 5000 : 0}
        />
      </section>
    ),

    'newsletter': () => (
      <section
        className="py-20"
        style={{
          background: news.use_gradient !== false
            ? `linear-gradient(135deg, var(--color-primary, #2563eb) 0%, var(--color-secondary, #1e40af) 100%)`
            : news.background_color || '#2563eb',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold mb-2">{news.heading || t('theme.section.newsletter.heading')}</h2>
          <p className="opacity-90 mb-8">{news.subheading || t('theme.section.newsletter.subheading')}</p>
          <form className="flex gap-2 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder={news.placeholder || t('theme.section.newsletter.placeholder')}
              className="flex-1 px-4 py-3.5 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              type="submit"
              className="px-6 py-3.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg font-medium transition border border-white/30"
            >
              {news.button_text || t('theme.section.newsletter.cta')}
            </button>
          </form>
          {news.disclaimer && <p className="text-xs opacity-60 mt-3">{news.disclaimer}</p>}
        </div>
      </section>
    ),
  };

  return (
    <div>
      {/* Render EVERY section in the merchant's composed order — bespoke blocks
          for this theme's known types, and the shared registry for any other
          section the merchant added — so reordering in the editor works and
          added sections land exactly where they were placed. */}
      {orderedSections.map((s) => {
        const renderBlock = blockRenderers[s.type];
        if (renderBlock) {
          return <React.Fragment key={s.id}>{renderBlock()}</React.Fragment>;
        }
        if (HARDCODED_TYPES.includes(s.type)) return null; // no content (shouldn't happen)
        const Component = DEFAULT_SECTION_REGISTRY[s.type];
        if (!Component) return null; // unknown type — silently skipped for shoppers
        return <Component key={s.id} id={s.id} section={s} onQuickView={setQuickViewProduct} />;
      })}

      {/* Quick View Modal */}
      <QuickView
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

export default Home;
