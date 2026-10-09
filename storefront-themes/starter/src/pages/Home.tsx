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
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { merchantImage, merchantText } from '@matjar/theme-shared/theme/heroContent';
import type { Product } from '@matjar/theme-shared/types/commerce';

// Niche default hero image — a clean minimal retail shot — so the hero is
// never empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80&auto=format&fit=crop';

type SectionProps = { id: string; onQuickView: (product: Product) => void };

// Each bespoke section reads its settings / blocks by its own INSTANCE id, so
// a copy added from the advanced editor keeps its own values.

/** Hero — bespoke minimal hero; the featured image fills the simple frame. */
function HeroBlock({ id }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const hero = useThemeSettings(id);
  const { store } = useStore();
  const { products: featured } = useFeaturedProducts(4);

  return (
    <Hero
      className="mb-16"
      variant="spotlight"
      tone="light"
      title={merchantText(hero.heading) || store?.name || ''}
      subtitle={merchantText(hero.subheading) || undefined}
      primaryCta={{ label: merchantText(hero.button_text) || t('theme.hero.main.cta'), href: hero.button_url || '/products' }}
      backgroundImage={merchantImage(hero.background_image) || undefined}
      media={featured?.find((p) => p.images?.[0])?.images?.[0]}
      defaultImage={HERO_DEFAULT_IMAGE}
    />
  );
}

/** Newest products, in the same clean grid as the featured products */
function NewArrivalsBlock({ id, onQuickView }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const arrivals = useThemeSettings(id);
  const { products: newArrivals, loading: newLoading } = useProducts({ sort: 'newest', limit: arrivals.product_limit || 6 });

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{
              color: 'var(--color-foreground)',
              fontFamily: 'var(--font-family-heading)',
            }}
          >
            {arrivals.heading || t('theme.section.new_arrivals.title')}
          </h2>
          {arrivals.subheading && (
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>{arrivals.subheading}</p>
          )}
        </div>
        <Link
          to={arrivals.view_all_url || '/products?sort=newest'}
          className="text-sm transition hover:opacity-80"
          style={{ color: 'var(--color-muted)' }}
        >
          {t('theme.section.new_arrivals.view_all')}
        </Link>
      </div>

      {newLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : (
        <ProductRail columns={3}>
          {newArrivals.map((p) => (
            <ProductCard key={p._id} product={p} onQuickView={onQuickView}>
              <ProductCard.Image showBadge showQuickView hoverSwap />
              <ProductCard.Body>
                <ProductCard.Title />
                <ProductCard.Price showCompareAt className="mt-2" />
                {arrivals.show_add_to_cart !== false && (
                  <ProductCard.Actions fullWidth className="mt-3" addToCartText={t('theme.section.featured_products.add_to_cart')} />
                )}
              </ProductCard.Body>
            </ProductCard>
          ))}
        </ProductRail>
      )}
    </section>
  );
}

/** Categories as Text Links */
function CategoriesBlock({ id }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const catsSettings = useThemeSettings(id);
  const { categories } = useCategories();
  if (categories.length === 0) return null;

  return (
    <section className="mb-16">
      <h2
        className="text-lg font-semibold mb-4"
        style={{
          color: 'var(--color-foreground)',
          fontFamily: 'var(--font-family-heading)',
        }}
      >
        {catsSettings.heading || t('theme.section.categories.title')}
      </h2>
      <div className="flex flex-wrap gap-3">
        {categories.slice(0, catsSettings.max_categories || 12).map((cat) => (
          <Link
            key={cat._id}
            to={`/categories/${cat.slug}`}
            className="px-4 py-2 border rounded-lg text-sm transition hover:opacity-80"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-muted)',
            }}
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Clean Product Grid */
function FeaturedBlock({ id, onQuickView }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const feat = useThemeSettings(id);
  const { products: featured, loading } = useFeaturedProducts(feat.product_limit || 6);
  const { ref: productsRef, isIntersecting: productsVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section
      ref={productsRef as React.RefObject<HTMLElement>}
      className={`mb-16 transition-all duration-500 ${productsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-lg font-semibold"
          style={{
            color: 'var(--color-foreground)',
            fontFamily: 'var(--font-family-heading)',
          }}
        >
          {feat.heading || t('theme.section.featured_products.title')}
        </h2>
        <Link
          to={feat.view_all_url || '/products'}
          className="text-sm transition hover:opacity-80"
          style={{ color: 'var(--color-muted)' }}
        >
          {feat.view_all_text || t('theme.section.featured_products.view_all')}
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : (
        <ProductRail columns={3}>
          {featured.map((p) => (
            <ProductCard key={p._id} product={p} onQuickView={feat.show_quick_view !== false ? onQuickView : undefined}>
              <ProductCard.Image showBadge showQuickView={feat.show_quick_view !== false} hoverSwap />
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
    </section>
  );
}

/** Minimal Features */
function TrustBadgesBlock({ id }: SectionProps) {
  const trustBadgeBlocks = useSectionBlocks(id);
  if (trustBadgeBlocks.length === 0) return null;

  return (
    <section className="mb-16 py-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        {trustBadgeBlocks.map((block) => (
          <div key={block.id}>
            <h3
              className="font-medium mb-1"
              style={{
                color: 'var(--color-foreground)',
                fontFamily: 'var(--font-family-heading)',
              }}
            >
              {block.settings.title}
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{block.settings.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Simple Newsletter */
function NewsletterBlock({ id }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const news = useThemeSettings(id);

  return (
    <section className="text-center py-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <h2
        className="text-lg font-semibold mb-2"
        style={{
          color: 'var(--color-foreground)',
          fontFamily: 'var(--font-family-heading)',
        }}
      >
        {news.heading || t('theme.section.newsletter.title')}
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
        {news.subheading || t('theme.section.newsletter.subtitle')}
      </p>
      <form onSubmit={(e) => e.preventDefault()} className="flex gap-2 max-w-sm mx-auto">
        <input
          type="email"
          placeholder={news.placeholder || t('theme.section.newsletter.placeholder')}
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: 'var(--color-border)' }}
        />
        <button
          type="submit"
          className="text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {news.button_text || t('theme.section.newsletter.cta')}
        </button>
      </form>
    </section>
  );
}

// Bespoke components keyed by section TYPE, in this theme's own look.
const SECTION_COMPONENTS: Record<string, React.FC<SectionProps>> = {
  'hero': HeroBlock,
  'new-arrivals': NewArrivalsBlock,
  'categories': CategoriesBlock,
  'featured-products': FeaturedBlock,
  'trust-badges': TrustBadgesBlock,
  'newsletter': NewsletterBlock,
};

const Home: React.FC = () => {
  // The merchant's composed homepage — ORDERED and enabled-filtered (falls
  // back to the manifest's templates.index). Rendering in THIS order is what
  // makes reordering in the editor work and keeps removed sections away.
  const orderedSections = useTemplateSections('index');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Every section in the merchant's composed order — bespoke components for
          this theme's own types, the shared registry for any other section
          added from the editor — so added sections land where they were placed. */}
      {orderedSections.map((s) => {
        const Bespoke = SECTION_COMPONENTS[s.type];
        const Shared = DEFAULT_SECTION_REGISTRY[s.type];
        if (!Bespoke && !Shared) return null; // unknown type — silently skipped for shoppers
        return (
          <div key={s.id} data-section-id={s.id} className="scroll-mt-20">
            {Bespoke
              ? <Bespoke id={s.id} onQuickView={setQuickViewProduct} />
              : <Shared id={s.id} section={s} onQuickView={setQuickViewProduct} />}
          </div>
        );
      })}

      {/* QuickView Modal */}
      <QuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
};

export default Home;
