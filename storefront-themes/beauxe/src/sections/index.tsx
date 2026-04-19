/**
 * Beauxe section registry — pink/cream cosmetics sections.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent, type SectionComponentProps } from '@shared/components/sections';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts } from '@shared/hooks/useProducts';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import BeauxeProductCard from '../components/BeauxeProductCard';
import { useTranslation } from 'react-i18next';

const NAVY = 'var(--color-primary)';
const PINK = 'var(--color-secondary)';
const CREAM = 'var(--color-accent)';
const BLUSH = 'var(--color-muted)';

// ─── Top bar ──────────────────────────────────────────────────────

const TopBarSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  return (
    <div className="text-white text-[11px] tracking-[0.2em] py-2.5 text-center" style={{ backgroundColor: NAVY }}>
      {s.text || t('theme.section.top_bar.text')}
      {s.link_text && (
        <Link to={s.link_url || '/products'} className="ms-3 underline hover:text-[var(--color-primary)]">
          {s.link_text}
        </Link>
      )}
    </div>
  );
};

// ─── Model hero ───────────────────────────────────────────────────

const HeroSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: BLUSH }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* Text */}
        <div className="relative z-10 text-center md:text-start">
          {s.eyebrow && (
            <div className="text-[11px] tracking-[0.3em] uppercase font-semibold mb-5" style={{ color: PINK }}>
              {s.eyebrow}
            </div>
          )}
          <h1
            className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.05] mb-6"
            style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}
          >
            {s.heading || t('theme.section.hero.heading')}
          </h1>
          {s.subheading && (
            <p className="text-base md:text-lg leading-relaxed mb-8 max-w-md" style={{ color: NAVY, opacity: 0.8 }}>
              {s.subheading}
            </p>
          )}
          <Link
            to={s.cta_url || '/products'}
            className="inline-block px-10 py-4 rounded-full text-white text-[11px] tracking-[0.22em] uppercase font-semibold hover:opacity-90 transition"
            style={{ backgroundColor: NAVY }}
          >
            {s.cta_text || t('theme.section.hero.cta')} →
          </Link>

          {/* Trust line */}
          <div className="mt-8 flex items-center gap-4 justify-center md:justify-start text-[11px]" style={{ color: NAVY }}>
            <div className="flex items-center gap-1.5">
              <span className="text-lg">★★★★★</span>
              <span className="opacity-75">{t('theme.section.hero.trust_line')}</span>
            </div>
          </div>
        </div>

        {/* Model image */}
        <div className="relative">
          <div
            className="aspect-[3/4] rounded-[60px] overflow-hidden"
            style={{ backgroundColor: CREAM }}
          >
            {s.image ? (
              <img src={s.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ color: PINK }}>
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>
          {/* Decorative product badges */}
          <div className="absolute -top-4 -end-4 w-24 h-24 rounded-full flex items-center justify-center text-center text-[10px] font-bold leading-tight uppercase tracking-wider shadow-lg" style={{ backgroundColor: NAVY, color: 'white' }}>
            Clean<br />Beauty<br />2024
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Feature strip ────────────────────────────────────────────────

const iconFor = (key: string) => {
  const icons: Record<string, React.ReactElement> = {
    truck: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9-1.5h10.5a1.5 1.5 0 001.5-1.5v-8.25a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v9.75l1.5 1.5zm12 1.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.5a1.5 1.5 0 001.5-1.5v-4.5l-3.75-3.75H15" />,
    leaf: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75c-.75 0-3.75-3-3.75-6.75 0-6 5.25-9 10.5-9 0 5.25-3 10.5-9 10.5 0 0 0 5.25 2.25 5.25M4.5 19.5c.75 0 2.25-.75 3.75-2.25" />,
    heart: <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />,
  };
  return icons[key] || icons.truck;
};

const FeatureStripSection: React.FC<SectionComponentProps> = ({ section }) => {
  const { t } = useTranslation(['theme']);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { icon: 'truck', title: t('theme.section.feature_strip.free_shipping_title'), subtitle: t('theme.section.feature_strip.free_shipping_subtitle') } },
    { id: 'b', settings: { icon: 'leaf', title: t('theme.section.feature_strip.natural_title'), subtitle: t('theme.section.feature_strip.natural_subtitle') } },
    { id: 'c', settings: { icon: 'heart', title: t('theme.section.feature_strip.cruelty_title'), subtitle: t('theme.section.feature_strip.cruelty_subtitle') } },
    { id: 'd', settings: { icon: 'shield', title: t('theme.section.feature_strip.secure_title'), subtitle: t('theme.section.feature_strip.secure_subtitle') } },
  ];
  return (
    <section className="py-10" style={{ backgroundColor: CREAM }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((b) => {
          const bs = b.settings || {};
          return (
            <div key={b.id} className="flex items-center gap-4 text-center md:text-start justify-center md:justify-start">
              <svg className="w-7 h-7 shrink-0" fill="none" stroke={PINK} viewBox="0 0 24 24" strokeWidth={1.8}>
                {iconFor(bs.icon)}
              </svg>
              <div>
                <div className="text-[13px] font-bold" style={{ color: NAVY }}>{bs.title}</div>
                <div className="text-[11px] opacity-70" style={{ color: NAVY }}>{bs.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ─── Category tiles ───────────────────────────────────────────────

const CategoryTilesSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { title: 'Skincare', background: '#f8e4e4' } },
    { id: 'b', settings: { title: 'Makeup', background: '#faf3ec' } },
    { id: 'c', settings: { title: 'Fragrance', background: '#f3ddd1' } },
  ];
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
      <div className="text-center mb-12">
        <h2 className="font-serif text-4xl md:text-5xl mb-3" style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}>
          {s.heading || t('theme.section.category_tiles.heading')}
        </h2>
        {s.subheading && <p className="text-sm opacity-75" style={{ color: NAVY }}>{s.subheading}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.slice(0, 3).map((b) => {
          const bs = b.settings || {};
          return (
            <Link
              key={b.id}
              to={bs.cta_url || '/products'}
              className="group relative block rounded-[40px] overflow-hidden aspect-[4/5]"
              style={{ backgroundColor: bs.background || '#f8e4e4' }}
            >
              {bs.image && (
                <img src={bs.image} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition duration-700" />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                <h3 className="font-serif text-4xl md:text-5xl mb-4" style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}>
                  {bs.title}
                </h3>
                <span className="inline-block px-6 py-2 rounded-full text-[11px] tracking-[0.22em] uppercase font-semibold text-white group-hover:bg-[color:var(--color-secondary)] transition" style={{ backgroundColor: NAVY }}>
                  {t('theme.section.category_tiles.shop_now')} →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

// ─── Product grid ─────────────────────────────────────────────────

const ProductGridSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const limit = Number(s.product_limit) || 8;
  const source = (s.source as string) || 'featured';
  const featured = useFeaturedProducts(limit);
  const regular = useProducts({ sort: source === 'newest' ? 'newest' : 'popular', limit });
  const { products, loading } = source === 'featured' ? featured : regular;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
      <div className="text-center mb-12">
        <div className="text-[11px] tracking-[0.3em] uppercase font-semibold mb-3" style={{ color: PINK }}>
          {s.subheading || t('theme.section.feature_strip.favourites')}
        </div>
        <h2 className="font-serif text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}>
          {s.heading || t('theme.section.product_grid.heading_bestsellers')}
        </h2>
        <div className="w-16 h-[2px] mx-auto mt-5" style={{ backgroundColor: PINK }} />
      </div>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((p: any) => (
            <BeauxeProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </div>
      )}
      <div className="text-center mt-12">
        <Link
          to="/products"
          className="inline-block px-10 py-4 rounded-full border-2 text-[11px] tracking-[0.22em] uppercase font-semibold hover:bg-[color:var(--color-primary)] hover:text-white transition"
          style={{ borderColor: NAVY, color: NAVY }}
        >
          {t('theme.section.product_grid.view_all')} →
        </Link>
      </div>
    </section>
  );
};

// ─── Banner ───────────────────────────────────────────────────────

const BannerSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  return (
    <section className="my-20" style={{ backgroundColor: s.background_color || BLUSH }}>
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        {s.eyebrow && (
          <div className="text-[11px] tracking-[0.3em] uppercase font-semibold mb-4" style={{ color: NAVY }}>
            {s.eyebrow}
          </div>
        )}
        <h2
          className="font-serif text-5xl md:text-6xl mb-6"
          style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}
        >
          {s.heading || t('theme.section.banner.heading')}
        </h2>
        {s.subheading && (
          <p className="text-base max-w-md mx-auto mb-8" style={{ color: NAVY, opacity: 0.8 }}>
            {s.subheading}
          </p>
        )}
        <Link
          to={s.cta_url || '/products'}
          className="inline-block px-10 py-4 rounded-full text-white text-[11px] tracking-[0.22em] uppercase font-semibold hover:opacity-90 transition"
          style={{ backgroundColor: NAVY }}
        >
          {s.cta_text || t('theme.section.banner.cta')}
        </Link>
      </div>
    </section>
  );
};

// ─── Testimonials ─────────────────────────────────────────────────

const TestimonialsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { quote: 'Absolutely love this serum!', author: 'Emma R.', role: 'Verified Buyer' } },
    { id: 'b', settings: { quote: 'Clean ingredients, amazing results.', author: 'Sophie L.', role: 'Verified Buyer' } },
    { id: 'c', settings: { quote: 'A new staple in my routine.', author: 'Mia K.', role: 'Verified Buyer' } },
  ];
  return (
    <section className="py-20" style={{ backgroundColor: CREAM }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="font-serif text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}>
            {s.heading || t('theme.section.testimonials.heading')}
          </h2>
          <div className="w-16 h-[2px] mx-auto mt-5" style={{ backgroundColor: PINK }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.slice(0, 3).map((b) => {
            const bs = b.settings || {};
            return (
              <div key={b.id} className="bg-white rounded-3xl p-8 text-center shadow-sm">
                <div className="flex justify-center mb-4">
                  {[1,2,3,4,5].map((i) => (
                    <svg key={i} className="w-4 h-4" fill={PINK} viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <p className="font-serif text-lg italic mb-5" style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}>
                  "{bs.quote}"
                </p>
                <div className="text-sm font-bold" style={{ color: NAVY }}>— {bs.author}</div>
                {bs.role && <div className="text-[11px] opacity-60 uppercase tracking-wider mt-1">{bs.role || t('theme.section.testimonials.verified_buyer')}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── Registry ─────────────────────────────────────────────────────

export const BEAUXE_SECTION_REGISTRY: Record<string, SectionComponent> = {
  ...DEFAULT_SECTION_REGISTRY,
  'beauxe-top-bar': TopBarSection,
  'beauxe-hero': HeroSection,
  'beauxe-feature-strip': FeatureStripSection,
  'beauxe-category-tiles': CategoryTilesSection,
  'beauxe-product-grid': ProductGridSection,
  'beauxe-banner': BannerSection,
  'beauxe-testimonials': TestimonialsSection,
  // Shadow universal product feeds
  'featured-products': ProductGridSection,
  'new-arrivals': ProductGridSection,
  'product-grid': ProductGridSection,
};
