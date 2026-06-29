/**
 * Nutreko section registry + components.
 *
 * Bold black/lime sports-nutrition sections.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent, type SectionComponentProps } from '@shared/components/sections';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts } from '@shared/hooks/useProducts';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { ProductRail } from '@shared/components/commerce/ProductRail';
import NutrekoProductCard from '../components/NutrekoProductCard';

// Niche default hero image (supplements/fitness) so the power hero is never empty.
const HERO_DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1600&q=80&auto=format&fit=crop';

const LIME = 'var(--color-primary)';
const DARK = 'var(--color-secondary)';
const headingFont = { fontFamily: 'var(--font-family-heading)' } as const;

// ─── Top info strip ───────────────────────────────────────────────

const TopStripSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  return (
    <div className="text-[11px] tracking-[0.2em] font-bold py-2.5 text-center" style={{ backgroundColor: LIME, color: DARK }}>
      <span className="inline-flex items-center gap-2"><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z" /></svg>{s.text || t('theme.announcement.default', { defaultValue: 'FREE SHIPPING ON ORDERS OVER $75' })}</span>
    </div>
  );
};

// ─── Power hero ───────────────────────────────────────────────────

const HeroSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  return (
    <section className="relative overflow-hidden bg-black text-white">
      {/* diagonal lime stripes background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.08]" aria-hidden>
        <div className="absolute -top-20 -end-20 w-[600px] h-[600px] rounded-full" style={{ backgroundColor: LIME }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          {s.eyebrow && (
            <div className="text-[11px] tracking-[0.25em] uppercase font-black mb-6" style={{ color: LIME }}>
              {s.eyebrow}
            </div>
          )}
          <h1
            className="font-display text-5xl sm:text-6xl md:text-7xl leading-[0.95] uppercase"
            style={headingFont}
          >
            {(s.heading || t('theme.section.nutreko-hero.heading', { defaultValue: 'FUEL YOUR PERFORMANCE' })).split(' ').map((w: string, i: number) => (
              <span key={i} className={i === 1 ? 'text-[var(--color-primary)]' : ''}>{w} </span>
            ))}
          </h1>
          {s.subheading && (
            <p className="mt-6 text-base text-white/70 max-w-md leading-relaxed">
              {s.subheading}
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to={s.cta_url || '/products'}
              className="group inline-flex items-center gap-2 px-10 py-4 text-[11px] tracking-[0.22em] uppercase font-black hover:scale-105 transition"
              style={{ backgroundColor: LIME, color: DARK }}
            >
              {s.cta_text || t('theme.section.nutreko-hero.cta', { defaultValue: 'SHOP NOW' })}
              <svg className="w-3.5 h-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            {s.secondary_cta_text && (
              <Link
                to={s.cta_url || '/products'}
                className="inline-block px-10 py-4 text-[11px] tracking-[0.22em] uppercase font-black border-2 border-white hover:bg-white hover:text-black transition"
              >
                {s.secondary_cta_text}
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-md border-t border-white/10 pt-6">
            {[
              ['500+', t('theme.section.nutreko-hero.stat_products')],
              ['50K+', t('theme.section.nutreko-hero.stat_customers')],
              ['100%', t('theme.section.nutreko-hero.stat_authentic')],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="font-display text-3xl" style={{ fontFamily: 'var(--font-family-heading)', color: LIME }}>{n}</div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-white/60 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative hidden md:block">
          <div className="aspect-square bg-gradient-to-br from-white/5 to-transparent border-4 border-white/10 relative overflow-hidden">
            {s.image ? (
              <img src={s.image as string} alt="" onError={(e) => { e.currentTarget.src = HERO_DEFAULT_IMAGE; }} className="w-full h-full object-contain p-8" />
            ) : (
              <img src={HERO_DEFAULT_IMAGE} alt="" className="w-full h-full object-cover" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Guarantee panels ─────────────────────────────────────────────

const GuaranteeSection: React.FC<SectionComponentProps> = ({ section }) => {
  const { t } = useTranslation('theme');
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { icon: '100% AUTHENTIC', title: t('theme.section.nutreko-guarantee.authentic_title', { defaultValue: '100% AUTHENTIC' }), subtitle: t('theme.section.nutreko-guarantee.authentic_subtitle', { defaultValue: 'Sourced direct from brands' }) } },
    { id: 'b', settings: { icon: 'MAXIMUM POTENCY', title: t('theme.section.nutreko-guarantee.potency_title', { defaultValue: 'MAXIMUM POTENCY' }), subtitle: t('theme.section.nutreko-guarantee.potency_subtitle', { defaultValue: 'Premium grade formulas' }) } },
    { id: 'c', settings: { icon: 'LAB TESTED', title: t('theme.section.nutreko-guarantee.lab_title', { defaultValue: 'LAB TESTED' }), subtitle: t('theme.section.nutreko-guarantee.lab_subtitle', { defaultValue: 'Every batch verified' }) } },
    { id: 'd', settings: { icon: 'FAST SHIPPING', title: t('theme.section.nutreko-guarantee.shipping_title', { defaultValue: 'FAST SHIPPING' }), subtitle: t('theme.section.nutreko-guarantee.shipping_subtitle', { defaultValue: 'Ships within 24 hours' }) } },
  ];

  const icons: Record<string, string> = {
    '100% AUTHENTIC': 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
    'MAXIMUM POTENCY': 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
    'LAB TESTED': 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
    'FAST SHIPPING': 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9-1.5h1.5m-1.5 0h-1.5a1.5 1.5 0 01-1.5-1.5V7.875c0-.621.504-1.125 1.125-1.125h9.375c.621 0 1.125.504 1.125 1.125V16.5m-9-1.5h9.375m0 0h1.5m-1.5 0v-3.375c0-.621.504-1.125 1.125-1.125H18a1.125 1.125 0 011.125 1.125V16.5m1.5 0h1.875c.621 0 1.125.504 1.125 1.125v0c0 .621-.504 1.125-1.125 1.125H21m-2.25 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0',
  };

  return (
    <section className="bg-white py-14 border-y-2 border-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x-2 divide-black border-2 border-black">
          {items.slice(0, 4).map((b, i) => {
            const bs = b.settings || {};
            const iconPath = icons[(bs.icon || bs.title) as string] || icons['100% AUTHENTIC'];
            return (
              <div key={b.id || i} className="p-6 md:p-8 text-center hover:bg-[var(--color-primary)] transition">
                <svg className="w-10 h-10 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                </svg>
                <div className="font-black text-sm uppercase tracking-wider mb-1" style={headingFont}>
                  {bs.title}
                </div>
                <div className="text-[11px] opacity-70">{bs.subtitle}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── Category strip ───────────────────────────────────────────────

const CategoryStripSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { title: t('theme.section.nutreko-category-strip.cat_protein', { defaultValue: 'PROTEIN' }) } },
    { id: 'b', settings: { title: t('theme.section.nutreko-category-strip.cat_pre_workout', { defaultValue: 'PRE-WORKOUT' }) } },
    { id: 'c', settings: { title: t('theme.section.nutreko-category-strip.cat_creatine', { defaultValue: 'CREATINE' }) } },
    { id: 'd', settings: { title: t('theme.section.nutreko-category-strip.cat_recovery', { defaultValue: 'RECOVERY' }) } },
    { id: 'e', settings: { title: t('theme.section.nutreko-category-strip.cat_vitamins', { defaultValue: 'VITAMINS' }) } },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-10">
        <h2 className="font-display text-4xl md:text-5xl uppercase" style={headingFont}>
          {s.heading || t('theme.section.nutreko-category-strip.heading', { defaultValue: 'EXPLORE THE RANGE' })}
        </h2>
        {s.subheading && <p className="mt-3 text-sm opacity-60">{s.subheading}</p>}
        <div className="w-16 h-1 mx-auto mt-5" style={{ backgroundColor: LIME }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {items.map((b) => {
          const bs = b.settings || {};
          return (
            <Link
              key={b.id}
              to={bs.cta_url || '/products'}
              className="group relative aspect-square border-2 border-black bg-[var(--color-muted)] flex flex-col items-center justify-center p-6 hover:bg-[var(--color-primary)] transition"
            >
              {bs.image ? (
                <img src={bs.image} alt={bs.title} className="w-20 h-20 object-contain mb-3" />
              ) : (
                <div className="w-20 h-20 border-2 border-current mb-3 flex items-center justify-center">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>
              )}
              <div className="font-black text-sm tracking-wider uppercase text-center" style={headingFont}>
                {bs.title}
              </div>
              <div className="text-[10px] tracking-widest mt-1 opacity-60">{t('theme.section.nutreko-category-strip.shop_label')}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

// ─── Product grid ─────────────────────────────────────────────────

const ProductGridSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 8;
  const source = (s.source as string) || 'featured';

  const featured = useFeaturedProducts(limit);
  const regular = useProducts({ sort: source === 'newest' ? 'newest' : 'popular', limit });
  const { products, loading } = source === 'featured' ? featured : regular;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <h2 className="font-display text-4xl md:text-5xl uppercase" style={headingFont}>
            {s.heading || t('theme.section.nutreko-product-grid.top_sellers_heading', { defaultValue: 'TOP SELLERS' })}
          </h2>
          {s.subheading && <p className="mt-2 text-sm opacity-60">{s.subheading}</p>}
          <div className="w-16 h-1 mt-4" style={{ backgroundColor: LIME }} />
        </div>
        <Link
          to="/products"
          className="text-[11px] tracking-[0.22em] uppercase font-black border-b-2 pb-1 hover:opacity-60 transition self-start md:self-auto"
          style={{ borderColor: LIME }}
        >
          {t('theme.section.nutreko-product-grid.view_all')}
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : (
        <ProductRail columns={4}>
          {products.map((p: any) => (
            <NutrekoProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </ProductRail>
      )}
    </section>
  );
};

// ─── Promo banner ─────────────────────────────────────────────────

const BannerSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="relative bg-black text-white overflow-hidden border-2 border-black">
        <div className="absolute inset-y-0 end-0 w-1/3" style={{ backgroundColor: LIME }} />
        <div className="relative p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1">
            {s.eyebrow && (
              <div className="inline-block px-3 py-1 text-[10px] tracking-[0.25em] uppercase font-black mb-4" style={{ backgroundColor: LIME, color: DARK }}>
                {s.eyebrow}
              </div>
            )}
            <h2 className="font-display text-4xl md:text-6xl uppercase leading-[0.95]" style={headingFont}>
              {s.heading || t('theme.section.nutreko-banner.heading', { defaultValue: 'BUY 2 GET 1 FREE' })}
            </h2>
            {s.subheading && (
              <p className="mt-4 text-white/70 max-w-md">{s.subheading}</p>
            )}
          </div>
          <Link
            to={s.cta_url || '/products'}
            className="relative inline-block px-10 py-5 text-[12px] tracking-[0.22em] uppercase font-black bg-white text-black hover:bg-black hover:text-white border-2 border-black transition"
          >
            {s.cta_text || t('theme.section.nutreko-banner.cta', { defaultValue: 'SHOP DEAL' })} <span aria-hidden className="rtl:rotate-180 inline-block">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

// ─── Registry ─────────────────────────────────────────────────────

export const NUTREKO_SECTION_REGISTRY: Record<string, SectionComponent> = {
  ...DEFAULT_SECTION_REGISTRY,
  'nutreko-top-strip': TopStripSection,
  'nutreko-hero': HeroSection,
  'nutreko-guarantee': GuaranteeSection,
  'nutreko-category-strip': CategoryStripSection,
  'nutreko-product-grid': ProductGridSection,
  'nutreko-banner': BannerSection,
  // Shadow universal feeds
  'featured-products': ProductGridSection,
  'new-arrivals': ProductGridSection,
  'product-grid': ProductGridSection,
};
