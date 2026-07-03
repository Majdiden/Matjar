import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionEnabled, useSectionBlocks } from '@matjar/theme-shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { ProductCard } from '@matjar/theme-shared/components/commerce/ProductCard';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { Hero } from '@matjar/theme-shared/components/sections/Hero';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { MerchantSections } from '@matjar/theme-shared/theme/SectionRenderer';
import { useIntersectionObserver } from '@matjar/theme-shared/hooks/useIntersectionObserver';
import type { Product } from '@matjar/theme-shared/types/commerce';

const HARDCODED_IDS = ['hero', 'categories', 'featured-products', 'trust-badges', 'newsletter'];

// Niche default hero image — a clean minimal retail shot — so the hero is
// never empty even before the merchant sets one.
const HERO_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80&auto=format&fit=crop';

const Home: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);

  // Section settings from manifest + tenant overrides
  const hero = useThemeSettings('hero');
  const catsSettings = useThemeSettings('categories');
  const feat = useThemeSettings('featured-products');
  const news = useThemeSettings('newsletter');
  const trustBadgeBlocks = useSectionBlocks('trust-badges');

  // Section visibility
  const heroEnabled = useSectionEnabled('hero');
  const catsEnabled = useSectionEnabled('categories');
  const featEnabled = useSectionEnabled('featured-products');
  const trustEnabled = useSectionEnabled('trust-badges');
  const newsEnabled = useSectionEnabled('newsletter');

  const { products: featured, loading } = useFeaturedProducts(feat.product_limit || 6);
  const { categories } = useCategories();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const productsRef = useRef<HTMLDivElement>(null);
  const productsVisible = useIntersectionObserver(productsRef, { threshold: 0.1 });

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Hero — bespoke minimal hero (reads the same hero.* settings + i18n
          keys internally; featured image is passed for the simple frame,
          gated on a merchant background image exactly as before). */}
      {heroEnabled && (
        <Hero
          className="mb-16"
          variant="spotlight"
          tone="light"
          title={hero.heading || t('theme.hero.main.headline')}
          subtitle={hero.subheading || t('theme.hero.main.subheadline')}
          primaryCta={{ label: hero.button_text || t('theme.hero.main.cta'), href: hero.button_url || '/products' }}
          backgroundImage={hero.background_image || undefined}
          media={featured?.find((p) => p.images?.[0])?.images?.[0]}
          defaultImage={HERO_DEFAULT_IMAGE}
        />
      )}

      {/* Categories as Text Links */}
      {catsEnabled && categories.length > 0 && (
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
      )}

      {/* Clean Product Grid */}
      {featEnabled && (
      <section
        ref={productsRef}
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
              <ProductCard key={p._id} product={p} onQuickView={feat.show_quick_view !== false ? setQuickViewProduct : undefined}>
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
      )}

      {/* Minimal Features */}
      {trustEnabled && trustBadgeBlocks.length > 0 && (
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
      )}

      {/* Simple Newsletter */}
      {newsEnabled && (
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
      )}

      {/* Merchant-added sections (anything the dashboard added beyond the curated layout above) */}
      <MerchantSections template="index" excludeIds={HARDCODED_IDS} onQuickView={setQuickViewProduct} />

      {/* QuickView Modal */}
      <QuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
};

export default Home;
