import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionEnabled, useSectionBlocks } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories } from '@shared/hooks/useProducts';
import { ProductCard } from '@shared/components/commerce/ProductCard';
import { Hero } from '@shared/components/sections/Hero';
import { ProductRail } from '@shared/components/commerce/ProductRail';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { QuickView } from '@shared/components/discovery/QuickView';
import { MerchantSections } from '@shared/theme/SectionRenderer';
import { useIntersectionObserver } from '@shared/hooks/useIntersectionObserver';
import type { Product } from '@shared/types/commerce';

const HARDCODED_IDS = ['hero', 'genres', 'staff-picks', 'reading-quote', 'bestsellers', 'newsletter'];

// Niche default hero image — a cozy shelf of books — so the hero is never
// empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1600&q=80&auto=format&fit=crop';

// Visual color palette cycled across genre cards. Merchants edit genre
// name + icon via the manifest `genres` block schema; the color band is
// a theme-local visual concern and stays hardcoded so the literary look
// is consistent regardless of merchant input.
const GENRE_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-rose-100 text-rose-700',
  'bg-pink-100 text-pink-700',
  'bg-stone-100 text-stone-700',
];

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);

  // Section settings from manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const genres = useThemeSettings('genres');
  const genreBlocks = useSectionBlocks('genres');
  const staffPicks = useThemeSettings('staff-picks');
  const quote = useThemeSettings('reading-quote');
  const bestsellers = useThemeSettings('bestsellers');
  const newsletter = useThemeSettings('newsletter');

  // Section visibility
  const heroEnabled = useSectionEnabled('hero');
  const genresEnabled = useSectionEnabled('genres');
  const staffPicksEnabled = useSectionEnabled('staff-picks');
  const quoteEnabled = useSectionEnabled('reading-quote');
  const bestsellersEnabled = useSectionEnabled('bestsellers');
  const newsletterEnabled = useSectionEnabled('newsletter');

  const { products: featured, loading } = useFeaturedProducts(bestsellers.product_limit || 9);
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const genresRef = useRef<HTMLDivElement>(null);
  const staffPicksRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);
  const bestsellersRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const genresVisible = useIntersectionObserver(genresRef, { threshold: 0.1 });
  const staffPicksVisible = useIntersectionObserver(staffPicksRef, { threshold: 0.1 });
  const quoteVisible = useIntersectionObserver(quoteRef, { threshold: 0.2 });
  const bestsellersVisible = useIntersectionObserver(bestsellersRef, { threshold: 0.1 });
  const ctaVisible = useIntersectionObserver(ctaRef, { threshold: 0.2 });

  const staffPickProducts = featured.slice(0, staffPicks.product_limit || 6);
  const bestsellerProducts = featured.slice(0, bestsellers.product_limit || 9);

  return (
    <div>
      {/* Hero — bespoke literary "reading nook" hero. Reads the same hero.*
          settings + i18n keys internally; a featured book cover is passed in
          as the standing-cover showcase. */}
      {heroEnabled && (
        <Hero
          variant="spotlight"
          tone="dark"
          title={`${hero.heading_line1 || t('theme.section.hero.heading_line1')} ${hero.heading_line2 || t('theme.section.hero.heading_line2')}`}
          subtitle={hero.subheading || t('theme.section.hero.subheading')}
          primaryCta={{ label: hero.button_text || t('theme.section.hero.cta'), href: hero.button_url || '/products' }}
          backgroundImage={hero.background_image || undefined}
          media={featured?.find((p) => p.images?.[0])?.images?.[0]}
          defaultImage={HERO_DEFAULT_IMAGE}
        />
      )}

      {/* Genre Cards */}
      {genresEnabled && (
      <section
        ref={genresRef}
        className={`max-w-6xl mx-auto px-6 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
          genresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-2xl font-bold text-center mb-2">
          {genres.heading || t('theme.section.genres.heading')}
        </h2>
        <p className="text-gray-500 text-center mb-10 text-sm">
          {genres.subheading || t('theme.section.genres.subheading')}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {(categories.length > 0
            ? categories.slice(0, genres.max_categories || 6).map((c, i) => ({
                key: c._id,
                href: `/categories/${c.slug}`,
                name: c.name,
                icon: (c.name || '?').charAt(0).toUpperCase(),
                color: GENRE_COLORS[i % GENRE_COLORS.length],
              }))
            : genreBlocks.slice(0, genres.max_categories || 6).map((b, i) => ({
                key: b.id,
                href: '/products',
                name: b.settings.name as string,
                icon: b.settings.icon as string,
                color: GENRE_COLORS[i % GENRE_COLORS.length],
              }))
          ).map((g) => (
            <Link
              key={g.key}
              to={g.href}
              className={`group rounded-xl p-5 text-center border border-violet-100 hover:border-[#7c3aed] hover:shadow-lg transition-all duration-300 ${g.color}`}
            >
              <span className="text-xl font-bold block mb-2 w-10 h-10 rounded-full flex items-center justify-center mx-auto border-2 border-current opacity-60">{g.icon}</span>
              <h3 className="font-semibold text-sm group-hover:text-[#7c3aed] transition">
                {g.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>
      )}

      {/* Staff Picks */}
      {staffPicksEnabled && (
      <section
        ref={staffPicksRef}
        className={`bg-white py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
          staffPicksVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-bold">{staffPicks.heading || t('theme.section.staff_picks.heading')}</h2>
              <p className="text-gray-500 text-sm mt-1">
                {staffPicks.subheading || t('theme.section.staff_picks.subheading')}
              </p>
            </div>
            <Link
              to={staffPicks.view_all_url || '/products'}
              className="text-[#7c3aed] font-semibold text-sm hover:underline"
            >
              {staffPicks.view_all_text || t('theme.section.staff_picks.see_all')} &rarr;
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {Array.from({ length: staffPicks.product_limit || 6 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-xl" />
              ))}
            </div>
          ) : (
            <ProductRail columns={(Number(staffPicks.columns) || 3) as 2 | 3 | 4 | 5}>
              {staffPickProducts.map((p) => (
                <ProductCard key={p._id} product={p} onQuickView={setQuickViewProduct}>
                  <ProductCard.Image showBadge showQuickView hoverSwap />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    {staffPicks.show_rating !== false && <ProductCard.Rating />}
                    <ProductCard.Price showCompareAt showDiscount className="mt-2" />
                    <ProductCard.Actions fullWidth className="mt-3" addToCartText={staffPicks.add_to_cart_text || t('theme.section.staff_picks.add_to_shelf')} />
                  </ProductCard.Body>
                </ProductCard>
              ))}
            </ProductRail>
          )}
        </div>
      </section>
      )}

      {/* Reading Quote */}
      {quoteEnabled && (
      <section
        ref={quoteRef}
        className={`py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
          quoteVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{ backgroundColor: quote.background_color || '#ede9fe' }}
      >
        <div className="max-w-2xl mx-auto px-6 text-center">
          <svg className="w-10 h-10 mx-auto mb-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <blockquote className="text-2xl italic text-gray-700 mb-4 leading-relaxed">
            &ldquo;{quote.quote_text || t('theme.section.reading_quote.text')}&rdquo;
          </blockquote>
          <p className="text-sm text-gray-600 font-medium">&mdash; {quote.quote_author || t('theme.section.reading_quote.author')}</p>
        </div>
      </section>
      )}

      {/* Bestsellers Carousel */}
      {bestsellersEnabled && (
      <section
        ref={bestsellersRef}
        className={`max-w-6xl mx-auto px-6 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
          bestsellersVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-2xl font-bold mb-2">{bestsellers.heading || t('theme.section.bestsellers.heading')}</h2>
        <p className="text-gray-500 text-sm mb-8">
          {bestsellers.subheading || t('theme.section.bestsellers.subheading')}
        </p>
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-56 rounded-xl flex-shrink-0" />
            ))}
          </div>
        ) : (
          <ProductRail columns={4}>
            {bestsellerProducts.map((p) => (
              <ProductCard key={p._id} product={p} onQuickView={setQuickViewProduct}>
                <ProductCard.Image showBadge showQuickView hoverSwap />
                <ProductCard.Body>
                  <ProductCard.Title />
                  <ProductCard.Price showCompareAt />
                  <ProductCard.Actions addToCartText={bestsellers.add_to_cart_text || t('theme.section.bestsellers.add')} />
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </section>
      )}

      {/* Reading List CTA */}
      {newsletterEnabled && (
      <section
        ref={ctaRef}
        className={`py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${
          ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{
          background: `linear-gradient(to right, ${newsletter.gradient_from || '#7c3aed'}, ${newsletter.gradient_to || '#4c1d95'})`,
        }}
      >
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {newsletter.heading || t('theme.section.newsletter.heading')}
          </h2>
          <p className="text-violet-200 mb-8">
            {newsletter.subheading || t('theme.section.newsletter.subheading')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder={newsletter.placeholder || t('theme.section.newsletter.placeholder')}
              className="flex-1 px-4 py-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <button className="bg-white text-[#7c3aed] px-6 py-3 rounded-lg font-semibold hover:bg-violet-50 transition">
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
