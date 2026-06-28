import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionEnabled, useSectionBlocks } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories } from '@shared/hooks/useProducts';
import { ProductCard } from '@shared/components/commerce/ProductCard';
import { ProductRail } from '@shared/components/commerce/ProductRail';
import KidsHero from '../components/KidsHero';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { QuickView } from '@shared/components/discovery/QuickView';
import { MerchantSections } from '@shared/theme/SectionRenderer';
import { useIntersectionObserver } from '@shared/hooks/useIntersectionObserver';
import type { Product } from '@shared/types/commerce';

const HARDCODED_IDS = ['hero', 'categories', 'shop-by-age', 'trust-badges', 'featured-products', 'new-arrivals', 'newsletter'];

// Visual color palettes cycled across merchant-editable blocks. These
// are theme-local — merchants edit the text content via the manifest's
// block schema; the color bands stay hardcoded so the playful kid look
// is consistent regardless of what merchants type.
const AGE_COLORS = [
  { color: 'from-pink-200 to-pink-300', text: 'text-pink-700' },
  { color: 'from-yellow-200 to-yellow-300', text: 'text-yellow-700' },
  { color: 'from-green-200 to-green-300', text: 'text-green-700' },
  { color: 'from-blue-200 to-blue-300', text: 'text-blue-700' },
  { color: 'from-purple-200 to-purple-300', text: 'text-purple-700' },
];

const CATEGORY_BUBBLE_COLORS = [
  { bg: 'bg-red-100 hover:bg-red-200', letterColor: 'text-red-600' },
  { bg: 'bg-blue-100 hover:bg-blue-200', letterColor: 'text-blue-600' },
  { bg: 'bg-pink-100 hover:bg-pink-200', letterColor: 'text-pink-600' },
  { bg: 'bg-green-100 hover:bg-green-200', letterColor: 'text-green-600' },
  { bg: 'bg-yellow-100 hover:bg-yellow-200', letterColor: 'text-yellow-600' },
  { bg: 'bg-purple-100 hover:bg-purple-200', letterColor: 'text-purple-600' },
];

// Map the block's `icon` key to its SVG. Merchants edit the key in the
// dashboard; unknown keys fall back to the shield so the layout never
// renders an empty slot.
function renderKidsBadgeIcon(icon: string): React.ReactNode {
  switch (icon) {
    case 'star':
      return (
        <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      );
    case 'book':
      return (
        <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      );
    case 'truck':
      return (
        <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      );
    case 'shield':
    default:
      return (
        <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      );
  }
}

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);

  // Section settings from manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const cats = useThemeSettings('categories');
  const trust = useThemeSettings('trust-badges');
  const trustBlocks = useSectionBlocks('trust-badges');
  const age = useThemeSettings('shop-by-age');
  const ageBlocks = useSectionBlocks('shop-by-age');
  const catBlocks = useSectionBlocks('categories');
  const feat = useThemeSettings('featured-products');
  const arrivals = useThemeSettings('new-arrivals');
  const newsletter = useThemeSettings('newsletter');

  // Section visibility
  const heroEnabled = useSectionEnabled('hero');
  const catsEnabled = useSectionEnabled('categories');
  const ageEnabled = useSectionEnabled('shop-by-age');
  const trustEnabled = useSectionEnabled('trust-badges');
  const featEnabled = useSectionEnabled('featured-products');
  const arrivalsEnabled = useSectionEnabled('new-arrivals');
  const newsletterEnabled = useSectionEnabled('newsletter');

  const { products: featured, loading } = useFeaturedProducts(feat.product_limit || 8);
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const categoriesRef = useRef<HTMLDivElement>(null);
  const trustRef = useRef<HTMLDivElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const categoriesVisible = useIntersectionObserver(categoriesRef, { threshold: 0.1 });
  const trustVisible = useIntersectionObserver(trustRef, { threshold: 0.1 });
  const featuredVisible = useIntersectionObserver(featuredRef, { threshold: 0.1 });
  const carouselVisible = useIntersectionObserver(carouselRef, { threshold: 0.1 });
  const ctaVisible = useIntersectionObserver(ctaRef, { threshold: 0.2 });

  return (
    <div>
      {/* Hero — bespoke playful toy-store hero (reads the same hero.* settings
          + i18n keys internally; we pass the featured toy image for the bubble,
          gated on a merchant background image exactly as before). */}
      {heroEnabled && (
        <KidsHero
          media={!hero.background_image ? featured?.find((p) => p.images?.[0])?.images?.[0] : undefined}
        />
      )}

      {/* Colorful Category Bubbles */}
      {catsEnabled && (
      <section
        ref={categoriesRef}
        className={`max-w-7xl mx-auto px-4 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
          categoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-2xl font-extrabold text-center mb-2">
          <span className="text-[#ec4899]">{cats.heading_highlight || t('theme.section.categories.heading_highlight')}</span>{' '}
          {(cats.heading || t('theme.section.categories.title')).replace(cats.heading_highlight || t('theme.section.categories.heading_highlight'), '').trim() || t('theme.section.categories.heading_suffix')}
        </h2>
        <p className="text-gray-500 text-center mb-10 text-sm">
          {cats.subheading || t('theme.section.categories.subtitle')}
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {(categories.length > 0
            ? categories.slice(0, cats.max_categories || 6).map((c, i) => ({
                key: c._id,
                href: `/categories/${c.slug}`,
                name: c.name,
                letter: (c.name?.[0] || '?').toUpperCase(),
                ...CATEGORY_BUBBLE_COLORS[i % CATEGORY_BUBBLE_COLORS.length],
              }))
            : catBlocks.slice(0, cats.max_categories || 6).map((b, i) => ({
                key: b.id,
                href: '/products',
                name: b.settings.name as string,
                letter: String(b.settings.letter || 'A').toUpperCase(),
                ...CATEGORY_BUBBLE_COLORS[i % CATEGORY_BUBBLE_COLORS.length],
              }))
          ).map((bubble) => (
            <Link
              key={bubble.key}
              to={bubble.href}
              className={`group flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300 hover:scale-105 ${bubble.bg}`}
            >
              <span className={`w-12 h-12 flex items-center justify-center rounded-full bg-white/60 text-xl font-extrabold ${bubble.letterColor}`}>
                {bubble.letter}
              </span>
              <span className="text-xs font-bold text-gray-700 text-center">
                {bubble.name}
              </span>
            </Link>
          ))}
        </div>
      </section>
      )}

      {/* Shop by Age — toy-store-specific category-by-age picker */}
      {ageEnabled !== false && (
        <section className="max-w-7xl mx-auto px-4 pb-8">
          <h2 className="text-2xl font-extrabold text-center mb-2">
            {(age.heading || t('theme.section.shop_by_age.title')).replace(age.heading_highlight || t('theme.section.shop_by_age.heading_highlight'), '').trim() || t('theme.section.shop_by_age.heading_prefix')}{' '}
            <span className="text-[#8b5cf6]">{age.heading_highlight || t('theme.section.shop_by_age.heading_highlight')}</span>
          </h2>
          <p className="text-gray-500 text-center mb-8 text-sm">{age.subheading || t('theme.section.shop_by_age.subtitle')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {ageBlocks.map((block, i) => {
              const palette = AGE_COLORS[i % AGE_COLORS.length];
              const label = String(block.settings.label || '');
              return (
                <Link
                  key={block.id}
                  to={`/products?age=${encodeURIComponent(label)}`}
                  className={`group flex flex-col items-center justify-center gap-2 p-5 rounded-3xl bg-gradient-to-br ${palette.color} hover:scale-105 transition-transform shadow-sm hover:shadow-md`}
                >
                  <span className="text-4xl group-hover:scale-110 transition-transform">{block.settings.emoji}</span>
                  <span className={`text-2xl font-extrabold ${palette.text}`}>{label}</span>
                  <span className="text-xs font-bold text-gray-700 text-center">{block.settings.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Trust Badges */}
      {trustEnabled && trust.show_section !== false && (
        <section
          ref={trustRef}
          className={`max-w-7xl mx-auto px-4 pb-12 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
            trustVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {trustBlocks.map((block) => (
              <div
                key={block.id}
                className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border-2 border-transparent"
                style={{ ['--hover-border' as string]: trust.highlight_color || '#fbbf24' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = trust.highlight_color || '#fbbf24')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <div className="text-[#8b5cf6] mb-2">{renderKidsBadgeIcon(block.settings.icon)}</div>
                <h3 className="font-bold text-sm">{block.settings.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{block.settings.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Featured Toys Grid */}
      {featEnabled && (
      <section
        ref={featuredRef}
        className={`bg-white py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
          featuredVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-extrabold">
                <span className="text-[#fbbf24]">★</span> {feat.heading || t('theme.section.featured_products.title')}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {feat.subheading || t('theme.section.featured_products.subtitle')}
              </p>
            </div>
            <Link
              to={feat.view_all_url || '/products'}
              className="text-[#8b5cf6] font-bold text-sm hover:underline"
            >
              {feat.view_all_text || t('theme.section.featured_products.view_all')} &rarr;
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {Array.from({ length: feat.product_limit || 8 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          ) : (
            <ProductRail columns={(Number(feat.columns) || 4) as 2 | 3 | 4 | 5}>
              {featured.map((p) => (
                <ProductCard key={p._id} product={p} onQuickView={setQuickViewProduct}>
                  <ProductCard.Image showBadge showQuickView hoverSwap />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    {feat.show_rating !== false && <ProductCard.Rating />}
                    <ProductCard.Price showCompareAt showDiscount className="mt-2" />
                    <ProductCard.Actions fullWidth className="mt-3" addToCartText={feat.add_to_cart_text || t('theme.section.featured_products.add_to_cart')} />
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </ProductRail>
          )}
        </div>
      </section>
      )}

      {/* New Adventures Rail */}
      {arrivalsEnabled && (
      <section
        ref={carouselRef}
        className={`max-w-7xl mx-auto px-4 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
          carouselVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-2xl font-extrabold mb-2">
          <span className="inline-flex items-center gap-2">
            <svg className="w-7 h-7 text-[#8b5cf6]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span className="text-[#8b5cf6]">{arrivals.heading || t('theme.section.new_arrivals.title')}</span>
          </span>
        </h2>
        <p className="text-gray-500 text-sm mb-8">
          {arrivals.subheading || t('theme.section.new_arrivals.subtitle')}
        </p>
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-56 rounded-2xl flex-shrink-0" />
            ))}
          </div>
        ) : (
          <ProductRail columns={4}>
            {featured.map((p) => (
              <ProductCard key={p._id} product={p} onQuickView={setQuickViewProduct}>
                <ProductCard.Image showBadge showQuickView hoverSwap />
                <ProductCard.Body>
                  <ProductCard.Title />
                  <ProductCard.Price showCompareAt />
                  <ProductCard.Actions addToCartText={arrivals.add_to_cart_text || t('theme.section.new_arrivals.add_to_cart')} />
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </section>
      )}

      {/* Fun CTA Section */}
      {newsletterEnabled && (
      <section
        ref={ctaRef}
        className={`py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
          ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{
          background: `linear-gradient(to right, ${newsletter.gradient_from || '#fbbf24'}, ${newsletter.gradient_via || '#ec4899'}, ${newsletter.gradient_to || '#8b5cf6'})`,
        }}
      >
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4 [text-shadow:0_1px_4px_rgba(0,0,0,0.35)]">
            {newsletter.heading || t('theme.section.newsletter.title')}
          </h2>
          <p className="text-white/95 mb-8 [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
            {newsletter.subheading || t('theme.section.newsletter.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder={newsletter.placeholder || t('theme.section.newsletter.placeholder')}
              className="flex-1 px-4 py-3 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <button
              className="px-6 py-3 rounded-full font-extrabold hover:opacity-90 transition shadow-lg"
              style={{ backgroundColor: '#ffffff', color: newsletter.button_text_color || '#ec4899' }}
            >
              {newsletter.button_text || t('theme.section.newsletter.button')}
            </button>
          </div>
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
