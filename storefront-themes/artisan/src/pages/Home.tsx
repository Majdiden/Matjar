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
import type { Product } from '@shared/types/commerce';

const HARDCODED_IDS = ['hero', 'philosophy', 'featured-products', 'artisan-spotlight', 'categories', 'new-arrivals', 'newsletter'];

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { store } = useStore();

  // Read section settings from the manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const philosophy = useThemeSettings('philosophy');
  const feat = useThemeSettings('featured-products');
  const spotlight = useThemeSettings('artisan-spotlight');
  const cats = useThemeSettings('categories');
  const arrivals = useThemeSettings('new-arrivals');
  const news = useThemeSettings('newsletter');
  const spotlightBlocks = useSectionBlocks('artisan-spotlight');

  // Section visibility
  const heroEnabled = useSectionEnabled('hero');
  const philosophyEnabled = useSectionEnabled('philosophy');
  const featEnabled = useSectionEnabled('featured-products');
  const spotlightEnabled = useSectionEnabled('artisan-spotlight');
  const catsEnabled = useSectionEnabled('categories');
  const arrivalsEnabled = useSectionEnabled('new-arrivals');
  const newsEnabled = useSectionEnabled('newsletter');

  const { products: featured, loading: featuredLoading } = useFeaturedProducts(feat.product_limit || 6);
  const { products: newArrivals, loading: newLoading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 8 });
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const { ref: storyRef, isIntersecting: storyVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: featuredRef, isIntersecting: featuredVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: categoriesRef, isIntersecting: categoriesVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: newArrivalsRef, isIntersecting: newArrivalsVisible } = useIntersectionObserver({ threshold: 0.1 });
  const { ref: makerRef, isIntersecting: makerVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <div>
      {/* Hero */}
      {heroEnabled && (
      <section className="relative bg-[var(--color-primary)] py-28 md:py-36 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 start-10 w-64 h-64 border border-[var(--color-border)] rounded-full" />
          <div className="absolute bottom-10 end-10 w-48 h-48 border border-[var(--color-border)] rounded-full" />
          <div className="absolute top-1/2 left-1/2 w-96 h-96 border border-[var(--color-border)] rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <p className="text-[var(--color-border)] text-xs uppercase tracking-[0.4em] mb-4">
            {hero.eyebrow_text || t('theme.section.hero.eyebrow')}
          </p>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 italic leading-tight">
            {hero.heading_line1 || t('theme.section.hero.heading_line1')}<br />{hero.heading_line2 || t('theme.section.hero.heading_line2')}
          </h1>
          <p className="text-[var(--color-border)] mb-8 max-w-md mx-auto leading-relaxed">
            {hero.subheading || t('theme.section.hero.subheading')}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to={hero.primary_button_url || '/products'}
              className="inline-block bg-[var(--color-accent)] text-white px-8 py-3.5 rounded font-semibold hover:bg-[var(--color-secondary)] transition shadow-lg"
            >
              {hero.primary_button_text || t('theme.section.hero.primary_cta')}
            </Link>
            <Link
              to={hero.secondary_button_url || '/categories'}
              className="inline-block border-2 border-[var(--color-border)]/40 text-[var(--color-border)] px-8 py-3.5 rounded font-semibold hover:bg-white/10 transition"
            >
              {hero.secondary_button_text || t('theme.section.hero.secondary_cta')}
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Our Philosophy */}
      {philosophyEnabled && (
      <section
        ref={storyRef as React.RefObject<HTMLElement>}
        className={`max-w-3xl mx-auto px-6 py-20 text-center transition-all duration-700 ${storyVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        {philosophy.show_dividers !== false && <div className="w-16 h-px bg-[var(--color-accent)] mx-auto mb-6" />}
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-primary)] mb-6 italic">
          {philosophy.heading || t('theme.section.philosophy.heading')}
        </h2>
        <p className="text-gray-600 leading-relaxed text-lg">
          {philosophy.body_text || t('theme.section.philosophy.body')}
        </p>
        {philosophy.show_dividers !== false && <div className="w-16 h-px bg-[var(--color-accent)] mx-auto mt-6" />}
      </section>
      )}

      {/* Featured Pieces */}
      {featEnabled && (
      <section
        ref={featuredRef as React.RefObject<HTMLElement>}
        className={`bg-white py-16 transition-all duration-700 ${featuredVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold italic text-[var(--color-primary)] mb-2">{feat.heading || t('theme.section.featured_products.heading')}</h2>
            {feat.subheading && <p className="text-gray-500">{feat.subheading}</p>}
          </div>
          {featuredLoading ? (
            <Skeleton.ProductGrid count={3} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featured.map((product) => (
                <ProductCard key={product._id} product={product} onQuickView={feat.show_quick_view !== false ? setQuickViewProduct : undefined}>
                  <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    {feat.show_rating !== false && <ProductCard.Rating />}
                    <div className="flex items-center justify-between mt-2">
                      <ProductCard.Price showCompareAt />
                      {feat.show_add_to_cart !== false && <ProductCard.Actions addToCartText={feat.add_to_cart_text || t('common.action.add')} />}
                    </div>
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </div>
          )}
          <div className="text-center mt-10">
            <Link
              to={feat.view_all_url || '/products'}
              className="inline-block border-2 border-[var(--color-primary)] text-[var(--color-primary)] px-8 py-3 rounded font-semibold hover:bg-[var(--color-primary)] hover:text-white transition"
            >
              {feat.view_all_text || t('theme.section.featured_products.view_all')}
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Maker Spotlight */}
      {spotlightEnabled && (
      <section
        ref={makerRef as React.RefObject<HTMLElement>}
        className={`bg-[var(--color-muted)]/20/30 py-16 transition-all duration-700 ${makerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold italic text-[var(--color-primary)] mb-2">{spotlight.heading || t('theme.section.artisan_spotlight.heading')}</h2>
            {spotlight.subheading && <p className="text-gray-500">{spotlight.subheading}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {spotlightBlocks.map((block) => {
              const { name, craft, quote } = block.settings as { name: string; craft: string; quote: string };
              return (
                <div key={block.id} className="bg-white rounded-lg p-6 border border-[var(--color-border)] text-center hover:shadow-md transition">
                  <div className="w-20 h-20 rounded-full bg-[var(--color-muted)]/20 mx-auto mb-4 flex items-center justify-center text-[var(--color-primary)] text-2xl font-bold italic">
                    {String(name || '?').split(' ').map(n => n[0]).join('')}
                  </div>
                  <h3 className="font-bold text-[var(--color-primary)]">{name}</h3>
                  <p className="text-xs text-[var(--color-accent)] uppercase tracking-wider mb-3">{craft}</p>
                  <p className="text-sm text-gray-500 italic leading-relaxed">"{quote}"</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* Categories */}
      {catsEnabled && categories.length > 0 && (
        <section
          ref={categoriesRef as React.RefObject<HTMLElement>}
          className={`max-w-6xl mx-auto px-6 py-16 transition-all duration-700 ${categoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold italic text-[var(--color-primary)] mb-2">{cats.heading || t('theme.section.categories.heading')}</h2>
            {cats.subheading && <p className="text-gray-500">{cats.subheading}</p>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {categories.slice(0, cats.max_categories || 4).map((cat) => (
              <Link key={cat._id} to={`/categories/${cat.slug}`} className="group text-center">
                <div className="w-full h-44 bg-[var(--color-muted)]/20 rounded-lg overflow-hidden mb-3 border border-[var(--color-border)] group-hover:border-[var(--color-accent)] transition-all duration-500">
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-primary)] text-4xl font-bold italic opacity-30 group-hover:opacity-50 transition">
                      {cat.name[0]}
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-sm text-[var(--color-primary)] group-hover:text-[var(--color-accent)] transition">{cat.name}</h3>
                {cats.show_product_count !== false && cat.productCount !== undefined && (
                  <span className="text-xs text-gray-400">{cat.productCount} {cats.product_count_label || t('theme.section.categories.pieces_label')}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* New Arrivals Carousel */}
      {arrivalsEnabled && (
      <section
        ref={newArrivalsRef as React.RefObject<HTMLElement>}
        className={`bg-white py-16 transition-all duration-700 ${newArrivalsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold italic text-[var(--color-primary)]">{arrivals.heading || t('theme.section.new_arrivals.heading')}</h2>
              {arrivals.subheading && <p className="text-gray-500 mt-1">{arrivals.subheading}</p>}
            </div>
            <Link to={arrivals.view_all_url || '/products?sort=newest'} className="text-[var(--color-accent)] font-semibold text-sm hover:underline flex items-center gap-1">
              {arrivals.view_all_text || t('theme.section.new_arrivals.see_more')}
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
                    {arrivals.show_add_to_cart !== false && <ProductCard.Actions addToCartText={arrivals.add_to_cart_text || t('common.action.add_to_cart')} />}
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </Carousel>
          )}
        </div>
      </section>
      )}

      {/* Newsletter CTA */}
      {newsEnabled && (
      <section className="py-20 border-t border-b border-[var(--color-border)]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold italic text-[var(--color-primary)] mb-4">{news.heading || t('theme.section.newsletter.heading')}</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            {news.subheading || t('theme.section.newsletter.subheading')}
          </p>
          <form className="flex gap-2 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder={news.placeholder || t('theme.section.newsletter.placeholder')}
              className="flex-1 px-4 py-3.5 border-2 border-[var(--color-border)] rounded text-gray-900 focus:outline-none focus:border-[var(--color-accent)] bg-white"
            />
            <button
              type="submit"
              className="px-6 py-3.5 bg-[var(--color-primary)] hover:bg-[var(--color-secondary)] text-white rounded font-semibold transition"
            >
              {news.button_text || t('theme.section.newsletter.button')}
            </button>
          </form>
          {news.disclaimer && <p className="text-xs text-gray-400 mt-3">{news.disclaimer}</p>}
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
