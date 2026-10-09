import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useMerchantBlocks, useTemplateSections } from '@matjar/theme-shared/theme/ThemeProvider';
import { DEFAULT_SECTION_REGISTRY } from '@matjar/theme-shared/components/sections';
import { useFeaturedProducts, useCategories, useProducts } from '@matjar/theme-shared/hooks/useProducts';
import { ProductCard } from '@matjar/theme-shared/components/commerce/ProductCard';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { useIntersectionObserver } from '@matjar/theme-shared/hooks/useIntersectionObserver';
import { Hero } from '@matjar/theme-shared/components/sections/Hero';
import type { Product } from '@matjar/theme-shared/types/commerce';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { merchantImage, merchantText } from '@matjar/theme-shared/theme/heroContent';

// Niche default hero image — a warm artisan craft / maker's table shot — so
// the hero is never empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1605883705077-8d3d3cebe78c?w=1600&q=80&auto=format&fit=crop';

/** Props every bespoke section gets: its instance id (settings/blocks key) and the Quick View opener. */
interface ArtisanSectionProps {
  id: string;
  onQuickView: (product: Product) => void;
}

const ENTRANCE = 'transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))]';
const reveal = (visible: boolean) => (visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8');

// Hero — shared imagery-forward hero (warm craft split panel)
const ArtisanHero: React.FC<ArtisanSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme', 'common']);
  const hero = useThemeSettings(id);
  const { store } = useStore();
  const { products: featured, loading } = useFeaturedProducts(6);
  // Only the merchant's own content: the title falls back to the store name;
  // the second heading line, eyebrow and second button show only when set.
  const title = [merchantText(hero.heading_line1) || store?.name || '', merchantText(hero.heading_line2)].filter(Boolean).join(' ');
  const secondaryLabel = merchantText(hero.secondary_button_text);
  // Photo: the merchant's own, else a product photo; the theme's stock photo
  // only for a brand-new store with no products yet.
  const own = merchantImage(hero.background_image, store?.brand?.coverImage);
  const productPhoto = merchantImage(...(featured || []).map((p) => p.images?.[0]));
  return (
    <Hero
      variant="split"
      tone="light"
      title={title}
      subtitle={merchantText(hero.subheading) || undefined}
      primaryCta={{ label: hero.primary_button_text || t('theme.section.hero.primary_cta'), href: hero.primary_button_url || '/products' }}
      secondaryCta={secondaryLabel ? { label: secondaryLabel, href: hero.secondary_button_url || '/categories' } : undefined}
      saleText={merchantText(hero.eyebrow_text) || undefined}
      backgroundImage={own || undefined}
      media={productPhoto || undefined}
      defaultImage={!own && !productPhoto && !loading ? HERO_DEFAULT_IMAGE : undefined}
    />
  );
};

// Our Philosophy — the merchant's own words (section text, else the store
// description). No demo sourcing claims ("we partner directly with
// artisans… authentic"); nothing written → no section.
const ArtisanPhilosophy: React.FC<ArtisanSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme', 'common']);
  const philosophy = useThemeSettings(id);
  const { store } = useStore();
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  const body = merchantText(philosophy.body_text) || merchantText(store?.description);
  if (!body) return null;
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`max-w-3xl mx-auto px-6 py-20 text-center ${ENTRANCE} ${reveal(visible)}`}>
      {philosophy.show_dividers !== false && <div className="w-16 h-px bg-[var(--color-accent)] mx-auto mb-6" />}
      <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-primary)] mb-6 italic">
        {philosophy.heading || t('theme.section.philosophy.heading')}
      </h2>
      <p className="text-gray-600 leading-relaxed text-lg">
        {body}
      </p>
      {philosophy.show_dividers !== false && <div className="w-16 h-px bg-[var(--color-accent)] mx-auto mt-6" />}
    </section>
  );
};

// Featured Pieces
const ArtisanFeatured: React.FC<ArtisanSectionProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme', 'common']);
  const feat = useThemeSettings(id);
  const { products: featured, loading } = useFeaturedProducts(feat.product_limit || 6);
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`bg-white py-16 ${ENTRANCE} ${reveal(visible)}`}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold italic text-[var(--color-primary)] mb-2">{feat.heading || t('theme.section.featured_products.heading')}</h2>
          {feat.subheading && <p className="text-gray-500">{feat.subheading}</p>}
        </div>
        {loading ? (
          <Skeleton.ProductGrid count={3} />
        ) : (
          <ProductRail columns={3}>
            {featured.map((product) => (
              <ProductCard key={product._id} product={product} onQuickView={feat.show_quick_view !== false ? onQuickView : undefined}>
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
  );
};

/** Demo makers this theme used to ship; sections saved back then still carry them. */
const LEGACY_DEMO_MAKERS = [
  { name: 'Maria Santos', craft: 'Ceramics', quote: 'Every piece carries the warmth of the kiln and the patience of my hands.' },
  { name: 'James Okafor', craft: 'Woodworking', quote: 'I let the grain of the wood guide each cut. Nature is my co-designer.' },
  { name: 'Aiko Tanaka', craft: 'Textiles', quote: 'Weaving connects me to generations of makers before me.' },
];

// Maker Spotlight — only makers the merchant added. The demo makers and
// their quotes are invented people, so they never show; no makers → no section.
const ArtisanSpotlight: React.FC<ArtisanSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme', 'common']);
  const spotlight = useThemeSettings(id);
  const spotlightBlocks = useMerchantBlocks(id, ['name', 'craft', 'quote'], LEGACY_DEMO_MAKERS);
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  if (spotlightBlocks.length === 0) return null;
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`bg-[var(--color-muted)]/20/30 py-16 ${ENTRANCE} ${reveal(visible)}`}>
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
                {name && <h3 className="font-bold text-[var(--color-primary)]">{name}</h3>}
                {craft && <p className="text-xs text-[var(--color-accent)] uppercase tracking-wider mb-3">{craft}</p>}
                {quote && <p className="text-sm text-gray-500 italic leading-relaxed">"{quote}"</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// Categories
const ArtisanCategories: React.FC<ArtisanSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme', 'common']);
  const cats = useThemeSettings(id);
  const { categories } = useCategories();
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  if (categories.length === 0) return null;
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`max-w-6xl mx-auto px-6 py-16 ${ENTRANCE} ${reveal(visible)}`}>
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
  );
};

// New Arrivals Carousel
const ArtisanNewArrivals: React.FC<ArtisanSectionProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme', 'common']);
  const arrivals = useThemeSettings(id);
  const { products: newArrivals, loading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 8 });
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`bg-white py-16 ${ENTRANCE} ${reveal(visible)}`}>
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
                  {arrivals.show_add_to_cart !== false && <ProductCard.Actions addToCartText={arrivals.add_to_cart_text || t('common:action.add')} />}
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </div>
    </section>
  );
};

// Newsletter CTA
const ArtisanNewsletter: React.FC<ArtisanSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme', 'common']);
  const news = useThemeSettings(id);
  return (
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
  );
};

// Section types this theme renders with bespoke JSX, keyed by TYPE. Each
// reads its settings/blocks by the instance id, so a section the merchant
// re-adds from the advanced editor (with a fresh id) keeps its own settings.
// Anything else falls through to the shared section registry, in place.
const BESPOKE_SECTIONS: Record<string, React.FC<ArtisanSectionProps>> = {
  'hero': ArtisanHero,
  'philosophy': ArtisanPhilosophy,
  'featured-products': ArtisanFeatured,
  'artisan-spotlight': ArtisanSpotlight,
  'categories': ArtisanCategories,
  'new-arrivals': ArtisanNewArrivals,
  'newsletter': ArtisanNewsletter,
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
