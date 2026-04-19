/**
 * HeroShowcase — TONMART-style tripartite hero.
 *
 * Layout:
 *   ┌─ top shipping strip ────────────────────────────────────┐
 *   │  hotline · shipping · flash-deal label                  │
 *   ├──────────┬─────────────────────────────┬────────────────┤
 *   │ category │  dark spotlight product     │  flash-deal    │
 *   │ sidebar  │  with heading + SHOP NOW    │  product card  │
 *   └──────────┴─────────────────────────────┴────────────────┘
 *
 * Data sources: `useCategories()` for the left rail, `useFeaturedProducts`
 * / `useProducts({sort:'newest'})` for the spotlight, `useProducts({onSale:1})`
 * for the flash-deal card.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import {
  useCategories,
  useFeaturedProducts,
  useProducts,
} from '@shared/hooks/useProducts';
import { useCollections } from '@shared/hooks/useCollections';
import { PriceDisplay } from '@shared/components/commerce/PriceDisplay';
import type { SectionComponentProps } from '@shared/components/sections';
import { useTranslation } from 'react-i18next';

export const HeroShowcaseSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);

  const maxCategories = Math.max(4, Math.min(14, Number(s.max_categories) || 10));
  const { categories, loading: catLoading } = useCategories();
  const { collections, loading: colLoading } = useCollections();
  // Prefer categories; fall back to collections so the rail is never empty
  // when a tenant organizes their catalog one way but not the other.
  const browseItems: { _id: string; name: string; slug: string; to: string }[] =
    categories.length > 0
      ? categories.slice(0, maxCategories).map((c: any) => ({
          _id: c._id,
          name: c.name,
          slug: c.slug,
          to: `/categories/${c.slug}`,
        }))
      : collections.slice(0, maxCategories).map((c: any) => ({
          _id: c._id,
          name: c.name || c.title,
          slug: c.handle || c.slug,
          to: `/collections/${c.handle || c.slug}`,
        }));
  const browseLoading = catLoading && colLoading;

  const source: 'featured' | 'newest' = s.product_source === 'newest' ? 'newest' : 'featured';
  const { products: featured } = useFeaturedProducts(1);
  const { products: newest } = useProducts({ sort: 'newest', limit: 1 });
  const spotlight = (source === 'newest' ? newest : featured)[0];

  const { products: deals } = useProducts({ onSale: 1, limit: 1 });
  const deal = deals[0];

  return (
    <section className="relative" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Top strip — hotline · shipping · flash deal label */}
      <div
        className="border-y text-[11px] font-semibold uppercase tracking-wider"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-muted)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-11">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center h-6 w-6 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
              aria-hidden
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2l2 5-3 2a12 12 0 006 6l2-3 5 2v2a2 2 0 01-2 2A16 16 0 013 5z" />
              </svg>
            </span>
            <span className="hidden sm:inline">{s.hotline_label || t('theme.hero.showcase.hotline_label')}</span>
            <span style={{ color: 'var(--color-foreground)' }}>{s.hotline_phone || '+1 (555) 456-7890'}</span>
          </div>
          <div className="hidden md:block text-center">
            <Link to="/products" className="hover:opacity-80 transition">
              {s.shipping_strip || t('theme.hero.showcase.shipping_strip')}
            </Link>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
            {s.flash_deal_label || t('theme.hero.showcase.flash_deal_label')}
          </div>
        </div>
      </div>

      {/* Tripartite grid */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid gap-4 lg:grid-cols-[240px_1fr_260px]">
        {/* ── Left rail: category list ───────────────────────────── */}
        <aside>
          <div
            className="rounded-t-md px-4 py-3 text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {s.sidebar_heading || t('theme.hero.showcase.sidebar_heading')}
          </div>
          <ul
            className="rounded-b-md border border-t-0 divide-y"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {browseItems.length > 0 ? browseItems.map((item) => (
              <li key={item._id} style={{ borderColor: 'var(--color-border)' }}>
                <Link
                  to={item.to}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition hover:ps-5"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--color-muted)' }} />
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            )) : browseLoading ? Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="px-4 py-2.5">
                <div className="h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--color-border)', width: `${60 + (i * 7) % 30}%` }} />
              </li>
            )) : (
              <li className="px-4 py-4 text-[12px]" style={{ color: 'var(--color-muted)' }}>
                <Link to="/products" className="hover:underline">{t('theme.section.category_sidebar.browse_all_products')}</Link>
              </li>
            )}
          </ul>
        </aside>

        {/* ── Center: light spotlight panel ───────────────────────── */}
        <div
          className="relative rounded-lg overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 8%, var(--color-background)) 0%, var(--color-background) 50%, color-mix(in srgb, var(--color-accent) 8%, var(--color-background)) 100%)',
          }}
        >
          <div className="relative grid md:grid-cols-2 gap-6 px-8 md:px-12 py-12 md:py-16 items-center min-h-[360px]">
            <div>
              {s.eyebrow && (
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.25em] mb-3"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {s.eyebrow}
                </div>
              )}
              <h1
                className="text-4xl md:text-5xl font-black leading-none tracking-tight mb-6"
                style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-family-heading)' }}
              >
                {s.heading_line1 || 'WIRELESS'}
                {s.heading_line2 && (
                  <>
                    <br />
                    {s.heading_line2}
                  </>
                )}
              </h1>
              <Link
                to={s.primary_button_url || '/products'}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-xs font-bold uppercase tracking-wider text-white transition-all hover:-translate-y-0.5"
                style={{
                  backgroundColor: 'var(--color-foreground)',
                }}
              >
                {s.primary_button_text || t('theme.hero.showcase.cta')}
                <svg className="w-3.5 h-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
            <div className="relative hidden md:flex items-center justify-center">
              {spotlight ? (
                <Link to={`/products/${spotlight.slug}`} className="block relative">
                  <div
                    aria-hidden
                    className="absolute inset-0 blur-3xl opacity-40"
                    style={{
                      background: 'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-primary) 35%, transparent), transparent 60%)',
                    }}
                  />
                  <img
                    src={spotlight.images?.[0] || 'https://placehold.co/400x400/eef4ff/0f172a?text=Product'}
                    alt={spotlight.name}
                    className="relative max-h-[300px] w-auto object-contain drop-shadow-xl"
                  />
                </Link>
              ) : (
                <div className="h-[280px] w-[280px] rounded-2xl animate-pulse" style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, transparent)' }} />
              )}
            </div>
          </div>

          {/* Slider dot pagination */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: 'var(--color-primary)' }} />
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 20%, transparent)' }} />
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 20%, transparent)' }} />
          </div>
        </div>

        {/* ── Right: flash-deal card ──────────────────────────────── */}
        <aside>
          {deal ? (
            <Link
              to={`/products/${deal.slug}`}
              className="block rounded-lg border overflow-hidden transition hover:shadow-md"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-background)',
              }}
            >
              <div
                className="aspect-square flex items-center justify-center p-6"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, transparent)' }}
              >
                <img
                  src={deal.images?.[0] || 'https://placehold.co/300x300?text=Deal'}
                  alt={deal.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
                  {deal.brand || 'Manufacturer'}
                </p>
                <h3 className="text-sm font-semibold line-clamp-2 mb-2" style={{ color: 'var(--color-foreground)' }}>
                  {deal.name}
                </h3>
                <PriceDisplay price={deal.price} compareAtPrice={deal.compareAtPrice} size="sm" />
              </div>
            </Link>
          ) : (
            <div
              className="h-full min-h-[340px] rounded-lg border animate-pulse"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, transparent)' }}
            />
          )}
        </aside>
      </div>
    </section>
  );
};

export default HeroShowcaseSection;
