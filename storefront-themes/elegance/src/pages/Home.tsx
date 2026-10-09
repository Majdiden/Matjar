import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionBlocks, useTemplateSections } from '@matjar/theme-shared/theme/ThemeProvider';
import { DEFAULT_SECTION_REGISTRY } from '@matjar/theme-shared/components/sections';
import { useFeaturedProducts, useCategories, useProducts } from '@matjar/theme-shared/hooks/useProducts';
import { ProductCard } from '@matjar/theme-shared/components/commerce/ProductCard';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { useIntersectionObserver } from '@matjar/theme-shared/hooks/useIntersectionObserver';
import EditorialHero from '../components/EditorialHero';
import type { Product } from '@matjar/theme-shared/types/commerce';

/** Props every bespoke section gets: its instance id (settings/blocks key) and the Quick View opener. */
interface EleganceSectionProps {
  id: string;
  onQuickView: (product: Product) => void;
}

const HEADING_FONT = { fontFamily: 'var(--font-family-heading, "Playfair Display", serif)' };

// Hero — bespoke editorial full-bleed hero (reads the same hero settings +
// i18n keys this theme always fed the shared Hero)
const EleganceHero: React.FC<EleganceSectionProps> = ({ id }) => {
  const hero = useThemeSettings(id);
  const { products: featured } = useFeaturedProducts(8);
  return (
    <EditorialHero
      sectionId={id}
      media={!hero.background_image ? featured?.find((p) => p.images?.[0])?.images?.[0] : undefined}
    />
  );
};

// Collections Grid
const EleganceCollections: React.FC<EleganceSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const collections = useThemeSettings(id);
  const { categories } = useCategories();
  if (categories.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-12">
        <span className="text-xs tracking-[0.3em] uppercase text-gray-500 block mb-2">
          {collections.section_label || t('theme.section.collections.eyebrow')}
        </span>
        <h2 className="text-3xl md:text-4xl font-light" style={HEADING_FONT}>
          {collections.heading || t('theme.section.collections.heading')}
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
                <span className="text-white/70 text-xs tracking-wider group-hover:text-white transition">{t('theme.product_detail.explore')}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

// Featured Products
const EleganceFeatured: React.FC<EleganceSectionProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme']);
  const feat = useThemeSettings(id);
  const { products: featured, loading } = useFeaturedProducts(feat.product_limit || 8);
  const { ref, isIntersecting: visible } = useIntersectionObserver({ threshold: 0.1 });
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`bg-gray-50 py-20 transition-all duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs tracking-[0.3em] uppercase text-gray-500 block mb-2">
              {feat.section_label || t('theme.section.featured_products.eyebrow')}
            </span>
            <h2 className="text-3xl font-light" style={HEADING_FONT}>
              {feat.heading || t('theme.section.featured_products.heading')}
            </h2>
          </div>
          <Link to={feat.view_all_url || '/products'} className="text-xs tracking-[0.15em] uppercase text-gray-600 hover:text-gray-900 transition border-b border-gray-400 pb-0.5">{t('theme.product_detail.view_all')}</Link>
        </div>
        {loading ? <Skeleton.ProductGrid count={4} /> : (
          <ProductRail columns={4}>
            {featured.map(product => (
              <ProductCard key={product._id} product={product} onQuickView={onQuickView}>
                <ProductCard.Image showBadge showQuickView hoverSwap aspectRatio="aspect-[3/4]" />
                <ProductCard.Body className="p-4">
                  <ProductCard.Title className="text-xs tracking-wider uppercase" />
                  <ProductCard.Price showCompareAt showDiscount className="mt-1.5" />
                  <ProductCard.Actions fullWidth className="mt-3" />
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </div>
    </section>
  );
};

// Editorial Banner
const EleganceEditorialBanner: React.FC<EleganceSectionProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const editorial = useThemeSettings(id);
  return (
    <section className="relative overflow-hidden" style={{ minHeight: `${editorial.min_height || 350}px` }}>
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
      <div className="relative z-10 h-full flex items-center justify-center text-center" style={{ minHeight: `${editorial.min_height || 350}px` }}>
        <div>
          <span className="text-white/60 text-xs tracking-[0.3em] uppercase block mb-3">
            {editorial.section_label || t('theme.section.editorial_banner.eyebrow')}
          </span>
          <h2 className="text-white text-4xl md:text-5xl font-light mb-4" style={HEADING_FONT}>
            {editorial.heading || t('theme.section.editorial_banner.heading')}
          </h2>
          <Link to={editorial.button_url || '/products'} className="inline-block border border-white/40 text-white px-8 py-3 text-xs tracking-[0.2em] uppercase hover:bg-white hover:text-gray-900 transition-all duration-300">
            {editorial.button_text || t('theme.section.editorial_banner.cta')}
          </Link>
        </div>
      </div>
    </section>
  );
};

// New Arrivals Carousel
const EleganceNewArrivals: React.FC<EleganceSectionProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme']);
  const arrivals = useThemeSettings(id);
  const { products: newArrivals, loading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 6 });
  if (loading || newArrivals.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-10">
        <span className="text-xs tracking-[0.3em] uppercase text-gray-500 block mb-2">{t('theme.product_detail.just_in')}</span>
        <h2 className="text-3xl font-light" style={HEADING_FONT}>
          {arrivals.heading || t('theme.section.new_arrivals.heading')}
        </h2>
      </div>
      <ProductRail columns={3}>
        {newArrivals.map(product => (
          <ProductCard key={product._id} product={product} onQuickView={onQuickView}>
            <ProductCard.Image showBadge showQuickView aspectRatio="aspect-[3/4]" />
            <ProductCard.Body className="p-4">
              <ProductCard.Title className="text-xs tracking-wider uppercase" />
              <ProductCard.Price className="mt-1" />
              <ProductCard.Actions fullWidth className="mt-3" />
            </ProductCard.Body>
          </ProductCard>
        ))}
      </ProductRail>
    </section>
  );
};

// Trust bar
const EleganceTrustBar: React.FC<EleganceSectionProps> = ({ id }) => {
  const trustBar = useThemeSettings(id);
  const trustBarBlocks = useSectionBlocks(id);
  if (trustBar.show_section === false) return null;
  return (
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
  );
};

// Section types this theme renders with bespoke JSX, keyed by TYPE. Each
// reads its settings/blocks by the instance id, so a section the merchant
// re-adds from the advanced editor (with a fresh id) keeps its own settings.
// Anything else falls through to the shared section registry, in place.
const BESPOKE_SECTIONS: Record<string, React.FC<EleganceSectionProps>> = {
  'hero': EleganceHero,
  'collections': EleganceCollections,
  'featured-products': EleganceFeatured,
  'editorial-banner': EleganceEditorialBanner,
  'new-arrivals': EleganceNewArrivals,
  'trust-bar': EleganceTrustBar,
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

      <QuickView product={quickViewProduct} isOpen={!!quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
};

export default Home;
