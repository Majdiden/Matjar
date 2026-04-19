import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useThemeSettings, useSectionEnabled, useSectionBlocks } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories, useProducts } from '@shared/hooks/useProducts';
import { ProductCard } from '@shared/components/commerce/ProductCard';
import { Carousel } from '@shared/components/primitives/Carousel';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { QuickView } from '@shared/components/discovery/QuickView';
import { CountdownTimer } from '@shared/components/marketing/CountdownTimer';
import { MerchantSections } from '@shared/theme/SectionRenderer';

// IDs that this theme renders inline above. MerchantSections will render
// any other section instances the merchant added in the dashboard.
const HARDCODED_IDS = ['hero', 'categories', 'featured-products', 'trust-badges', 'new-arrivals', 'newsletter'];
import { useIntersectionObserver } from '@shared/hooks/useIntersectionObserver';
import type { Product } from '@shared/types/commerce';

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { store } = useStore();

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
        {/* Slide 1 */}
        <div
          className="relative py-28 md:py-40"
          style={{
            background: hero.background_image
              ? `url(${hero.background_image}) center/cover`
              : `linear-gradient(135deg, var(--color-primary, #2563eb) 0%, var(--color-secondary, #1e40af) 100%)`,
          }}
        >
          {hero.background_image && hero.overlay_opacity > 0 && (
            <div className="absolute inset-0 bg-black" style={{ opacity: hero.overlay_opacity / 100 }} />
          )}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-white relative z-10">
            {hero.badge_text && (
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-4 backdrop-blur-sm">
                {hero.badge_text}
              </span>
            )}
            <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
              {hero.heading || store?.name || t('theme.section.hero.headline')}
            </h1>
            <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              {hero.subheading || store?.description || t('theme.section.hero.subheadline')}
            </p>
            <div className="flex gap-3 justify-center">
              {hero.primary_button_text && (
                <Link
                  to={hero.primary_button_url || '/products'}
                  className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-8 py-3.5 rounded-lg hover:bg-gray-100 transition shadow-lg"
                >
                  {hero.primary_button_text}
                  <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              )}
              {hero.secondary_button_text && (
                <Link
                  to={hero.secondary_button_url || '/categories'}
                  className="inline-flex items-center gap-2 border-2 border-white/40 text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-white/10 transition"
                >
                  {hero.secondary_button_text}
                </Link>
              )}
            </div>
          </div>
          <div className="absolute top-1/2 start-10 w-72 h-72 bg-white/5 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute bottom-0 end-10 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-y-1/2" />
        </div>

        {/* Slide 2 — Sale (optional) */}
        {hero.show_sale_slide !== false && (
          <div className="relative py-28 md:py-40 bg-gradient-to-br from-rose-600 to-pink-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-white relative z-10">
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-4">
                {t('theme.section.hero.sale_badge')}
              </span>
              <h2 className="text-4xl md:text-6xl font-bold mb-4">{hero.sale_heading || t('theme.section.hero.sale_heading')}</h2>
              <p className="text-xl opacity-90 mb-6">{hero.sale_subheading || t('theme.section.hero.sale_subheading')}</p>
              {hero.show_countdown !== false && (
                <CountdownTimer
                  endDate={new Date(Date.now() + (hero.countdown_days || 3) * 24 * 60 * 60 * 1000).toISOString()}
                  variant="boxes"
                  className="mb-8"
                />
              )}
              <Link
                to={hero.sale_button_url || '/products'}
                className="inline-block bg-white text-rose-600 font-semibold px-8 py-3.5 rounded-lg hover:bg-gray-100 transition shadow-lg"
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
          className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 transition-all duration-700 ${categoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
        className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 transition-all duration-700 ${featuredVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
          <div className={`grid grid-cols-2 md:grid-cols-${feat.columns || '4'} gap-4 md:gap-6`}>
            {featured.map((product) => (
              <ProductCard key={product._id} product={product} onQuickView={feat.show_quick_view !== false ? setQuickViewProduct : undefined}>
                <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
                <ProductCard.Body>
                  <ProductCard.Title />
                  {feat.show_rating !== false && <ProductCard.Rating />}
                  <div className="flex items-center justify-between mt-2">
                    <ProductCard.Price showCompareAt showDiscount />
                    {feat.show_add_to_cart !== false && <ProductCard.Actions addToCartText={t('theme.section.featured-products.add_to_cart')} />}
                  </div>
                </ProductCard.Body>
              </ProductCard>
            ))}
          </div>
        )}
      </section>
      )}

      {/* Trust Badges */}
      {trustEnabled && trust.show_section !== false && (
        <section className="dark:bg-gray-800/50" style={{ backgroundColor: trust.background_color || '#f9fafb' }}>
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
                  <div key={block.id} className="flex items-center gap-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                    <div className="shrink-0 text-gray-600" style={{ color: trust.accent_color || 'var(--color-primary, #2563eb)' }}>{iconSvgs[icon] || iconSvgs.shipping}</div>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="text-sm text-gray-500">{description}</p>
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
        className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 transition-all duration-700 ${newArrivalsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
          <Carousel slidesPerView={4} gap={16} showArrows showDots={false} loop autoPlay={arrivals.autoplay ? 5000 : undefined}>
            {newArrivals.map((product) => (
              <ProductCard key={product._id} product={product} onQuickView={setQuickViewProduct}>
                <ProductCard.Image showBadge showQuickView />
                <ProductCard.Body>
                  <ProductCard.Title />
                  <ProductCard.Price />
                  {arrivals.show_add_to_cart !== false && <ProductCard.Actions addToCartText={t('theme.section.new-arrivals.add_to_cart')} />}
                </ProductCard.Body>
              </ProductCard>
            ))}
          </Carousel>
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
