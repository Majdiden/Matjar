import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionEnabled } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories, useProducts } from '@shared/hooks/useProducts';
import { ProductCard } from '@shared/components/commerce/ProductCard';
import { Hero } from '@shared/components/sections/Hero';
import { ProductRail } from '@shared/components/commerce/ProductRail';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { QuickView } from '@shared/components/discovery/QuickView';
import { MerchantSections } from '@shared/theme/SectionRenderer';
import { useIntersectionObserver } from '@shared/hooks/useIntersectionObserver';
import type { Product } from '@shared/types/commerce';

// Niche default hero image — a high-energy athletic action shot — so the
// hero is never empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1600&q=80&auto=format&fit=crop';

const HARDCODED_IDS = ['hero', 'categories', 'featured-products', 'cta-banner', 'performance-gear', 'trust-badges'];

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);

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
  // Strings are resolved via t() so they work in both EN and AR
  const defaultBadges = [
    { title: t('theme.section.trust_badges.free_returns.title'), desc: t('theme.section.trust_badges.free_returns.description'), icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" /></svg>
    )},
    { title: t('theme.section.trust_badges.pro_gear.title'), desc: t('theme.section.trust_badges.pro_gear.description'), icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
    )},
    { title: t('theme.section.trust_badges.fast_delivery.title'), desc: t('theme.section.trust_badges.fast_delivery.description'), icon: (
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
          title: b.settings?.title || t('theme.section.trust_badges.default_title'),
          desc: b.settings?.description || '',
          icon: iconMap[b.settings?.icon] ?? iconMap.lightning,
        }))
      : defaultBadges;

  const ctaBgColor = cta.background_color || '#dc2626';
  const ctaBtnBg = cta.button_bg_color || '#ffffff';
  const ctaBtnTextColor = cta.button_text_color || '#dc2626';

  return (
    <div>
      {/* Hero — shared imagery-forward hero (athletic full-bleed editorial) */}
      {heroEnabled && (
        <Hero
          variant="editorial"
          title={`${hero.heading_line1 || t('theme.hero.main.headline_line1')} ${hero.heading_line2 || t('theme.hero.main.headline_line2')}`}
          subtitle={hero.subheading || t('theme.hero.main.subheadline')}
          primaryCta={{ label: hero.primary_button_text || t('theme.hero.main.cta_primary'), href: hero.primary_button_url || '/products' }}
          secondaryCta={{ label: hero.secondary_button_text || t('theme.hero.main.cta_secondary'), href: hero.secondary_button_url || '/categories' }}
          saleText={hero.eyebrow_text || t('theme.hero.main.eyebrow')}
          backgroundImage={hero.background_image || undefined}
          overlayOpacity={hero.overlay_opacity || undefined}
          media={featured?.find((p) => p.images?.[0])?.images?.[0]}
          defaultImage={HERO_DEFAULT_IMAGE}
        />
      )}

      {/* Categories with action-shot overlays */}
      {catsEnabled && categories.length > 0 && (
        <section
          ref={categoriesObserver.ref as React.RefObject<HTMLElement>}
          className={`max-w-7xl mx-auto px-4 py-14 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${categoriesObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h2 className="text-2xl font-black uppercase mb-8">{cats.heading || t('theme.section.categories.title')}</h2>
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
                <div className="absolute bottom-0 start-0 p-4">
                  <span className="text-white font-black uppercase text-sm tracking-wider">{cat.name}</span>
                  {cats.show_shop_now_label !== false && (
                    <span className="block text-red-400 text-xs font-bold uppercase mt-1 opacity-0 group-hover:opacity-100 transition">
                      {cats.shop_now_text || t('theme.section.categories.shop_now')} &rarr;
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
        className={`bg-gray-50 py-14 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${productsObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black uppercase">{feat.heading || t('theme.section.featured_products.title')}</h2>
            <Link to={feat.view_all_url || '/products'} className="text-[#dc2626] font-bold text-sm uppercase hover:underline">
              {feat.view_all_text || t('theme.section.featured_products.view_all')} &rarr;
            </Link>
          </div>
          {featuredLoading ? (
            <div className={`grid grid-cols-2 md:grid-cols-${feat.columns || '4'} gap-6`}>
              {Array.from({ length: parseInt(feat.columns) || 4 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-lg" />
              ))}
            </div>
          ) : (
            <ProductRail columns={4}>
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
                    <ProductCard.Price showCompareAt showDiscount className="mt-2" />
                    {feat.show_add_to_cart !== false && (
                      <ProductCard.Actions fullWidth className="mt-3" addToCartText={feat.add_to_cart_text || t('theme.section.featured_products.add_to_cart')} />
                    )}
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </ProductRail>
          )}
        </div>
      </section>
      )}

      {/* CTA Banner */}
      {ctaEnabled && (
      <section className="py-16 text-center px-4" style={{ backgroundColor: ctaBgColor }}>
        <h2 className="text-3xl md:text-4xl font-black uppercase text-white mb-4">
          {cta.heading || t('theme.section.cta_banner.title')}
        </h2>
        <p className="text-white mb-8 max-w-md mx-auto">
          {cta.subheading || t('theme.section.cta_banner.subtitle')}
        </p>
        <Link
          to={cta.button_url || '/products'}
          className="inline-block px-10 py-4 font-black uppercase tracking-wider hover:opacity-90 transition"
          style={{ backgroundColor: ctaBtnBg, color: ctaBtnTextColor }}
        >
          {cta.button_text || t('theme.section.cta_banner.cta')}
        </Link>
      </section>
      )}

      {/* Performance Gear Carousel */}
      {perfGearEnabled && (
      <section
        ref={carouselObserver.ref as React.RefObject<HTMLElement>}
        className={`py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${carouselObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-black uppercase mb-8">{perfGear.heading || t('theme.section.performance_gear.title')}</h2>
          {arrivalsLoading ? (
            <Skeleton className="h-72 rounded-lg" />
          ) : (
            <ProductRail columns={4}>
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
            </ProductRail>
          )}
        </div>
      </section>
      )}

      {/* Trust Badges */}
      {trustEnabled && (
      <section
        ref={trustObserver.ref as React.RefObject<HTMLElement>}
        className={`max-w-7xl mx-auto px-4 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${trustObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
