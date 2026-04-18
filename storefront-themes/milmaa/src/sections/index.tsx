/**
 * Milmaa section registry + components.
 *
 * Pastel teal/cream/pink plant-based milk sections.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent, type SectionComponentProps } from '@shared/components/sections';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts } from '@shared/hooks/useProducts';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import MilmaaProductCard from '../components/MilmaaProductCard';

const TEAL = 'var(--color-primary)';
const DARK_TEAL = 'var(--color-foreground)';
const PINK = 'var(--color-accent)';
const YELLOW = 'var(--color-secondary)';
const CREAM = 'var(--color-background)';
const MUTED = 'var(--color-muted)';
const HEADING_FONT = 'var(--font-family-heading)';

// ─── Top strip ────────────────────────────────────────────────────

const TopStripSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  return (
    <div className="text-white text-[12px] py-2.5 text-center font-medium" style={{ backgroundColor: TEAL }}>
      {s.text || '🌱 100% Plant-Based · Free Shipping on Orders Over $40'}
    </div>
  );
};

// ─── Embrace Hero ─────────────────────────────────────────────────

const HeroSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: CREAM }}>
      {/* Pink blob decoration */}
      <div className="absolute -top-20 -right-20 w-[480px] h-[480px] rounded-full opacity-60" style={{ backgroundColor: PINK }} aria-hidden />
      <div className="absolute top-40 left-20 w-32 h-32 rounded-full opacity-50" style={{ backgroundColor: YELLOW }} aria-hidden />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          {s.eyebrow && (
            <div className="inline-block px-4 py-1.5 rounded-full text-[11px] tracking-[0.2em] uppercase font-bold mb-6" style={{ backgroundColor: TEAL, color: '#fff' }}>
              🌱 {s.eyebrow}
            </div>
          )}
          <h1
            className="font-serif text-5xl sm:text-6xl md:text-7xl leading-[1.05] font-semibold"
            style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}
          >
            {s.heading || 'Embracing the power of strength'}
          </h1>
          {s.subheading && (
            <p className="mt-6 text-base md:text-lg max-w-md leading-relaxed" style={{ color: DARK_TEAL, opacity: 0.75 }}>
              {s.subheading}
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-4 items-center">
            <Link
              to={(s.cta_url as string) || '/products'}
              className="inline-block px-8 py-4 rounded-full text-white text-sm font-bold hover:scale-105 transition"
              style={{ backgroundColor: DARK_TEAL }}
            >
              {s.cta_text || 'Shop Milk'} →
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 text-sm font-bold hover:opacity-60"
              style={{ color: DARK_TEAL }}
            >
              <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow">▶</span>
              Watch Story
            </Link>
          </div>
        </div>

        <div className="relative hidden md:block">
          <div className="aspect-[4/5] rounded-[60px] overflow-hidden relative" style={{ backgroundColor: YELLOW }}>
            {s.image ? (
              <img src={s.image as string} alt="" className="w-full h-full object-cover" />
            ) : (
              <img src="https://placehold.co/800x1000/f6dc68/2c4a4a?text=Milmaa+Milk" alt="" className="w-full h-full object-cover" />
            )}
            {/* Floating badge */}
            <div className="absolute top-6 right-6 w-24 h-24 rounded-full flex items-center justify-center text-center text-xs font-bold shadow-lg" style={{ backgroundColor: PINK, color: DARK_TEAL }}>
              100%<br />NATURAL
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Flavor panels ────────────────────────────────────────────────

const FlavorsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { title: 'BANANA MILK', subtitle: 'Sweet, creamy, naturally energizing', background: YELLOW } },
    { id: 'b', settings: { title: 'BADAM MILK', subtitle: 'Rich almond indulgence, iron-packed', background: PINK } },
    { id: 'c', settings: { title: 'CASHEWNUT MILK', subtitle: 'Buttery smooth, protein-rich', background: TEAL } },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-12">
        <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
          {s.heading || 'Our Delicious Flavors'}
        </h2>
        {s.subheading && (
          <p className="mt-3 text-base opacity-70">{s.subheading}</p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.slice(0, 3).map((b) => {
          const bs = b.settings || {};
          const isDark = bs.background === TEAL;
          return (
            <Link
              key={b.id}
              to={bs.cta_url || '/products'}
              className="group relative block overflow-hidden rounded-[40px] aspect-[4/5] p-8"
              style={{ backgroundColor: bs.background || YELLOW, color: isDark ? CREAM : DARK_TEAL }}
            >
              {bs.image && (
                <img
                  src={bs.image}
                  alt={bs.title}
                  className="absolute inset-0 w-full h-full object-contain p-8 transition-transform duration-700 group-hover:scale-110"
                />
              )}
              {!bs.image && (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 8h-1V6c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6h6v2H9V6zm9 14H6V10h12v10z" />
                  </svg>
                </div>
              )}
              <div className="relative h-full flex flex-col justify-end">
                <div className="text-[10px] tracking-[0.3em] uppercase mb-2 opacity-70">Flavor</div>
                <h3
                  className="font-serif text-3xl md:text-4xl font-bold leading-tight"
                  style={{ fontFamily: HEADING_FONT }}
                >
                  {bs.title}
                </h3>
                {bs.subtitle && <p className="text-sm mt-2 opacity-80 max-w-xs">{bs.subtitle}</p>}
                <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold">
                  <span className="underline">Shop now</span>
                  <span>→</span>
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
          {s.heading || 'Shop Our Milks'}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((p: any) => (
            <MilmaaProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </div>
      )}
    </section>
  );
};

// ─── Benefits ─────────────────────────────────────────────────────

const BenefitsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { title: 'Rich in calcium & vitamin D', description: 'Each serving delivers your daily dose of essential minerals.' } },
    { id: 'b', settings: { title: '100% plant-based', description: 'No dairy, no lactose, no compromise on creaminess.' } },
    { id: 'c', settings: { title: 'Zero added sugar', description: 'Naturally sweetened — the way nature intended.' } },
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
          <div className="absolute -bottom-4 -right-4 w-28 h-28 rounded-full flex items-center justify-center text-center font-bold text-xs shadow-lg" style={{ backgroundColor: YELLOW, color: DARK_TEAL }}>
            CERTIFIED<br />ORGANIC
          </div>
        </div>

        <div>
          {s.eyebrow && (
            <div className="text-[11px] tracking-[0.3em] uppercase font-bold mb-4" style={{ color: TEAL }}>
              {s.eyebrow}
            </div>
          )}
          <h2 className="font-serif text-4xl md:text-5xl font-semibold mb-8" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
            {s.heading || 'A healthier start to every day'}
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
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { title: 'Top 5 plant-based smoothie recipes', excerpt: 'Kickstart your day with these nutritious blends.', date: 'Jun 12' } },
    { id: 'b', settings: { title: 'Why plant-based is the future', excerpt: 'The science behind sustainable nutrition.', date: 'May 28' } },
    { id: 'c', settings: { title: 'Meet our farmers', excerpt: 'The hands behind every bottle of Milmaa.', date: 'May 14' } },
  ];
  const tints = [YELLOW, PINK, TEAL];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
        <div>
          <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
            {s.heading || 'From The Journal'}
          </h2>
          {s.subheading && <p className="mt-2 opacity-70">{s.subheading}</p>}
        </div>
        <Link
          to="#"
          className="text-sm font-bold underline hover:opacity-60"
          style={{ color: DARK_TEAL }}
        >
          View all articles →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.slice(0, 3).map((b, i) => {
          const bs = b.settings || {};
          return (
            <Link key={b.id} to={bs.cta_url || '#'} className="group block">
              <div className="aspect-[4/3] rounded-[32px] overflow-hidden mb-4" style={{ backgroundColor: tints[i % tints.length] }}>
                {bs.image ? (
                  <img src={bs.image} alt={bs.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
                  </div>
                )}
              </div>
              <div className="text-[11px] tracking-[0.2em] uppercase font-bold mb-2" style={{ color: TEAL }}>
                {bs.date || 'Jun 12'} · RECIPE
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
  const s = useThemeSettings(id);
  const blocks: any[] = (section as any)?.blocks || [];
  const items = blocks.length > 0 ? blocks : [
    { id: 'a', settings: { quote: 'The creamiest plant milk I have ever tasted!', author: 'Sarah M.', role: 'Busy Mom' } },
    { id: 'b', settings: { quote: 'Perfect for my morning oats. Clean ingredients.', author: 'David L.', role: 'Yoga Instructor' } },
    { id: 'c', settings: { quote: 'Finally a non-dairy milk that actually tastes like milk!', author: 'Priya K.', role: 'Foodie' } },
  ];

  return (
    <section className="py-20" style={{ backgroundColor: CREAM }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
            {s.heading || 'Customers Talk'}
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

const InstagramSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const tints = [YELLOW, PINK, TEAL, MUTED, PINK, YELLOW];
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-center mb-10">
        <h2 className="font-serif text-4xl md:text-5xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
          {s.heading || '@milmaa_milk'}
        </h2>
        {s.subheading && <p className="mt-3 opacity-70">{s.subheading}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {tints.map((bg, i) => (
          <div
            key={i}
            className="aspect-square rounded-[24px] cursor-pointer group relative overflow-hidden flex items-center justify-center"
            style={{ backgroundColor: bg }}
          >
            <svg className="w-10 h-10 opacity-30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
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
