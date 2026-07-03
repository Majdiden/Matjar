/**
 * Glowing section registry + components.
 *
 * All theme-local sections live in this file. Each is a drop-in
 * replacement keyed into GLOWING_SECTION_REGISTRY so the SectionRenderer
 * can look them up by `type`.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent, type SectionComponentProps } from '@shared/components/sections';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts } from '@shared/hooks/useProducts';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { ProductRail } from '@shared/components/commerce/ProductRail';
import GlowingProductCard from '../components/GlowingProductCard';

// Baked default imagery (verified Unsplash skincare shots) so a fresh store
// on this theme looks complete before the merchant uploads anything. Every
// image slot still honours the merchant's own setting first.
const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;
const GLOWING_DEFAULTS = {
  hero: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=1600&q=80&auto=format&fit=crop',
  promo: [U('1556228720-195a672e8a03'), U('1608248543803-ba4f8c70ae0b'), U('1556228578-8c89e6adf883')],
  tiles: [
    U('1556228720-195a672e8a03'), U('1608248543803-ba4f8c70ae0b'), U('1556228578-8c89e6adf883'),
    U('1570172619644-dfd03ed5d881'), U('1512496015851-a90fb38ba796'), U('1612817288484-6f916006741a'),
  ],
};

// ─── Top strip (announcement) ─────────────────────────────────────

const TopStripSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  return (
    <div className="bg-black text-white text-[11px] tracking-[0.18em] font-medium py-2.5 text-center">
      {s.text || t('theme.announcement.default_text')}
    </div>
  );
};

// ─── Editorial hero ───────────────────────────────────────────────

const HeroSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: 'var(--color-accent)' }}>
      {/* soft leaf decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]" aria-hidden>
        <svg className="absolute top-10 start-10 w-64 h-64" viewBox="0 0 200 200" fill="none">
          <path d="M100 20 C 140 60, 160 120, 100 180 C 40 120, 60 60, 100 20" stroke="var(--color-foreground)" strokeWidth="1" />
        </svg>
        <svg className="absolute bottom-10 end-10 w-80 h-80" viewBox="0 0 200 200" fill="none">
          <path d="M20 100 C 60 60, 120 40, 180 100 C 120 160, 60 140, 20 100" stroke="var(--color-foreground)" strokeWidth="1" />
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 md:py-36 text-center">
        {s.eyebrow && (
          <div className="text-[11px] tracking-[0.32em] uppercase text-neutral-700 mb-6">
            {s.eyebrow}
          </div>
        )}
        <h1
          className="font-display text-5xl sm:text-6xl md:text-7xl leading-[1.05] text-black max-w-3xl mx-auto"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {s.heading || t('theme.hero.headline')}
        </h1>
        {s.subheading && (
          <p className="mt-6 text-sm md:text-base text-neutral-700 max-w-xl mx-auto leading-relaxed">
            {s.subheading}
          </p>
        )}
        <Link
          to={s.cta_url || '/products'}
          className="inline-block mt-10 px-10 py-4 bg-black text-white text-[11px] tracking-[0.22em] uppercase font-semibold hover:bg-neutral-800 transition"
        >
          {s.cta_text || t('theme.hero.cta')}
        </Link>

        {/* Editorial hero image — merchant's setting first, tasteful skincare
            default otherwise, so the hero is never an empty colour stage. */}
        <div className="mt-14 max-w-4xl mx-auto overflow-hidden rounded-t-[999px] rounded-b-3xl group">
          <img
            src={s.image || GLOWING_DEFAULTS.hero}
            alt=""
            aria-hidden="true"
            onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
            className="w-full aspect-[16/9] object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
      </div>
    </section>
  );
};

// ─── Three promo cards ────────────────────────────────────────────

const PromoCardsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation(['theme']);
  const blocks: any[] = (section as any)?.blocks || [];
  const s = useThemeSettings(id);
  // Fallback: derive tints from the brand accent palette instead of a
  // hardcoded literal array. Merchants customise per-card tint via the
  // block's `background_color` setting (see theme.manifest.ts).
  const fallbackTint = (pct: number) =>
    `color-mix(in srgb, var(--color-accent) ${pct}%, white)`;
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { eyebrow: t('theme.section.promo_cards.card1_eyebrow'), title: t('theme.section.promo_cards.card1_title'), cta_text: t('theme.section.promo_cards.card1_cta'), background_color: fallbackTint(20), image: GLOWING_DEFAULTS.promo[0] } },
    { id: 'b', settings: { eyebrow: t('theme.section.promo_cards.card2_eyebrow'), title: t('theme.section.promo_cards.card2_title'), cta_text: t('theme.section.promo_cards.card2_cta'), background_color: fallbackTint(30), image: GLOWING_DEFAULTS.promo[1] } },
    { id: 'c', settings: { eyebrow: t('theme.section.promo_cards.card3_eyebrow'), title: t('theme.section.promo_cards.card3_title'), cta_text: t('theme.section.promo_cards.card3_cta'), background_color: fallbackTint(40), image: GLOWING_DEFAULTS.promo[2] } },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.slice(0, 3).map((b, bi) => {
          const bs = b.settings || {};
          const cardImage = bs.image || GLOWING_DEFAULTS.promo[bi % GLOWING_DEFAULTS.promo.length];
          return (
            <Link
              key={b.id}
              to={bs.cta_url || '/products'}
              className="group relative block overflow-hidden aspect-[4/5]"
              style={{ backgroundColor: bs.background_color || fallbackTint(20) }}
            >
              {cardImage && (
                <img
                  src={cardImage}
                  alt={bs.title}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="absolute inset-0 w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                />
              )}
              <div className="relative h-full flex flex-col items-center justify-end text-center p-10">
                {bs.eyebrow && (
                  <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-600 mb-3">{bs.eyebrow}</div>
                )}
                <h3
                  className="font-display text-4xl md:text-5xl text-black mb-6"
                  style={{ fontFamily: 'var(--font-family-heading)' }}
                >
                  {bs.title}
                </h3>
                <span className="inline-block border-b border-black pb-1 text-[11px] tracking-[0.22em] uppercase font-semibold text-black group-hover:translate-y-[-2px] transition">
                  {bs.cta_text || t('theme.hero.cta')}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

// ─── Product grid (source-based) ──────────────────────────────────

const ProductGridSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 8;
  const source = (s.source as string) || 'featured';
  const colsSetting = Number(s.columns) || 4;
  const cols = Math.min(4, Math.max(3, colsSetting));

  const featured = useFeaturedProducts(limit);
  const regular = useProducts({ sort: source === 'newest' ? 'newest' : 'popular', limit });
  const { products, loading } = source === 'featured' ? featured : regular;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
      <div className="text-center mb-12">
        <h2
          className="font-display text-4xl md:text-5xl text-black"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {s.heading || t('theme.section.product_grid.best_sellers_title')}
        </h2>
        {s.subheading && (
          <p className="mt-3 text-sm text-neutral-500 max-w-md mx-auto">{s.subheading}</p>
        )}
        <div className="w-12 h-px bg-black mx-auto mt-6" />
      </div>

      {loading ? (
        <div className={`grid gap-8 grid-cols-2 md:grid-cols-${cols}`}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : (
        <ProductRail columns={cols as 2 | 3 | 4 | 5}>
          {products.map((p: any) => (
            <GlowingProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </ProductRail>
      )}
    </section>
  );
};

// ─── Centered quote ───────────────────────────────────────────────

const QuoteSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  return (
    <section className="py-24 md:py-32" style={{ backgroundColor: 'var(--color-accent)' }}>
      <div className="max-w-2xl mx-auto text-center px-6">
        <p
          className="font-display text-3xl md:text-4xl leading-snug text-black italic"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {s.quote || t('theme.section.quote.default_quote')}
        </p>
        <div className="mt-6 text-[10px] tracking-[0.3em] uppercase text-neutral-700">
          — {s.author || t('theme.section.quote.default_author')}
        </div>
      </div>
    </section>
  );
};

// ─── Instagram ────────────────────────────────────────────────────

const InstagramSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  // Derive fallback tints from the brand accent palette so the tile
  // palette tracks theme colours rather than fixed literals. Each tile
  // is a `tile` block with its own `background_color` setting.
  const fallbackTint = (pct: number) =>
    `color-mix(in srgb, var(--color-accent) ${pct}%, white)`;
  const fallbackPcts = [20, 40, 30, 25, 35, 45];
  const tiles = blocks.length > 0
    ? blocks
    : fallbackPcts.map((p, i) => ({
        id: `t${i}`,
        settings: { background_color: fallbackTint(p), image: GLOWING_DEFAULTS.tiles[i % GLOWING_DEFAULTS.tiles.length] },
      }));
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-10">
        <h2
          className="font-display text-4xl md:text-5xl text-black"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {s.heading || t('theme.section.instagram.title')}
        </h2>
        {s.subheading && <p className="mt-3 text-sm text-neutral-500">{s.subheading}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1">
        {tiles.slice(0, 6).map((tile: any, i: number) => {
          const ts = tile.settings || {};
          const bg = ts.background_color || fallbackTint(fallbackPcts[i % fallbackPcts.length]);
          const inner = (
            <>
              {ts.image && (
                <img
                  src={ts.image}
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 bg-black/30 transition">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </div>
            </>
          );
          const className = 'aspect-square cursor-pointer group relative overflow-hidden';
          const style = { backgroundColor: bg };
          return ts.link ? (
            <a key={tile.id || i} href={ts.link} className={className} style={style}>{inner}</a>
          ) : (
            <div key={tile.id || i} className={className} style={style}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
};

// ─── Registry ─────────────────────────────────────────────────────

export const GLOWING_SECTION_REGISTRY: Record<string, SectionComponent> = {
  ...DEFAULT_SECTION_REGISTRY,
  'glowing-top-strip': TopStripSection,
  'glowing-hero': HeroSection,
  'glowing-promo-cards': PromoCardsSection,
  'glowing-product-grid': ProductGridSection,
  'glowing-quote': QuoteSection,
  'glowing-instagram': InstagramSection,
  // Shadow universal feeds so dashboard-added sections use our card style
  'featured-products': ProductGridSection,
  'new-arrivals': ProductGridSection,
  'product-grid': ProductGridSection,
};
