/**
 * Milmaa section registry + components.
 *
 * Pastel teal/cream/pink plant-based milk sections.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent, type SectionComponentProps } from '@matjar/theme-shared/components/sections';
import { useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { Hero } from '@matjar/theme-shared/components/sections/Hero';
import MilmaaProductCard from '../components/MilmaaProductCard';

// Niche default hero image (organic/wellness) so the editorial hero is never empty.
const HERO_DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=1600&q=80&auto=format&fit=crop';

const TEAL = 'var(--color-primary)';
const DARK_TEAL = 'var(--color-foreground)';
const PINK = 'var(--color-accent)';
const YELLOW = 'var(--color-secondary)';
const CREAM = 'var(--color-background)';
const MUTED = 'var(--color-muted)';
const HEADING_FONT = 'var(--font-family-heading)';

/** Pastel tint rotation used behind imagery so photos sit inside the palette. */
const TINTS = [YELLOW, PINK, TEAL];

/**
 * Bottom-anchored scrim in the tile's pastel tint so dark-teal (or cream)
 * copy stays legible over a real photo without dropping the palette.
 */
const tintScrim = (tint: string): React.CSSProperties => ({
  background: `linear-gradient(to top, ${tint} 0%, ${tint} 22%, transparent 62%)`,
});

// ─── Top strip ────────────────────────────────────────────────────

const TopStripSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  return (
    <div className="text-white text-[12px] py-2.5 text-center font-medium" style={{ backgroundColor: TEAL }}>
      {s.text || t('theme.section.milmaa-top-strip.text', { defaultValue: '100% Plant-Based · Free Shipping on Orders Over $40' })}
    </div>
  );
};

// ─── Embrace Hero (shared, imagery-forward) ───────────────────────

const HeroSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  return (
    <Hero
      variant="editorial"
      align="start"
      title={s.heading || t('theme.section.milmaa-hero.heading')}
      subtitle={s.subheading || t('theme.section.milmaa-hero.subheading')}
      primaryCta={{ label: s.cta_text || t('theme.section.milmaa-hero.cta'), href: (s.cta_url as string) || '/products' }}
      secondaryCta={{ label: t('theme.section.milmaa-hero.watch_story'), href: '/about' }}
      saleText={s.eyebrow || t('theme.section.milmaa-hero.eyebrow')}
      backgroundImage={(s.image as string) || undefined}
      defaultImage={HERO_DEFAULT_IMAGE}
    />
  );
};

// ─── Flavor panels ────────────────────────────────────────────────

interface FlavorTile {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  tint: string;
  /** Real photo (category image or merchant-uploaded block image). */
  image?: string;
  /** Merchant block images are product cut-outs → contain; photos → cover. */
  fit: 'cover' | 'contain';
}

/**
 * Flavor / category panels.
 *
 * Tile source, in order of preference:
 *   1. merchant blocks that carry an image (explicitly curated in the editor);
 *   2. the store's real categories (name + `category.image` as a cover photo);
 *   3. the manifest's default milk-flavour blocks as coloured panels.
 * A tile only falls back to the coloured panel + icon when it has no image.
 */
const FlavorsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  const { categories } = useCategories();
  const blocks: any[] = (section as any)?.blocks || [];

  const blockTiles: FlavorTile[] = blocks.map((b, i) => {
    const bs = b.settings || {};
    return {
      id: b.id,
      title: bs.title,
      subtitle: bs.subtitle,
      href: bs.cta_url || '/products',
      tint: bs.background || TINTS[i % TINTS.length],
      image: bs.image || undefined,
      fit: 'contain',
    };
  });
  const blocksHaveImages = blockTiles.some((b) => !!b.image);

  const categoryTiles: FlavorTile[] = (categories || []).slice(0, 3).map((c, i) => ({
    id: c._id,
    title: c.name,
    subtitle: c.description,
    href: `/categories/${c.slug}`,
    tint: TINTS[i % TINTS.length],
    image: c.image || undefined,
    fit: 'cover',
  }));

  const defaultTiles: FlavorTile[] = [
    { id: 'a', title: t('theme.section.milmaa-flavors.flavor_1_title', { defaultValue: 'BANANA MILK' }), subtitle: t('theme.section.milmaa-flavors.flavor_1_subtitle', { defaultValue: 'Sweet, creamy, naturally energizing' }), href: '/products', tint: YELLOW, fit: 'contain' },
    { id: 'b', title: t('theme.section.milmaa-flavors.flavor_2_title', { defaultValue: 'BADAM MILK' }), subtitle: t('theme.section.milmaa-flavors.flavor_2_subtitle', { defaultValue: 'Rich almond indulgence, iron-packed' }), href: '/products', tint: PINK, fit: 'contain' },
    { id: 'c', title: t('theme.section.milmaa-flavors.flavor_3_title', { defaultValue: 'CASHEWNUT MILK' }), subtitle: t('theme.section.milmaa-flavors.flavor_3_subtitle', { defaultValue: 'Buttery smooth, protein-rich' }), href: '/products', tint: TEAL, fit: 'contain' },
  ];

  const items: FlavorTile[] = blocksHaveImages
    ? blockTiles
    : categoryTiles.length > 0
      ? categoryTiles
      : blockTiles.length > 0
        ? blockTiles
        : defaultTiles;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-12">
        <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
          {s.heading || t('theme.section.milmaa-flavors.heading', { defaultValue: 'Our Delicious Flavors' })}
        </h2>
        {s.subheading && (
          <p className="mt-3 text-base opacity-70">{s.subheading}</p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.slice(0, 3).map((tile) => {
          const isDark = tile.tint === TEAL;
          const hasPhoto = !!tile.image && tile.fit === 'cover';
          return (
            <Link
              key={tile.id}
              to={tile.href}
              className="group relative block overflow-hidden rounded-[40px] aspect-[4/5] p-8"
              style={{ backgroundColor: tile.tint, color: isDark ? CREAM : DARK_TEAL }}
            >
              {tile.image ? (
                <img
                  src={tile.image}
                  alt=""
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className={
                    hasPhoto
                      ? 'absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105'
                      : 'absolute inset-0 w-full h-full object-contain p-8 transition-transform duration-700 group-hover:scale-110'
                  }
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 8h-1V6c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6h6v2H9V6zm9 14H6V10h12v10z" />
                  </svg>
                </div>
              )}
              {/* Pastel scrim keeps the copy legible over photography while staying on-palette. */}
              {hasPhoto && <div className="absolute inset-0 pointer-events-none" style={tintScrim(tile.tint)} />}
              <div className="relative h-full flex flex-col justify-end">
                <div className="text-[10px] tracking-[0.3em] uppercase mb-2 opacity-70">{t('theme.section.milmaa-flavors.flavor_label')}</div>
                <h3
                  className="font-serif text-3xl md:text-4xl font-bold leading-tight"
                  style={{ fontFamily: HEADING_FONT }}
                >
                  {tile.title}
                </h3>
                {tile.subtitle && <p className="text-sm mt-2 opacity-80 max-w-xs line-clamp-2">{tile.subtitle}</p>}
                <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold">
                  <span className="underline">{t('theme.section.milmaa-flavors.shop_now')}</span>
                  <span className="rtl:rotate-180">→</span>
                </div>
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
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 4;
  const source = (s.source as string) || 'featured';

  const featured = useFeaturedProducts(limit);
  const regular = useProducts({ sort: source === 'newest' ? 'newest' : 'popular', limit });
  const { products, loading } = source === 'featured' ? featured : regular;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-12">
        <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
          {s.heading || t('theme.section.milmaa-product-grid.heading', { defaultValue: 'Shop Our Milks' })}
        </h2>
        {s.subheading && <p className="mt-3 text-base opacity-70">{s.subheading}</p>}
      </div>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-[32px]" />
          ))}
        </div>
      ) : (
        <ProductRail columns={4}>
          {products.map((p: any) => (
            <MilmaaProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </ProductRail>
      )}
    </section>
  );
};

// ─── Benefits ─────────────────────────────────────────────────────

const BenefitsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { title: t('theme.section.milmaa-benefits.benefit_1_title', { defaultValue: 'Rich in calcium & vitamin D' }), description: t('theme.section.milmaa-benefits.benefit_1_description', { defaultValue: 'Each serving delivers your daily dose of essential minerals.' }) } },
    { id: 'b', settings: { title: t('theme.section.milmaa-benefits.benefit_2_title', { defaultValue: '100% plant-based' }), description: t('theme.section.milmaa-benefits.benefit_2_description', { defaultValue: 'No dairy, no lactose, no compromise on creaminess.' }) } },
    { id: 'c', settings: { title: t('theme.section.milmaa-benefits.benefit_3_title', { defaultValue: 'Zero added sugar' }), description: t('theme.section.milmaa-benefits.benefit_3_description', { defaultValue: 'Naturally sweetened — the way nature intended.' }) } },
  ];

  return (
    <section className="py-20" style={{ backgroundColor: MUTED }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="relative">
          <div className="aspect-square rounded-[48px] overflow-hidden" style={{ backgroundColor: PINK }}>
            {s.image ? (
              <img src={s.image as string} alt="" className="w-full h-full object-cover" />
            ) : (
              <img src="https://placehold.co/600x600/f7c1b7/2c4a4a?text=Why+Milmaa" alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="absolute -bottom-4 -end-4 w-28 h-28 rounded-full flex items-center justify-center text-center font-bold text-xs shadow-lg" style={{ backgroundColor: YELLOW, color: CREAM }}>
            {t('theme.section.milmaa-benefits.badge')}
          </div>
        </div>

        <div>
          {s.eyebrow && (
            <div className="text-[11px] tracking-[0.3em] uppercase font-bold mb-4" style={{ color: TEAL }}>
              {s.eyebrow}
            </div>
          )}
          <h2 className="font-serif text-4xl md:text-5xl font-semibold mb-8" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
            {s.heading || t('theme.section.milmaa-benefits.heading', { defaultValue: 'A healthier start to every day' })}
          </h2>
          <div className="space-y-5">
            {items.map((b, i) => {
              const bs = b.settings || {};
              return (
                <div key={b.id} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold" style={{ backgroundColor: TEAL, color: '#fff' }}>
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="font-serif text-xl font-semibold mb-1" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
                      {bs.title}
                    </h4>
                    <p className="text-sm opacity-70">{bs.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Blog ─────────────────────────────────────────────────────────

const BlogSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { title: t('theme.section.milmaa-blog.post_1_title', { defaultValue: 'Top 5 plant-based smoothie recipes' }), excerpt: t('theme.section.milmaa-blog.post_1_excerpt', { defaultValue: 'Kickstart your day with these nutritious blends.' }), date: 'Jun 12' } },
    { id: 'b', settings: { title: t('theme.section.milmaa-blog.post_2_title', { defaultValue: 'Why plant-based is the future' }), excerpt: t('theme.section.milmaa-blog.post_2_excerpt', { defaultValue: 'The science behind sustainable nutrition.' }), date: 'May 28' } },
    { id: 'c', settings: { title: t('theme.section.milmaa-blog.post_3_title', { defaultValue: 'Meet our farmers' }), excerpt: t('theme.section.milmaa-blog.post_3_excerpt', { defaultValue: 'The hands behind every bottle of Milmaa.' }), date: 'May 14' } },
  ];
  const tints = [YELLOW, PINK, TEAL];
  // Posts without an uploaded image borrow real store photography (category
  // photos first, then product shots) so the row never renders empty tints.
  const { categories } = useCategories();
  const { products } = useProducts({ sort: 'popular', limit: 6 });
  const fallbackImages: string[] = [
    ...(categories || []).map((c) => c.image).filter(Boolean),
    ...(products || []).map((p: any) => p.images?.[0]).filter(Boolean),
  ] as string[];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
        <div>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
            {s.heading || t('theme.section.milmaa-blog.heading', { defaultValue: 'From The Journal' })}
          </h2>
          {s.subheading && <p className="mt-2 opacity-70">{s.subheading}</p>}
        </div>
        <Link
          to="#"
          className="text-sm font-bold underline hover:opacity-60"
          style={{ color: DARK_TEAL }}
        >
          {t('theme.section.milmaa-blog.view_all')}
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.slice(0, 3).map((b, i) => {
          const bs = b.settings || {};
          const image: string | undefined = bs.image || fallbackImages[i % (fallbackImages.length || 1)];
          return (
            <Link key={b.id} to={bs.cta_url || '#'} className="group block">
              <div className="aspect-[4/3] rounded-[32px] overflow-hidden mb-4" style={{ backgroundColor: tints[i % tints.length] }}>
                {image ? (
                  <img src={image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
                  </div>
                )}
              </div>
              <div className="text-[11px] tracking-[0.2em] uppercase font-bold mb-2" style={{ color: TEAL }}>
                {bs.date || 'Jun 12'} · {t('theme.section.milmaa-blog.post_label')}
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2 line-clamp-2 group-hover:opacity-70" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
                {bs.title}
              </h3>
              {bs.excerpt && <p className="text-sm opacity-70 line-clamp-2">{bs.excerpt}</p>}
            </Link>
          );
        })}
      </div>
    </section>
  );
};

// ─── Testimonials ─────────────────────────────────────────────────

const TestimonialsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation('theme');
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { quote: t('theme.testimonial.tm-1.quote'), author: 'Sarah M.', role: t('theme.testimonial.tm-1.role') } },
    { id: 'b', settings: { quote: t('theme.testimonial.tm-2.quote'), author: 'David L.', role: t('theme.testimonial.tm-2.role') } },
    { id: 'c', settings: { quote: t('theme.testimonial.tm-3.quote'), author: 'Priya K.', role: t('theme.testimonial.tm-3.role') } },
  ];

  return (
    <section className="py-20" style={{ backgroundColor: CREAM }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
            {s.heading || t('theme.section.milmaa-testimonials.heading', { defaultValue: 'Customers Talk' })}
          </h2>
          {s.subheading && <p className="mt-3 opacity-70">{s.subheading}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((b, i) => {
            const bs = b.settings || {};
            return (
              <div key={b.id} className="bg-white rounded-[32px] p-8">
                <div className="flex mb-4">
                  {[1,2,3,4,5].map((j) => (
                    <svg key={j} className="w-4 h-4" fill={YELLOW} viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <p className="font-serif text-lg leading-relaxed mb-6 italic" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
                  "{bs.quote}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-current/10">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: TEAL, color: '#fff' }}>
                    {(bs.author || 'A').charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: DARK_TEAL }}>{bs.author}</div>
                    <div className="text-xs opacity-60">{bs.role}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── Instagram strip ──────────────────────────────────────────────

const INSTAGRAM_ICON_PATH =
  'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z';

const INSTAGRAM_TILE_COUNT = 6;

/**
 * Instagram strip. There is no feed integration, so the grid is a "shop the
 * feed" wall of the store's own photography: product shots first (linking to
 * the product), then category photos, cycling to fill six tiles. Only a store
 * with no imagery at all falls back to the pastel placeholder tiles.
 */
const InstagramSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const tints = [YELLOW, PINK, TEAL, MUTED, PINK, YELLOW];
  const { products } = useProducts({ sort: 'popular', limit: INSTAGRAM_TILE_COUNT });
  const { categories } = useCategories();

  const shots: Array<{ image: string; href: string }> = [];
  const seen = new Set<string>();
  for (const p of products || []) {
    for (const img of (p.images || []) as string[]) {
      if (img && !seen.has(img)) {
        seen.add(img);
        shots.push({ image: img, href: `/products/${p.slug}` });
      }
    }
  }
  for (const c of categories || []) {
    if (c.image && !seen.has(c.image)) {
      seen.add(c.image);
      shots.push({ image: c.image, href: `/categories/${c.slug}` });
    }
  }
  const tiles = shots.length > 0
    ? Array.from({ length: INSTAGRAM_TILE_COUNT }, (_, i) => shots[i % shots.length])
    : [];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-10">
        <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
          {s.heading || '@milmaa_milk'}
        </h2>
        {s.subheading && <p className="mt-3 opacity-70">{s.subheading}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {tiles.length > 0
          ? tiles.map((shot, i) => (
              <Link
                key={i}
                to={shot.href}
                className="aspect-square rounded-[24px] group relative overflow-hidden block"
                style={{ backgroundColor: tints[i % tints.length] }}
              >
                <img
                  src={shot.image}
                  alt=""
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Hover reveal — the instagram glyph over a soft dark-teal wash. */}
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ backgroundColor: 'rgba(44,74,74,0.45)', color: CREAM }}
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d={INSTAGRAM_ICON_PATH} />
                  </svg>
                </div>
              </Link>
            ))
          : tints.map((bg, i) => (
              <div
                key={i}
                className="aspect-square rounded-[24px] cursor-pointer group relative overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: bg }}
              >
                <svg className="w-10 h-10 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                  <path d={INSTAGRAM_ICON_PATH} />
                </svg>
              </div>
            ))}
      </div>
    </section>
  );
};

// ─── Registry ─────────────────────────────────────────────────────

export const MILMAA_SECTION_REGISTRY: Record<string, SectionComponent> = {
  ...DEFAULT_SECTION_REGISTRY,
  'milmaa-top-strip': TopStripSection,
  'milmaa-hero': HeroSection,
  'milmaa-flavors': FlavorsSection,
  'milmaa-product-grid': ProductGridSection,
  'milmaa-benefits': BenefitsSection,
  'milmaa-blog': BlogSection,
  'milmaa-testimonials': TestimonialsSection,
  'milmaa-instagram': InstagramSection,
  // Shadow universal feeds
  'featured-products': ProductGridSection,
  'new-arrivals': ProductGridSection,
  'product-grid': ProductGridSection,
};
