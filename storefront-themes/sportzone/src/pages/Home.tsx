import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useTemplateSections, useMerchantBlocks } from '@matjar/theme-shared/theme/ThemeProvider';
import { useTrustLines, TrustLineIconSvg } from '@matjar/theme-shared/components/commerce/TrustBadges';
import { merchantText } from '@matjar/theme-shared/theme/heroContent';
import { DEFAULT_SECTION_REGISTRY } from '@matjar/theme-shared/components/sections';
import { useFeaturedProducts, useCategories, useProducts } from '@matjar/theme-shared/hooks/useProducts';
import { ProductCard } from '@matjar/theme-shared/components/commerce/ProductCard';
import SportzoneHero from '../components/SportzoneHero';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { useIntersectionObserver } from '@matjar/theme-shared/hooks/useIntersectionObserver';
import type { Product } from '@matjar/theme-shared/types/commerce';

type SectionProps = { id: string; onQuickView: (product: Product) => void };

// Each bespoke section reads its settings / blocks by its own INSTANCE id, so
// a copy added from the advanced editor keeps its own values.

/** Hero — bespoke high-energy athletic hero */
function HeroBlock({ id }: SectionProps) {
  const { products: featured } = useFeaturedProducts(4);

  return (
    <SportzoneHero sectionId={id} media={featured?.find((p) => p.images?.[0])?.images?.[0]} />
  );
}

/** Categories with action-shot overlays */
function CategoriesBlock({ id }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const cats = useThemeSettings(id);
  const { categories } = useCategories();
  const categoriesObserver = useIntersectionObserver({ threshold: 0.1 });
  if (categories.length === 0) return null;

  return (
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
                  {cats.shop_now_text || t('theme.section.categories.shop_now')} <span className="inline-block rtl:rotate-180">&rarr;</span>
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Featured Products - bold grid */
function FeaturedBlock({ id, onQuickView }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const feat = useThemeSettings(id);
  const { products: featured, loading: featuredLoading } = useFeaturedProducts(feat.product_limit || 8);
  const productsObserver = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section
      ref={productsObserver.ref as React.RefObject<HTMLElement>}
      className={`bg-gray-50 py-14 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${productsObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black uppercase">{feat.heading || t('theme.section.featured_products.title')}</h2>
          <Link to={feat.view_all_url || '/products'} className="text-[#dc2626] font-bold text-sm uppercase hover:underline">
            {feat.view_all_text || t('theme.section.featured_products.view_all')} <span className="inline-block rtl:rotate-180">&rarr;</span>
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
                onQuickView={feat.show_quick_view !== false ? onQuickView : undefined}
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
  );
}

/** CTA Banner */
function CtaBannerBlock({ id }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const cta = useThemeSettings(id);
  const ctaBgColor = cta.background_color || '#dc2626';
  const ctaBtnBg = cta.button_bg_color || '#ffffff';
  const ctaBtnTextColor = cta.button_text_color || '#dc2626';

  return (
    <section className="py-16 text-center px-4" style={{ backgroundColor: ctaBgColor }}>
      <h2 className={`text-3xl md:text-4xl font-black uppercase text-white ${merchantText(cta.subheading) ? 'mb-4' : 'mb-8'}`}>
        {cta.heading || t('theme.section.cta_banner.title')}
      </h2>
      {/* The merchant's own line only — no demo promise ("Free shipping over $75"). */}
      {merchantText(cta.subheading) && (
        <p className="text-white mb-8 max-w-md mx-auto">{merchantText(cta.subheading)}</p>
      )}
      <Link
        to={cta.button_url || '/products'}
        className="inline-block px-10 py-4 font-black uppercase tracking-wider hover:opacity-90 transition"
        style={{ backgroundColor: ctaBtnBg, color: ctaBtnTextColor }}
      >
        {cta.button_text || t('theme.section.cta_banner.cta')}
      </Link>
    </section>
  );
}

/** Performance Gear Carousel — the newest products */
function PerformanceGearBlock({ id, onQuickView }: SectionProps) {
  const { t } = useTranslation(['theme', 'common']);
  const perfGear = useThemeSettings(id);
  const { products: perfProducts, loading: arrivalsLoading } = useProducts({ sort: 'newest', limit: perfGear.product_limit || 8 });
  const carouselObserver = useIntersectionObserver({ threshold: 0.1 });

  return (
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
            {perfProducts.map((p) => (
              <ProductCard key={p._id} product={p} onQuickView={onQuickView} className="border-gray-200 hover:border-[#dc2626]/40">
                <ProductCard.Image showBadge showQuickView hoverSwap />
                <ProductCard.Body>
                  <ProductCard.Title />
                  <ProductCard.Rating />
                  <ProductCard.Price showCompareAt />
                  <ProductCard.Actions fullWidth className="mt-3" />
                </ProductCard.Body>
              </ProductCard>
            ))}
          </ProductRail>
        )}
      </div>
    </section>
  );
}

/** Demo badges this theme used to ship; sections saved back then still carry them. */
const LEGACY_DEMO_BADGES = [
  { title: 'Free Returns', description: '30-day no-questions-asked returns' },
  { title: 'Pro Gear', description: 'Used by professional athletes worldwide' },
  { title: 'Fast Delivery', description: 'Express shipping on all orders' },
];

/** Trust Badges — the merchant's own badges, else the store's real delivery / returns / payment facts */
function TrustBadgesBlock({ id }: SectionProps) {
  const badgeBlocks = useMerchantBlocks(id, ['title', 'description'], LEGACY_DEMO_BADGES);
  const trustLines = useTrustLines();
  const trustObserver = useIntersectionObserver({ threshold: 0.1 });

  // Icon map for trust-badges blocks
  const iconMap: Record<string, React.ReactNode> = {
    returns: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" /></svg>,
    pro: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
    lightning: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  };

  // Badges the merchant wrote (the demo badges — "Free Returns, 30-day…" —
  // don't count), else the store's own facts. Nothing to say → no section.
  const trustBlocks: Array<{ key: string; title: string; desc: string; icon: React.ReactNode }> = badgeBlocks.length > 0
    ? badgeBlocks.map((b) => ({
        key: b.id,
        title: merchantText(b.settings.title) || '',
        desc: merchantText(b.settings.description) || '',
        icon: iconMap[b.settings.icon] ?? iconMap.lightning,
      }))
    : trustLines.map((line) => ({
        key: line.key,
        title: line.text,
        desc: '',
        icon: <TrustLineIconSvg name={line.icon} className="w-8 h-8" />,
      }));
  if (trustBlocks.length === 0) return null;

  return (
    <section
      ref={trustObserver.ref as React.RefObject<HTMLElement>}
      className={`max-w-7xl mx-auto px-4 py-16 transition-all duration-[var(--duration-slow,500ms)] ease-[var(--ease-entrance,cubic-bezier(0.16,1,0.3,1))] ${trustObserver.isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {trustBlocks.map((f) => (
          <div key={f.key} className="bg-white rounded-lg p-6 border-2 border-gray-100 hover:border-[#dc2626]/30 flex items-center gap-4 transition">
            <div className="text-[#dc2626] flex-shrink-0">{f.icon}</div>
            <div>
              {f.title && <h3 className="font-black uppercase mb-1">{f.title}</h3>}
              {f.desc && <p className="text-sm text-gray-500">{f.desc}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Bespoke components keyed by section TYPE, in this theme's own look.
const SECTION_COMPONENTS: Record<string, React.FC<SectionProps>> = {
  'hero': HeroBlock,
  'categories': CategoriesBlock,
  'featured-products': FeaturedBlock,
  'cta-banner': CtaBannerBlock,
  'performance-gear': PerformanceGearBlock,
  'trust-badges': TrustBadgesBlock,
};

const Home: React.FC = () => {
  // The merchant's composed homepage — ORDERED and enabled-filtered (falls
  // back to the manifest's templates.index). Rendering in THIS order is what
  // makes reordering in the editor work and keeps removed sections away.
  const orderedSections = useTemplateSections('index');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  return (
    <div>
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
      <QuickView product={quickViewProduct} isOpen={!!quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
};

export default Home;
