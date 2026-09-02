import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionEnabled, useSectionBlocks } from '@matjar/theme-shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories, useProducts } from '@matjar/theme-shared/hooks/useProducts';
import { ProductCard } from '@matjar/theme-shared/components/commerce/ProductCard';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { MerchantSections } from '@matjar/theme-shared/theme/SectionRenderer';
import { useIntersectionObserver } from '@matjar/theme-shared/hooks/useIntersectionObserver';
import { Hero } from '@matjar/theme-shared/components/sections/Hero';
import type { Product } from '@matjar/theme-shared/types/commerce';

const HARDCODED_IDS = ['hero', 'philosophy', 'featured-products', 'artisan-spotlight', 'categories', 'new-arrivals', 'newsletter'];

// Niche default hero image — a warm artisan craft / maker's table shot — so
// the hero is never empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1605883705077-8d3d3cebe78c?w=1600&q=80&auto=format&fit=crop';

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);

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
      {/* Hero — shared imagery-forward hero (warm craft split panel) */}
      {heroEnabled && (
        <Hero
          variant="split"
          tone="light"
          title={`${hero.heading_line1 || t('theme.section.hero.heading_line1')} ${hero.heading_line2 || t('theme.section.hero.heading_line2')}`}
          subtitle={hero.subheading || t('theme.section.hero.subheading')}
          primaryCta={{ label: hero.primary_button_text || t('theme.section.hero.primary_cta'), href: hero.primary_button_url || '/products' }}
          secondaryCta={{ label: hero.secondary_button_text || t('theme.section.hero.secondary_cta'), href: hero.secondary_button_url || '/categories' }}
          saleText={hero.eyebrow_text || t('theme.section.hero.eyebrow')}
          backgroundImage={hero.background_image || undefined}
          media={featured?.find((p) => p.images?.[0])?.images?.[0]}
          defaultImage={HERO_DEFAULT_IMAGE}
        />
      )}

      {/* Our Philosophy */}
      {philosophyEnabled && (
      <section
        ref={storyRef as React.RefObject<HTMLElement>}
        className={`max-w-3xl mx-auto px-6 py-20 text-center transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${storyVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
        className={`bg-white py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${featuredVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold italic text-[var(--color-primary)] mb-2">{feat.heading || t('theme.section.featured_products.heading')}</h2>
            {feat.subheading && <p className="text-gray-500">{feat.subheading}</p>}
          </div>
          {featuredLoading ? (
            <Skeleton.ProductGrid count={3} />
          ) : (
            <ProductRail columns={3}>
              {featured.map((product) => (
                <ProductCard key={product._id} product={product} onQuickView={feat.show_quick_view !== false ? setQuickViewProduct : undefined}>
                  <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    {feat.show_rating !== false && <ProductCard.Rating />}
                    <ProductCard.Price showCompareAt showDiscount className="mt-2" />
                    {feat.show_add_to_cart !== false && <ProductCard.Actions fullWidth className="mt-3" addToCartText={feat.add_to_cart_text || t('common:action.add')} />}
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </ProductRail>
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
        className={`bg-[var(--color-muted)]/20/30 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${makerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
          className={`max-w-6xl mx-auto px-6 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${categoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
        className={`bg-white py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${newArrivalsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
            <ProductRail columns={4}>
              {newArrivals.map((product) => (
                <ProductCard key={product._id} product={product} onQuickView={setQuickViewProduct}>
                  <ProductCard.Image showBadge showQuickView />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    <ProductCard.Price />
                    {arrivals.show_add_to_cart !== false && <ProductCard.Actions addToCartText={arrivals.add_to_cart_text || t('common:action.add')} />}
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </ProductRail>
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
