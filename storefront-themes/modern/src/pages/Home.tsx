import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionEnabled, useSectionBlocks } from '@matjar/theme-shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories, useProducts } from '@matjar/theme-shared/hooks/useProducts';
import { ProductCard } from '@matjar/theme-shared/components/commerce/ProductCard';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { Hero } from '@matjar/theme-shared/components/sections/Hero';

// Niche default hero image — a clean tech/gadget lifestyle shot — so the
// hero is never empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600&q=80&auto=format&fit=crop';
import { Carousel } from '@matjar/theme-shared/components/primitives/Carousel';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { CountdownTimer } from '@matjar/theme-shared/components/marketing/CountdownTimer';
import { MerchantSections } from '@matjar/theme-shared/theme/SectionRenderer';

// IDs that this theme renders inline above. MerchantSections will render
// any other section instances the merchant added in the dashboard.
const HARDCODED_IDS = ['hero', 'categories', 'featured-products', 'trust-badges', 'new-arrivals', 'newsletter'];
import { useIntersectionObserver } from '@matjar/theme-shared/hooks/useIntersectionObserver';
import type { Product } from '@matjar/theme-shared/types/commerce';

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);

  // Read section settings from the manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const cats = useThemeSettings('categories');
  const feat = useThemeSettings('featured-products');
  const trust = useThemeSettings('trust-badges');
  const arrivals = useThemeSettings('new-arrivals');
  const news = useThemeSettings('newsletter');
  const trustBadgeBlocks = useSectionBlocks('trust-badges');

  // Section visibility
  const heroEnabled = useSectionEnabled('hero');
  const catsEnabled = useSectionEnabled('categories');
  const featEnabled = useSectionEnabled('featured-products');
  const trustEnabled = useSectionEnabled('trust-badges');
  const arrivalsEnabled = useSectionEnabled('new-arrivals');
  const newsEnabled = useSectionEnabled('newsletter');

  const { products: featured, loading: featuredLoading } = useFeaturedProducts(feat.product_limit || 8);
  const { products: newArrivals, loading: newLoading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 8 });
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Animate sections on scroll
  const { ref: categoriesRef, isIntersecting: categoriesVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: featuredRef, isIntersecting: featuredVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: newArrivalsRef, isIntersecting: newArrivalsVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <div>
      {/* Hero Carousel */}
      {heroEnabled && (
      <Carousel autoPlay={5000} showDots loop className="relative">
        {/* Slide 1 — premium shared hero. CTA/eyebrow fall back to
            translated defaults so a brand-new store never shows a bare,
            button-less gradient; a featured-product photo becomes the
            floating showcase when no background image is set. */}
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

        {/* Slide 2 — Sale (optional). Token-driven accent gradient so it
            tracks the theme palette + customizer instead of a hardcoded
            rose/pink, with the same dotted texture as the main hero. */}
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
      )}

      {/* Categories */}
      {catsEnabled && categories.length > 0 && (
        <section
          ref={categoriesRef as React.RefObject<HTMLElement>}
          className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${categoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">{cats.heading || t('theme.section.categories.heading')}</h2>
            {cats.subheading && <p className="text-gray-500">{cats.subheading}</p>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.slice(0, cats.max_categories || 6).map((cat, i) => (
              <Link
                key={cat._id}
                to={`/categories/${cat.slug}`}
                className="group text-center p-6 rounded-xl border hover:shadow-lg hover:border-gray-300 transition-all duration-300"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-16 h-16 mx-auto mb-3 rounded-full object-cover ring-4 ring-gray-100 group-hover:ring-blue-100 transition" />
                ) : (
                  <div
                    className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
                  >
                    {cat.name[0]}
                  </div>
                )}
                <span className="text-sm font-medium group-hover:text-blue-600 transition">{cat.name}</span>
                {cats.show_product_count !== false && cat.productCount !== undefined && (
                  <span className="block text-xs text-gray-400 mt-1">{t('theme.section.categories.items_count', { count: cat.productCount })}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featEnabled && (
      <section
        ref={featuredRef as React.RefObject<HTMLElement>}
        className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${featuredVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">{feat.heading || t('theme.section.featured-products.heading')}</h2>
            {feat.subheading && <p className="text-gray-500 mt-1">{feat.subheading}</p>}
          </div>
          <Link
            to={feat.view_all_url || '/products'}
            className="text-sm font-medium hover:underline flex items-center gap-1"
            style={{ color: 'var(--color-primary, #2563eb)' }}
          >
            {t('theme.section.featured-products.view_all')}
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {featuredLoading ? (
          <Skeleton.ProductGrid count={parseInt(feat.columns) || 4} />
        ) : (
          <ProductRail columns={(Number(feat.columns) || 4) as 2 | 3 | 4 | 5}>
            {featured.map((product) => (
              <ProductCard key={product._id} product={product} onQuickView={feat.show_quick_view !== false ? setQuickViewProduct : undefined}>
                <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
                <ProductCard.Body>
                  <ProductCard.Title />
                  {feat.show_rating !== false && <ProductCard.Rating />}
                  <ProductCard.Price showCompareAt showDiscount className="mt-2" />
                  {feat.show_add_to_cart !== false && <ProductCard.Actions fullWidth className="mt-3" addToCartText={t('theme.section.featured-products.add_to_cart')} />}
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </section>
      )}

      {/* Trust Badges */}
      {trustEnabled && trust.show_section !== false && (
        <section style={{ backgroundColor: trust.background_color || 'var(--color-muted-background, #f9fafb)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {trustBadgeBlocks.map((block) => {
                const { icon, title, description } = block.settings;
                // Icon keys map to inline SVGs. Unknown keys fall back to the shipping glyph.
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
      )}

      {/* New Arrivals Carousel */}
      {arrivalsEnabled && (
      <section
        ref={newArrivalsRef as React.RefObject<HTMLElement>}
        className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${newArrivalsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">{arrivals.heading || t('theme.section.new-arrivals.heading')}</h2>
            {arrivals.subheading && <p className="text-gray-500 mt-1">{arrivals.subheading}</p>}
          </div>
          <Link
            to={arrivals.view_all_url || '/products?sort=newest'}
            className="text-sm font-medium hover:underline flex items-center gap-1"
            style={{ color: 'var(--color-primary, #2563eb)' }}
          >
            {t('theme.section.new-arrivals.see_more')}
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {newLoading ? (
          <Skeleton.ProductGrid count={4} />
        ) : (
          <ProductRail columns={4}>
            {newArrivals.map((product) => (
              <ProductCard key={product._id} product={product} onQuickView={setQuickViewProduct}>
                <ProductCard.Image showBadge showQuickView />
                <ProductCard.Body>
                  <ProductCard.Title />
                  <ProductCard.Price showCompareAt showDiscount className="mt-2" />
                  {arrivals.show_add_to_cart !== false && <ProductCard.Actions fullWidth className="mt-3" addToCartText={t('theme.section.new-arrivals.add_to_cart')} />}
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </section>
      )}

      {/* Newsletter */}
      {newsEnabled && (
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
      )}

      {/* Merchant-added sections (anything the dashboard added beyond the curated layout above) */}
      <MerchantSections template="index" excludeIds={HARDCODED_IDS} onQuickView={setQuickViewProduct} />

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
