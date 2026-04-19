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
import { MerchantSections } from '@shared/theme/SectionRenderer';
import { useIntersectionObserver } from '@shared/hooks/useIntersectionObserver';
import { CountdownTimer } from '@shared/components/marketing/CountdownTimer';
import type { Product } from '@shared/types/commerce';

const HARDCODED_IDS = ['hero', 'categories', 'weekly-deals', 'featured-products', 'trust-badges', 'new-arrivals', 'newsletter'];

// Grocery shoppers respond to time-bound freshness messaging — a weekly
// rotation creates urgency and matches how real supermarket flyers work.
// The next-Sunday calculation keeps the countdown rolling without any
// merchant intervention.
// Map the icon key stored per block to its SVG. Merchants can pick from
// this allow-list in the dashboard; unknown keys fall back to the shield
// so the layout never renders empty.
function renderTrustIcon(icon: string): React.ReactNode {
  switch (icon) {
    case 'truck':
      return (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 3h15l2 9H4L1 3z" /><circle cx="8" cy="19" r="2" /><circle cx="17" cy="19" r="2" /><path d="M18 12V3" />
        </svg>
      );
    case 'leaf':
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2C14 2 17 0 17 0c-3 0-7 4-7 4s-2-2-5-2c0 0 4 4 4 8C9 14.57 7.89 17.31 7 20H9c1-3 3.64-6 8-6 0 0-4.07 4-4 9h2c0-5 3-9 3-9S19 18 19 20h2C21 7 17 8 17 8z"/>
        </svg>
      );
    case 'heart':
      return (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case 'check':
    case 'shield':
    default:
      return (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
        </svg>
      );
  }
}

function getNextSunday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSunday);
  next.setHours(23, 59, 59, 999);
  return next;
}

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { store } = useStore();

  // Read section settings from the manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const cats = useThemeSettings('categories');
  const feat = useThemeSettings('featured-products');
  const trust = useThemeSettings('trust-badges');
  const trustBlocks = useSectionBlocks('trust-badges');
  const deals = useThemeSettings('weekly-deals');
  const arrivals = useThemeSettings('new-arrivals');
  const news = useThemeSettings('newsletter');

  // Section visibility
  const heroEnabled = useSectionEnabled('hero');
  const catsEnabled = useSectionEnabled('categories');
  const dealsEnabled = useSectionEnabled('weekly-deals');
  const featEnabled = useSectionEnabled('featured-products');
  const trustEnabled = useSectionEnabled('trust-badges');
  const arrivalsEnabled = useSectionEnabled('new-arrivals');
  const newsEnabled = useSectionEnabled('newsletter');

  const { products: featured, loading: featuredLoading } = useFeaturedProducts(feat.product_limit || 8);
  const { products: newArrivals, loading: newLoading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 8 });
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const { ref: categoriesRef, isIntersecting: categoriesVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: featuredRef, isIntersecting: featuredVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: newArrivalsRef, isIntersecting: newArrivalsVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: trustRef, isIntersecting: trustVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <div>
      {/* Hero */}
      {heroEnabled && (
      <section className="relative bg-gradient-to-br from-[#16a34a] via-[#15803d] to-[#166534] py-20 md:py-28 px-4 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#f59e0b]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-10 relative z-10">
          <div className="flex-1 text-white">
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-4 backdrop-blur-sm">
              {hero.badge_text || t('theme.hero.badge_text')}
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
              {hero.heading_line1 || t('theme.hero.heading_line1')}<br />{hero.heading_line2 || t('theme.hero.heading_line2')}
            </h1>
            <p className="text-green-100 text-lg mb-8 max-w-md">
              {hero.subheading || t('theme.hero.subheading')}
            </p>
            <div className="flex gap-3">
              <Link
                to={hero.primary_button_url || '/products'}
                className="inline-flex items-center gap-2 bg-[#f59e0b] text-white px-8 py-3.5 rounded-full font-bold hover:bg-[#d97706] transition shadow-lg"
              >
                {hero.primary_button_text || t('theme.hero.primary_cta')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to={hero.secondary_button_url || '/categories'}
                className="inline-flex items-center gap-2 border-2 border-white/40 text-white px-8 py-3.5 rounded-full font-bold hover:bg-white/10 transition"
              >
                {hero.secondary_button_text || t('theme.hero.secondary_cta')}
              </Link>
            </div>
          </div>
          <div className="flex-1 hidden md:flex justify-center">
            <div className="w-72 h-72 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center animate-pulse">
              <svg className="w-36 h-36 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Categories */}
      {catsEnabled && categories.length > 0 && (
        <section
          ref={categoriesRef as React.RefObject<HTMLElement>}
          className={`max-w-7xl mx-auto px-4 py-16 transition-all duration-700 ${categoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">{cats.heading || t('theme.section.categories.title')}</h2>
            {cats.subheading && <p className="text-gray-500">{cats.subheading}</p>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.slice(0, cats.max_categories || 8).map((cat) => {
              const initial = (cat.name || '?').charAt(0).toUpperCase();
              return (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  className="group bg-white rounded-2xl p-5 text-center shadow-sm hover:shadow-md border border-green-50 transition-all duration-300 hover:-translate-y-1"
                >
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="w-full h-28 object-cover rounded-xl mb-3" />
                  ) : (
                    <div className="w-full h-28 bg-green-50 rounded-xl mb-3 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="w-16 h-16 rounded-full bg-[#16a34a] text-white text-2xl font-bold flex items-center justify-center">
                        {initial}
                      </span>
                    </div>
                  )}
                  <h3 className="font-bold text-sm group-hover:text-[#16a34a] transition">{cat.name}</h3>
                  {cats.show_product_count !== false && cat.productCount !== undefined && (
                    <span className="text-xs text-gray-400 mt-1">{cat.productCount} items</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Weekly Deals — grocery flyer-style countdown to next Sunday */}
      {dealsEnabled !== false && (
        <section className="bg-gradient-to-r from-[#f59e0b] to-[#dc2626] py-10 px-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-white">
            <div className="flex-1 text-center md:text-left">
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold mb-2 backdrop-blur-sm">
                {deals.badge_label || t('theme.section.weekly_deals.badge')}
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-1">{deals.heading || t('theme.section.weekly_deals.title')}</h2>
              <p className="text-white/90 text-sm">{deals.subheading || t('theme.section.weekly_deals.subtitle')}</p>
            </div>
            <div className="flex-shrink-0">
              <CountdownTimer endDate={getNextSunday()} variant="boxes" label="Ends in" />
            </div>
            <Link
              to={deals.cta_url || '/products?onSale=true'}
              className="flex-shrink-0 px-6 py-3 bg-white text-[#dc2626] rounded-full font-bold hover:bg-yellow-50 transition shadow-lg"
            >
              {deals.cta_label || t('theme.section.weekly_deals.cta')}
            </Link>
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featEnabled && (
      <section
        ref={featuredRef as React.RefObject<HTMLElement>}
        className={`bg-white py-16 transition-all duration-700 ${featuredVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">{feat.heading || t('theme.section.featured_products.title')}</h2>
              {feat.subheading && <p className="text-gray-500 mt-1">{feat.subheading}</p>}
            </div>
            <Link to={feat.view_all_url || '/products'} className="text-[#16a34a] font-semibold text-sm hover:underline flex items-center gap-1">
              {feat.view_all_text || t('theme.section.featured_products.view_all')}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          {featuredLoading ? (
            <Skeleton.ProductGrid count={4} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {featured.map((product) => (
                <ProductCard key={product._id} product={product} onQuickView={feat.show_quick_view !== false ? setQuickViewProduct : undefined}>
                  <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    {feat.show_rating !== false && <ProductCard.Rating />}
                    <div className="flex items-center justify-between mt-2">
                      <ProductCard.Price showCompareAt />
                      {feat.show_add_to_cart !== false && <ProductCard.Actions addToCartText={feat.add_to_cart_text || 'Add'} />}
                    </div>
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* Trust Badges */}
      {trustEnabled && trust.show_section !== false && (
        <section
          ref={trustRef as React.RefObject<HTMLElement>}
          className={`max-w-7xl mx-auto px-4 py-16 transition-all duration-700 ${trustVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {trustBlocks.map((block) => (
              <div key={block.id} className="bg-white rounded-2xl p-6 shadow-sm border border-green-50 hover:shadow-md transition">
                <span className="text-[#16a34a] flex justify-center mb-3">{renderTrustIcon(block.settings.icon)}</span>
                <h3 className="font-bold text-sm mb-1">{block.settings.title}</h3>
                <p className="text-xs text-gray-500">{block.settings.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* New Arrivals Carousel */}
      {arrivalsEnabled && (
      <section
        ref={newArrivalsRef as React.RefObject<HTMLElement>}
        className={`bg-green-50/50 py-16 transition-all duration-700 ${newArrivalsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">{arrivals.heading || t('theme.section.new_arrivals.title')}</h2>
              {arrivals.subheading && <p className="text-gray-500 mt-1">{arrivals.subheading}</p>}
            </div>
            <Link to={arrivals.view_all_url || '/products?sort=newest'} className="text-[#16a34a] font-semibold text-sm hover:underline flex items-center gap-1">
              {arrivals.view_all_text || t('theme.section.new_arrivals.view_all')}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                    {arrivals.show_add_to_cart !== false && <ProductCard.Actions addToCartText={arrivals.add_to_cart_text || 'Add to Cart'} />}
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </Carousel>
          )}
        </div>
      </section>
      )}

      {/* Recipe Tips CTA / Newsletter */}
      {newsEnabled && (
      <section className="bg-[#16a34a] py-20">
        <div className="max-w-2xl mx-auto px-4 text-center text-white">
          <span className="flex justify-center mb-4">
            <svg className="w-10 h-10 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
            </svg>
          </span>
          <h2 className="text-3xl font-bold mb-2">{news.heading || t('theme.section.newsletter.title')}</h2>
          <p className="opacity-90 mb-8">{news.subheading || t('theme.section.newsletter.subtitle')}</p>
          <form className="flex gap-2 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder={news.placeholder || t('theme.section.newsletter.placeholder')}
              className="flex-1 px-4 py-3.5 rounded-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              type="submit"
              className="px-6 py-3.5 bg-[#f59e0b] hover:bg-[#d97706] rounded-full font-bold transition shadow-lg"
            >
              {news.button_text || t('theme.section.newsletter.button')}
            </button>
          </form>
          {news.disclaimer && <p className="text-xs opacity-60 mt-3">{news.disclaimer}</p>}
        </div>
      </section>
      )}

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
