import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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

const HARDCODED_IDS = ['hero', 'collections', 'featured-products', 'editorial-banner', 'new-arrivals', 'trust-bar'];

const Home: React.FC = () => {
  const { store } = useStore();

  // Read section settings from manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const collections = useThemeSettings('collections');
  const feat = useThemeSettings('featured-products');
  const editorial = useThemeSettings('editorial-banner');
  const arrivals = useThemeSettings('new-arrivals');
  const trustBar = useThemeSettings('trust-bar');
  const trustBarBlocks = useSectionBlocks('trust-bar');

  // Section visibility
  const heroEnabled = useSectionEnabled('hero');
  const collectionsEnabled = useSectionEnabled('collections');
  const featEnabled = useSectionEnabled('featured-products');
  const editorialEnabled = useSectionEnabled('editorial-banner');
  const arrivalsEnabled = useSectionEnabled('new-arrivals');
  const trustBarEnabled = useSectionEnabled('trust-bar');

  const { products: featured, loading: featuredLoading } = useFeaturedProducts(feat.product_limit || 8);
  const { products: newArrivals, loading: newLoading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 6 });
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const { ref: featuredRef, isIntersecting: featuredVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <div>
      {/* Hero — Full-bleed editorial */}
      {heroEnabled && (
      <section className="relative overflow-hidden" style={{ minHeight: `${hero.min_height || 70}vh`, minBlockSize: '500px' }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: hero.background_image
              ? `url(${hero.background_image})`
              : 'url(https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600&q=80)',
            filter: `brightness(${1 - (hero.overlay_opacity || 30) / 100})`,
          }}
        />
        <div className="relative z-10 h-full flex items-end pb-16 md:pb-20" style={{ minHeight: `${hero.min_height || 70}vh` }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
            <span className="text-white/80 text-xs tracking-[0.3em] uppercase mb-3 block">
              {hero.season_label || 'New Season'}
            </span>
            <h1 className="text-white text-4xl md:text-6xl lg:text-7xl font-light leading-tight mb-6 max-w-2xl" style={{ fontFamily: 'var(--font-family-heading, "Playfair Display", serif)' }}>
              {hero.heading || store?.name || 'Timeless Elegance'}
            </h1>
            <p className="text-white/80 text-lg mb-8 max-w-lg">
              {hero.subheading || store?.description || 'Curated luxury fashion and accessories'}
            </p>
            <div className="flex gap-4">
              <Link to={hero.button_url || '/products'} className="inline-block border-2 border-white text-white px-8 py-3 text-xs tracking-[0.2em] uppercase hover:bg-white hover:text-gray-900 transition-all duration-300">
                {hero.button_text || 'Shop Collection'}
              </Link>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Collections Grid */}
      {collectionsEnabled && categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <span className="text-xs tracking-[0.3em] uppercase text-gray-400 block mb-2">
              {collections.section_label || 'Explore'}
            </span>
            <h2 className="text-3xl md:text-4xl font-light" style={{ fontFamily: 'var(--font-family-heading, "Playfair Display", serif)' }}>
              {collections.heading || 'Our Collections'}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {categories.slice(0, collections.max_categories || 5).map((cat, i) => (
              <Link key={cat._id} to={`/categories/${cat.slug}`} className={`group relative overflow-hidden ${i === 0 ? 'md:row-span-2' : ''}`}>
                <div className={`${i === 0 ? 'aspect-[3/4]' : 'aspect-square'} bg-gray-200 overflow-hidden`}>
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `hsl(${i * 50}, 20%, ${85 - i * 5}%)` }}>
                      <span className="text-4xl text-gray-500 font-light">{cat.name[0]}</span>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-5">
                  <div>
                    <h3 className="text-white text-sm tracking-[0.15em] uppercase font-medium">{cat.name}</h3>
                    <span className="text-white/70 text-xs tracking-wider group-hover:text-white transition">Explore &rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featEnabled && (
      <section ref={featuredRef as React.RefObject<HTMLElement>} className={`bg-gray-50 py-20 transition-all duration-1000 ${featuredVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-xs tracking-[0.3em] uppercase text-gray-400 block mb-2">
                {feat.section_label || 'Curated'}
              </span>
              <h2 className="text-3xl font-light" style={{ fontFamily: 'var(--font-family-heading, "Playfair Display", serif)' }}>
                {feat.heading || "Editor's Picks"}
              </h2>
            </div>
            <Link to={feat.view_all_url || '/products'} className="text-xs tracking-[0.15em] uppercase text-gray-600 hover:text-gray-900 transition border-b border-gray-400 pb-0.5">View All</Link>
          </div>
          {featuredLoading ? <Skeleton.ProductGrid count={4} /> : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {featured.map(product => (
                <ProductCard key={product._id} product={product} onQuickView={setQuickViewProduct}>
                  <ProductCard.Image showBadge showQuickView hoverSwap aspectRatio="aspect-[3/4]" />
                  <ProductCard.Body className="p-4">
                    <ProductCard.Title className="text-xs tracking-wider uppercase" />
                    <ProductCard.Price className="mt-1.5" />
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* Editorial Banner */}
      {editorialEnabled && (
      <section className="relative overflow-hidden" style={{ minHeight: `${editorial.min_height || 50}vh`, minBlockSize: '350px' }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: editorial.background_image
              ? `url(${editorial.background_image})`
              : 'url(https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80)',
            opacity: 1 - (editorial.overlay_opacity || 40) / 100,
          }}
        />
        <div className="absolute inset-0 bg-gray-900" style={{ opacity: (editorial.overlay_opacity || 40) / 100 }} />
        <div className="relative z-10 h-full flex items-center justify-center text-center" style={{ minHeight: `${editorial.min_height || 50}vh` }}>
          <div>
            <span className="text-white/60 text-xs tracking-[0.3em] uppercase block mb-3">
              {editorial.section_label || 'The Art of'}
            </span>
            <h2 className="text-white text-4xl md:text-5xl font-light mb-4" style={{ fontFamily: 'var(--font-family-heading, "Playfair Display", serif)' }}>
              {editorial.heading || 'Effortless Style'}
            </h2>
            <Link to={editorial.button_url || '/products'} className="inline-block border border-white/40 text-white px-8 py-3 text-xs tracking-[0.2em] uppercase hover:bg-white hover:text-gray-900 transition-all duration-300">
              {editorial.button_text || 'Discover More'}
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* New Arrivals Carousel */}
      {arrivalsEnabled && !newLoading && newArrivals.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-10">
            <span className="text-xs tracking-[0.3em] uppercase text-gray-400 block mb-2">Just In</span>
            <h2 className="text-3xl font-light" style={{ fontFamily: 'var(--font-family-heading, "Playfair Display", serif)' }}>
              {arrivals.heading || 'New Arrivals'}
            </h2>
          </div>
          <Carousel slidesPerView={3} gap={24} showArrows showDots={false} loop>
            {newArrivals.map(product => (
              <ProductCard key={product._id} product={product} onQuickView={setQuickViewProduct}>
                <ProductCard.Image showBadge showQuickView aspectRatio="aspect-[3/4]" />
                <ProductCard.Body className="p-4">
                  <ProductCard.Title className="text-xs tracking-wider uppercase" />
                  <ProductCard.Price className="mt-1" />
                </ProductCard.Body>
              </ProductCard>
            ))}
          </Carousel>
        </section>
      )}

      {/* Trust bar */}
      {trustBarEnabled && trustBar.show_section !== false && (
        <section className="border-t border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {trustBarBlocks.map((block) => (
              <div key={block.id}>
                <h4 className="text-xs tracking-[0.15em] uppercase font-medium mb-1">{block.settings.title}</h4>
                <p className="text-xs text-gray-500">{block.settings.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <MerchantSections template="index" excludeIds={HARDCODED_IDS} onQuickView={setQuickViewProduct} />

      <QuickView product={quickViewProduct} isOpen={!!quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
};

export default Home;
