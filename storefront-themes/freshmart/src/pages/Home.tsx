import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionBlocks, useTemplateSections } from '@matjar/theme-shared/theme/ThemeProvider';
import { DEFAULT_SECTION_REGISTRY } from '@matjar/theme-shared/components/sections';
import { useFeaturedProducts, useCategories, useProducts } from '@matjar/theme-shared/hooks/useProducts';
import { ProductCard } from '@matjar/theme-shared/components/commerce/ProductCard';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { Hero } from '@matjar/theme-shared/components/sections/Hero';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { useIntersectionObserver } from '@matjar/theme-shared/hooks/useIntersectionObserver';
import { CountdownTimer } from '@matjar/theme-shared/components/marketing/CountdownTimer';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { merchantImage, merchantText } from '@matjar/theme-shared/theme/heroContent';
import type { Product } from '@matjar/theme-shared/types/commerce';

// Niche default hero image — a bright fresh-produce shot — so the hero is
// never empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80&auto=format&fit=crop';

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


/** Props every bespoke section gets: its instance id (settings/blocks key) and the Quick View opener. */
interface FreshmartSectionProps {
  id: string;
  onQuickView: (product: Product) => void;
}

const ENTRANCE = 'transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))]';
const reveal = (visible: boolean) => (visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8');

// Hero — shared imagery-forward hero (green copy panel + produce image).
// Only the merchant's own copy: title falls back to the store name, extras
// (badge, second heading line, second button) show only when set.
const FreshmartHero: React.FC<FreshmartSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme', 'common']);
  const hero = useThemeSettings(id);
  const { store } = useStore();
  const { products: featured } = useFeaturedProducts(8);
  const title = [merchantText(hero.heading_line1) || store?.name || '', merchantText(hero.heading_line2)].filter(Boolean).join(' ');
  const secondaryText = merchantText(hero.secondary_button_text);
  return (
    <Hero
      variant="split"
      tone="dark"
      title={title}
      subtitle={merchantText(hero.subheading) || undefined}
      primaryCta={{ label: merchantText(hero.primary_button_text) || t('theme.hero.primary_cta'), href: hero.primary_button_url || '/products' }}
      secondaryCta={secondaryText ? { label: secondaryText, href: hero.secondary_button_url || '/categories' } : undefined}
      saleText={merchantText(hero.badge_text) || undefined}
      backgroundImage={merchantImage(hero.background_image) || undefined}
      media={featured?.find((p) => p.images?.[0])?.images?.[0]}
      defaultImage={HERO_DEFAULT_IMAGE}
    />
  );
};

// Categories
const FreshmartCategories: React.FC<FreshmartSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme', 'common']);
  const cats = useThemeSettings(id);
  const { categories } = useCategories();
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  if (categories.length === 0) return null;
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`max-w-7xl mx-auto px-4 py-16 ${ENTRANCE} ${reveal(visible)}`}>
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
                <span className="text-xs text-gray-400 mt-1">{t('theme.section.categories.items_count', { count: cat.productCount })}</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
};

// Weekly Deals — grocery flyer-style countdown to next Sunday
const FreshmartWeeklyDeals: React.FC<FreshmartSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme', 'common']);
  const deals = useThemeSettings(id);
  return (
    <section className="bg-gradient-to-r from-[#d97706] to-[#dc2626] py-10 px-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-white">
        <div className="flex-1 text-center md:text-start">
          <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold mb-2 backdrop-blur-sm">
            {deals.badge_label || t('theme.section.weekly_deals.badge')}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-1">{deals.heading || t('theme.section.weekly_deals.title')}</h2>
          <p className="text-white text-sm">{deals.subheading || t('theme.section.weekly_deals.subtitle')}</p>
        </div>
        <div className="flex-shrink-0">
          <CountdownTimer endDate={getNextSunday()} variant="boxes" label={t('theme.section.weekly_deals.ends_in', { defaultValue: 'Ends in' })} />
        </div>
        <Link
          to={deals.cta_url || '/products?onSale=true'}
          className="flex-shrink-0 px-6 py-3 bg-white text-[#dc2626] rounded-full font-bold hover:bg-yellow-50 transition shadow-lg"
        >
          {deals.cta_label || t('theme.section.weekly_deals.cta')}
        </Link>
      </div>
    </section>
  );
};

// Featured Products
const FreshmartFeatured: React.FC<FreshmartSectionProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme', 'common']);
  const feat = useThemeSettings(id);
  const { products: featured, loading } = useFeaturedProducts(feat.product_limit || 8);
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`bg-white py-16 ${ENTRANCE} ${reveal(visible)}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">{feat.heading || t('theme.section.featured_products.title')}</h2>
            {feat.subheading && <p className="text-gray-500 mt-1">{feat.subheading}</p>}
          </div>
          <Link to={feat.view_all_url || '/products'} className="text-[#16a34a] font-semibold text-sm hover:underline flex items-center gap-1">
            {feat.view_all_text || t('theme.section.featured_products.view_all')}
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {loading ? (
          <Skeleton.ProductGrid count={4} />
        ) : (
          <ProductRail columns={4}>
            {featured.map((product) => (
              <ProductCard key={product._id} product={product} onQuickView={feat.show_quick_view !== false ? onQuickView : undefined}>
                <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
                <ProductCard.Body>
                  <ProductCard.Title />
                  {feat.show_rating !== false && <ProductCard.Rating />}
                  <ProductCard.Price showCompareAt showDiscount className="mt-2" />
                  {feat.show_add_to_cart !== false && <ProductCard.Actions fullWidth className="mt-3" addToCartText={feat.add_to_cart_text || t('theme.section.featured_products.add_to_cart', { defaultValue: 'Add' })} />}
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </div>
    </section>
  );
};

// Trust Badges
const FreshmartTrustBadges: React.FC<FreshmartSectionProps> = ({ id }) => {
  const trust = useThemeSettings(id);
  const trustBlocks = useSectionBlocks(id);
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  if (trust.show_section === false) return null;
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`max-w-7xl mx-auto px-4 py-16 ${ENTRANCE} ${reveal(visible)}`}>
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
  );
};

// New Arrivals
const FreshmartNewArrivals: React.FC<FreshmartSectionProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme', 'common']);
  const arrivals = useThemeSettings(id);
  const { products: newArrivals, loading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 8 });
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`bg-green-50/50 py-16 ${ENTRANCE} ${reveal(visible)}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">{arrivals.heading || t('theme.section.new_arrivals.title')}</h2>
            {arrivals.subheading && <p className="text-gray-500 mt-1">{arrivals.subheading}</p>}
          </div>
          <Link to={arrivals.view_all_url || '/products?sort=newest'} className="text-[#16a34a] font-semibold text-sm hover:underline flex items-center gap-1">
            {arrivals.view_all_text || t('theme.section.new_arrivals.view_all')}
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {loading ? (
          <Skeleton.ProductGrid count={4} />
        ) : (
          <ProductRail columns={4}>
            {newArrivals.map((product) => (
              <ProductCard key={product._id} product={product} onQuickView={onQuickView}>
                <ProductCard.Image showBadge showQuickView />
                <ProductCard.Body>
                  <ProductCard.Title />
                  <ProductCard.Price />
                  {arrivals.show_add_to_cart !== false && <ProductCard.Actions addToCartText={arrivals.add_to_cart_text || t('theme.section.new_arrivals.add_to_cart', { defaultValue: 'Add to Cart' })} />}
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </div>
    </section>
  );
};

// Recipe Tips CTA / Newsletter
const FreshmartNewsletter: React.FC<FreshmartSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme', 'common']);
  const news = useThemeSettings(id);
  return (
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
  );
};

// Section types this theme renders with bespoke JSX, keyed by TYPE. Each
// reads its settings/blocks by the instance id, so a section the merchant
// re-adds from the advanced editor (with a fresh id) keeps its own settings.
// Anything else falls through to the shared section registry, in place.
const BESPOKE_SECTIONS: Record<string, React.FC<FreshmartSectionProps>> = {
  'hero': FreshmartHero,
  'categories': FreshmartCategories,
  'weekly-deals': FreshmartWeeklyDeals,
  'featured-products': FreshmartFeatured,
  'trust-badges': FreshmartTrustBadges,
  'new-arrivals': FreshmartNewArrivals,
  'newsletter': FreshmartNewsletter,
};

const Home: React.FC = () => {
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // The merchant's composed layout for the home template — ORDERED and
  // enabled-filtered (manifest default when the store has none). Rendering in
  // THIS order is what makes reordering in the editor work and keeps removed
  // sections off the page.
  const orderedSections = useTemplateSections('index');

  return (
    <div>
      {orderedSections.map((s) => {
        // `data-section-id` lets the dashboard editor scroll to / pick the
        // section; `scroll-mt-20` clears the sticky header.
        const Bespoke = BESPOKE_SECTIONS[s.type];
        if (Bespoke) {
          return (
            <div key={s.id} data-section-id={s.id} className="scroll-mt-20">
              <Bespoke id={s.id} onQuickView={setQuickViewProduct} />
            </div>
          );
        }
        const Component = DEFAULT_SECTION_REGISTRY[s.type];
        if (!Component) return null; // unknown type — silently skipped for shoppers
        return (
          <div key={s.id} data-section-id={s.id} className="scroll-mt-20">
            <Component id={s.id} section={s} onQuickView={setQuickViewProduct} />
          </div>
        );
      })}

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
