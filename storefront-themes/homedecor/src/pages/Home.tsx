import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useThemeSettings, useSectionEnabled, useSectionBlocks } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories } from '@shared/hooks/useProducts';
import { ProductCard } from '@shared/components/commerce/ProductCard';
import { Carousel } from '@shared/components/primitives/Carousel';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { QuickView } from '@shared/components/discovery/QuickView';
import { MerchantSections } from '@shared/theme/SectionRenderer';
import { useIntersectionObserver } from '@shared/hooks/useIntersectionObserver';
import type { Product } from '@shared/types/commerce';

const HARDCODED_IDS = ['hero', 'categories', 'featured-products', 'philosophy', 'trending-carousel', 'newsletter'];

const ROOMS = [
  { name: 'Living Room', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Bedroom', icon: 'M20 12V8a2 2 0 00-2-2H6a2 2 0 00-2 2v4m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4' },
  { name: 'Kitchen', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
  { name: 'Dining', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { name: 'Office', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { name: 'Outdoor', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
];

const Home: React.FC = () => {
  // Section settings from manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const cats = useThemeSettings('categories');
  const feat = useThemeSettings('featured-products');
  const philosophy = useThemeSettings('philosophy');
  const trending = useThemeSettings('trending-carousel');
  const news = useThemeSettings('newsletter');
  const pillarBlocks = useSectionBlocks('philosophy');

  // Section visibility
  const heroEnabled = useSectionEnabled('hero');
  const catsEnabled = useSectionEnabled('categories');
  const featEnabled = useSectionEnabled('featured-products');
  const philosophyEnabled = useSectionEnabled('philosophy');
  const trendingEnabled = useSectionEnabled('trending-carousel');
  const newsEnabled = useSectionEnabled('newsletter');

  const { products: featured, loading } = useFeaturedProducts(feat.product_limit || 9);
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const categoriesRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  const philosophyRef = useRef<HTMLDivElement>(null);
  const newsletterRef = useRef<HTMLDivElement>(null);

  const categoriesVisible = useIntersectionObserver(categoriesRef, { threshold: 0.1 });
  const productsVisible = useIntersectionObserver(productsRef, { threshold: 0.1 });
  const philosophyVisible = useIntersectionObserver(philosophyRef, { threshold: 0.1 });
  const newsletterVisible = useIntersectionObserver(newsletterRef, { threshold: 0.1 });

  const trendingLimit = trending.product_limit || 6;
  const minProductsToShow = trending.min_products_to_show || 3;

  return (
    <div>
      {/* Dark Hero with Interior Design Feel */}
      {heroEnabled && (
      <section
        className="relative py-28 px-6 overflow-hidden"
        style={{ backgroundColor: hero.background_color || '#2d2d2d' }}
      >
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-64 h-64 border border-[#d4a76a] rounded-full" />
          <div className="absolute bottom-10 right-20 w-96 h-96 border border-[#d4a76a] rounded-full" />
        </div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12 relative z-10">
          <div className="flex-1">
            <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-4">
              {hero.badge_text || 'New Collection 2026'}
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold text-white mb-6 leading-tight">
              {hero.heading_line1 || 'Design Your'}<br />{hero.heading_line2 || 'Perfect Space'}
            </h1>
            <p className="text-gray-400 mb-8 max-w-md leading-relaxed">
              {hero.subheading || 'Thoughtfully curated furniture, lighting, and accessories to transform any room into your sanctuary.'}
            </p>
            <div className="flex gap-4">
              <Link
                to={hero.primary_button_url || '/products'}
                className="inline-block bg-[#d4a76a] text-white px-8 py-3 font-medium hover:bg-[#c49a5f] transition"
              >
                {hero.primary_button_text || 'Shop Collection'}
              </Link>
              <Link
                to={hero.secondary_button_url || '/categories'}
                className="inline-block border border-gray-500 text-gray-300 px-8 py-3 font-medium hover:border-white hover:text-white transition"
              >
                {hero.secondary_button_text || 'Browse Rooms'}
              </Link>
            </div>
          </div>
          <div className="flex-1 hidden md:flex justify-center">
            <div className="w-80 h-80 bg-[#3d3d3d] rounded-lg flex items-center justify-center relative">
              <svg className="w-28 h-28 text-[#d4a76a]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[#d4a76a]/10 border border-[#d4a76a]/20 rounded-lg" />
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Shop by Room - Category Grid */}
      {catsEnabled && (
      <section
        ref={categoriesRef}
        className={`max-w-7xl mx-auto px-6 py-20 transition-all duration-700 ${categoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="text-center mb-12">
          <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-2">
            {cats.eyebrow || 'Explore'}
          </p>
          <h2 className="text-3xl font-semibold">{cats.heading || 'Shop by Room'}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {(categories.length > 0 ? categories.slice(0, cats.max_categories || 6) : ROOMS).map((item, i) => {
            const cat = categories[i];
            const room = ROOMS[i] || ROOMS[0];
            return (
              <Link
                key={cat?._id || room.name}
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
                  {cat?.name || room.name}
                </h3>
              </Link>
            );
          })}
        </div>
      </section>
      )}

      {/* Curated Picks */}
      {featEnabled && (
      <section
        ref={productsRef}
        className={`bg-white py-20 transition-all duration-700 ${productsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-2">
                {feat.eyebrow || 'Handpicked'}
              </p>
              <h2 className="text-3xl font-semibold">{feat.heading || "Editor's Picks"}</h2>
            </div>
            <Link to={feat.view_all_url || '/products'} className="text-[#d4a76a] text-sm font-medium hover:underline">
              {feat.view_all_text || 'View All'} &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-${feat.columns || '3'} gap-8`}>
              {featured.map((p) => (
                <ProductCard key={p._id} product={p} onQuickView={feat.show_quick_view !== false ? setQuickViewProduct : undefined}>
                  <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    {feat.show_rating !== false && <ProductCard.Rating />}
                    <ProductCard.Price showCompareAt />
                    <ProductCard.Actions addToCartText={feat.add_to_cart_text || 'Add to Cart'} />
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* Designed to Last - Philosophy Section */}
      {philosophyEnabled && (
      <section
        ref={philosophyRef}
        className={`py-24 transition-all duration-700 ${philosophyVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        style={{ backgroundColor: philosophy.background_color || '#f9f7f4' }}
      >
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-4">
            {philosophy.eyebrow || 'Our Philosophy'}
          </p>
          <h2 className="text-3xl font-semibold mb-6">{philosophy.heading || 'Designed to Last'}</h2>
          <p className="text-gray-500 leading-relaxed max-w-2xl mx-auto mb-10">
            {philosophy.body_text || 'We believe great design should be accessible. Every piece is crafted from quality materials, built to endure, and designed to make your space feel like home. From sustainably sourced wood to hand-finished textiles, we obsess over the details so you can enjoy them for years to come.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            {pillarBlocks.map((block) => (
              <div key={block.id} className="text-center">
                <div className="w-12 h-12 bg-[#d4a76a]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-3 h-3 bg-[#d4a76a] rounded-full" />
                </div>
                <h3 className="font-medium text-gray-800 mb-2">{block.settings.title}</h3>
                <p className="text-sm text-gray-500">{block.settings.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Inspiration Carousel */}
      {trendingEnabled && featured.length >= minProductsToShow && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-2">
                {trending.eyebrow || 'Get Inspired'}
              </p>
              <h2 className="text-3xl font-semibold">{trending.heading || 'Trending Now'}</h2>
            </div>
            <Carousel>
              {featured.slice(0, trendingLimit).map((p) => (
                <ProductCard key={p._id} product={p} onQuickView={setQuickViewProduct}>
                  <ProductCard.Image showBadge hoverSwap />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    <ProductCard.Price showCompareAt />
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </Carousel>
          </div>
        </section>
      )}

      {/* Newsletter with Gold CTA */}
      {newsEnabled && (
      <section
        ref={newsletterRef}
        className={`py-20 transition-all duration-700 ${newsletterVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        style={{ backgroundColor: news.background_color || '#2d2d2d' }}
      >
        <div className="max-w-xl mx-auto px-6 text-center">
          <p className="text-[#d4a76a] text-xs uppercase tracking-[0.3em] mb-4">
            {news.eyebrow || 'Stay Inspired'}
          </p>
          <h2 className="text-2xl font-semibold text-white mb-4">{news.heading || 'Join Our Community'}</h2>
          <p className="text-gray-400 mb-8">
            {news.subheading || 'Get early access to new collections, design tips, and exclusive offers delivered to your inbox.'}
          </p>
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder={news.placeholder || 'Your email address'}
              className="flex-1 bg-[#3d3d3d] text-white px-4 py-3 border border-gray-600 focus:border-[#d4a76a] focus:outline-none placeholder-gray-500"
            />
            <button type="submit" className="bg-[#d4a76a] text-white px-6 py-3 font-medium hover:bg-[#c49a5f] transition whitespace-nowrap">
              {news.button_text || 'Subscribe'}
            </button>
          </form>
        </div>
      </section>
      )}

      {/* QuickView Modal */}
      <MerchantSections template="index" excludeIds={HARDCODED_IDS} onQuickView={setQuickViewProduct} />

      <QuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
};

export default Home;
