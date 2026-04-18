import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useThemeSettings, useSectionEnabled } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories, useProducts } from '@shared/hooks/useProducts';
import { ProductCard } from '@shared/components/commerce/ProductCard';
import { Carousel } from '@shared/components/primitives/Carousel';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { QuickView } from '@shared/components/discovery/QuickView';
import { MerchantSections } from '@shared/theme/SectionRenderer';
import { useIntersectionObserver } from '@shared/hooks/useIntersectionObserver';
import type { Product } from '@shared/types/commerce';

const HARDCODED_IDS = ['hero', 'categories', 'featured-products', 'cta-banner', 'performance-gear', 'trust-badges'];

const Home: React.FC = () => {
  const { store } = useStore();

  // Read section settings from the manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const cats = useThemeSettings('categories');
  const feat = useThemeSettings('featured-products');
  const cta = useThemeSettings('cta-banner');
  const perfGear = useThemeSettings('performance-gear');
  const trust = useThemeSettings('trust-badges');

  // Section visibility
  const heroEnabled = useSectionEnabled('hero');
  const catsEnabled = useSectionEnabled('categories');
  const featEnabled = useSectionEnabled('featured-products');
  const ctaEnabled = useSectionEnabled('cta-banner');
  const perfGearEnabled = useSectionEnabled('performance-gear');
  const trustEnabled = useSectionEnabled('trust-badges');

  const { products: featured, loading: featuredLoading } = useFeaturedProducts(feat.product_limit || 8);
  const { products: perfProducts, loading: arrivalsLoading } = useProducts({ sort: 'newest', limit: perfGear.product_limit || 8 });
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const categoriesObserver = useIntersectionObserver({ threshold: 0.1 });
  const productsObserver = useIntersectionObserver({ threshold: 0.1 });
  const carouselObserver = useIntersectionObserver({ threshold: 0.1 });
  const trustObserver = useIntersectionObserver({ threshold: 0.1 });

  // Default trust badge blocks — overridden by manifest blocks when available
  const defaultBadges = [
    { title: 'Free Returns', desc: '30-day no-questions-asked returns', icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" /></svg>
    )},
    { title: 'Pro Gear', desc: 'Used by professional athletes worldwide', icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
    )},
    { title: 'Fast Delivery', desc: 'Express shipping on all orders', icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    )},
  ];

  // Icon map for trust-badges blocks
  const iconMap: Record<string, React.ReactNode> = {
    returns: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" /></svg>,
    pro: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
    lightning: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  };

  const trustBlocks: Array<{ title: string; desc: string; icon: React.ReactNode }> =
    Array.isArray(trust.blocks) && trust.blocks.length > 0
      ? trust.blocks.map((b: any) => ({
          title: b.settings?.title || 'Trust Badge',
          desc: b.settings?.description || '',
          icon: iconMap[b.settings?.icon] ?? iconMap.lightning,
        }))
      : defaultBadges;

  const heroBgColor = hero.background_color || '#111827';
  const ctaBgColor = cta.background_color || '#dc2626';
  const ctaBtnBg = cta.button_bg_color || '#ffffff';
  const ctaBtnTextColor = cta.button_text_color || '#dc2626';

  return (
    <div>
      {/* Hero - full bleed dark */}
      {heroEnabled && (
      <section
        className="relative py-24 px-4 overflow-hidden"
        style={{
          background: hero.background_image
            ? `url(${hero.background_image}) center/cover`
            : heroBgColor,
        }}
      >
        {/* Diagonal accent line */}
        {hero.show_diagonal_accent !== false && (
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#dc2626]/10 to-transparent" />
        )}
        {hero.show_bottom_bar !== false && (
          <div className="absolute bottom-0 left-0 w-64 h-1 bg-[#dc2626]" />
        )}
        <div className="max-w-7xl mx-auto text-center relative z-10">
          {hero.eyebrow_text && (
            <p className="text-[#dc2626] font-black uppercase text-sm tracking-[0.3em] mb-4">
              {hero.eyebrow_text}
            </p>
          )}
          <h1 className="text-5xl md:text-7xl font-black uppercase text-white mb-6 leading-none">
            {hero.heading_line1 || 'Push Your'}<br />
            <span className="text-[#dc2626]">{hero.heading_line2 || 'Limits'}</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-lg mx-auto">
            {hero.subheading || 'Performance gear for athletes who demand the best. Train harder, go further.'}
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to={hero.primary_button_url || '/products'}
              className="inline-block bg-[#dc2626] text-white px-10 py-4 font-black uppercase tracking-wider hover:bg-[#b91c1c] transition"
            >
              {hero.primary_button_text || 'Shop Now'}
            </Link>
            <Link
              to={hero.secondary_button_url || '/products'}
              className="inline-block border-2 border-white/20 text-white px-10 py-4 font-black uppercase tracking-wider hover:border-[#dc2626] hover:text-[#dc2626] transition"
            >
              {hero.secondary_button_text || 'Browse All'}
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Categories with action-shot overlays */}
      {catsEnabled && categories.length > 0 && (
        <section
          ref={categoriesObserver.ref as React.RefObject<HTMLElement>}
          className={`max-w-7xl mx-auto px-4 py-14 transition-all duration-700 ${categoriesObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h2 className="text-2xl font-black uppercase mb-8">{cats.heading || 'Shop by Sport'}</h2>
          <div className={`grid grid-cols-2 md:grid-cols-${cats.columns || '4'} gap-4`}>
            {categories.slice(0, cats.max_categories || 4).map((cat) => (
              <Link
                key={cat._id}
                to={`/categories/${cat.slug}`}
                className="group relative bg-gray-900 rounded overflow-hidden"
                style={{ height: `${cats.card_height || 192}px` }}
              >
                {cat.image && <img src={cat.image} alt={cat.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-500" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#dc2626] transition-all duration-300 rounded" />
                <div className="absolute bottom-0 left-0 p-4">
                  <span className="text-white font-black uppercase text-sm tracking-wider">{cat.name}</span>
                  {cats.show_shop_now_label !== false && (
                    <span className="block text-[#dc2626] text-xs font-bold uppercase mt-1 opacity-0 group-hover:opacity-100 transition">
                      {cats.shop_now_text || 'Shop Now'} &rarr;
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products - bold grid */}
      {featEnabled && (
      <section
        ref={productsObserver.ref as React.RefObject<HTMLElement>}
        className={`bg-gray-50 py-14 transition-all duration-700 ${productsObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black uppercase">{feat.heading || 'Top Picks'}</h2>
            <Link to={feat.view_all_url || '/products'} className="text-[#dc2626] font-bold text-sm uppercase hover:underline">
              {feat.view_all_text || 'View All'} &rarr;
            </Link>
          </div>
          {featuredLoading ? (
            <div className={`grid grid-cols-2 md:grid-cols-${feat.columns || '4'} gap-6`}>
              {Array.from({ length: parseInt(feat.columns) || 4 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className={`grid grid-cols-2 md:grid-cols-${feat.columns || '4'} gap-6`}>
              {featured.map((p) => (
                <ProductCard
                  key={p._id}
                  product={p}
                  onQuickView={feat.show_quick_view !== false ? setQuickViewProduct : undefined}
                  className="border-gray-200 hover:border-[#dc2626]/40"
                >
                  <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    {feat.show_rating !== false && <ProductCard.Rating />}
                    <ProductCard.Price showCompareAt />
                    {feat.show_add_to_cart !== false && (
                      <ProductCard.Actions addToCartText={feat.add_to_cart_text || 'Add to Cart'} />
                    )}
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* CTA Banner */}
      {ctaEnabled && (
      <section className="py-16 text-center px-4" style={{ backgroundColor: ctaBgColor }}>
        <h2 className="text-3xl md:text-4xl font-black uppercase text-white mb-4">
          {cta.heading || 'Ready to Perform?'}
        </h2>
        <p className="text-red-100 mb-8 max-w-md mx-auto">
          {cta.subheading || 'Free shipping on all orders over $75. No excuses.'}
        </p>
        <Link
          to={cta.button_url || '/products'}
          className="inline-block px-10 py-4 font-black uppercase tracking-wider hover:opacity-90 transition"
          style={{ backgroundColor: ctaBtnBg, color: ctaBtnTextColor }}
        >
          {cta.button_text || 'Get Started'}
        </Link>
      </section>
      )}

      {/* Performance Gear Carousel */}
      {perfGearEnabled && (
      <section
        ref={carouselObserver.ref as React.RefObject<HTMLElement>}
        className={`py-16 transition-all duration-700 ${carouselObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-black uppercase mb-8">{perfGear.heading || 'Performance Gear'}</h2>
          {arrivalsLoading ? (
            <Skeleton className="h-72 rounded-lg" />
          ) : (
            <Carousel
              slidesPerView={perfGear.slides_per_view || 4}
              gap={24}
              showArrows={perfGear.show_arrows !== false}
              showDots={perfGear.show_dots !== false}
              loop={perfGear.loop !== false}
              autoPlay={perfGear.autoplay !== false ? (perfGear.autoplay_interval || 5000) : undefined}
              pauseOnHover={perfGear.pause_on_hover !== false}
              arrowClassName="bg-[#dc2626] text-white"
              dotActiveClassName="bg-[#dc2626]"
            >
              {(perfProducts.length > 0 ? perfProducts : featured).map((p) => (
                <ProductCard key={p._id} product={p} onQuickView={setQuickViewProduct} className="border-gray-200 hover:border-[#dc2626]/40">
                  <ProductCard.Image showBadge showQuickView hoverSwap />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    <ProductCard.Rating />
                    <ProductCard.Price showCompareAt />
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </Carousel>
          )}
        </div>
      </section>
      )}

      {/* Trust Badges */}
      {trustEnabled && (
      <section
        ref={trustObserver.ref as React.RefObject<HTMLElement>}
        className={`max-w-7xl mx-auto px-4 py-16 transition-all duration-700 ${trustObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {trustBlocks.map((f) => (
            <div key={f.title} className="bg-white rounded-lg p-6 border-2 border-gray-100 hover:border-[#dc2626]/30 flex items-start gap-4 transition">
              <div className="text-[#dc2626] flex-shrink-0">{f.icon}</div>
              <div>
                <h3 className="font-black uppercase mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* QuickView Modal */}
      <MerchantSections template="index" excludeIds={HARDCODED_IDS} onQuickView={setQuickViewProduct} />

      <QuickView product={quickViewProduct} isOpen={!!quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
};

export default Home;
