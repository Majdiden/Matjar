/**
 * CategorySidebar — techhub-specific "mega category" block.
 *
 * Renders a two-column strip: a vertical category sidebar with icons +
 * hover highlight on the left, and a large promo/feature panel on the
 * right. Great for electronics stores where shoppers navigate by
 * category first.
 *
 * Exposed as section type `category-sidebar`.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { useCategories, useProducts } from '@shared/hooks/useProducts';
import { PriceDisplay } from '@shared/components/commerce/PriceDisplay';
import type { SectionComponentProps } from '@shared/components/sections';
import { useTranslation } from 'react-i18next';

export const CategorySidebarSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const { categories } = useCategories();
  const limit = Math.max(3, Math.min(12, Number(s.max_categories) || 8));
  const displayed = categories.slice(0, limit);

  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const active = hoveredSlug || displayed[0]?.slug;

  // Pull a few products scoped to the active category to preview on the right.
  const { products: previewProducts } = useProducts({
    category: active,
    limit: 4,
  });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--color-primary)' }}>
            {s.eyebrow || t('theme.section.category_sidebar.eyebrow')}
          </div>
          <h2 className="text-3xl md:text-4xl font-black" style={{ color: 'var(--color-foreground)' }}>
            {s.heading || t('theme.section.category_sidebar.title')}
          </h2>
        </div>
        <Link
          to="/categories"
          className="text-sm font-semibold hidden md:inline-flex items-center gap-1"
          style={{ color: 'var(--color-primary)' }}
        >
          {s.view_all_text || t('theme.section.category_sidebar.view_all')}
          <span aria-hidden className="rtl:rotate-180 inline-block">→</span>
        </Link>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <nav
          className="rounded-2xl border p-2 h-fit sticky top-24"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-background) 80%, transparent)' }}
          aria-label={t('common:aria.categories')}
        >
          <ul className="flex flex-col">
            {displayed.map((cat) => {
              const isActive = cat.slug === active;
              return (
                <li key={cat._id}>
                  <Link
                    to={`/categories/${cat.slug}`}
                    onMouseEnter={() => setHoveredSlug(cat.slug)}
                    onFocus={() => setHoveredSlug(cat.slug)}
                    className="group flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                    style={{
                      backgroundColor: isActive
                        ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                        : 'transparent',
                      color: isActive ? 'var(--color-primary)' : 'var(--color-foreground)',
                    }}
                  >
                    {cat.image ? (
                      <img
                        src={cat.image}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        {cat.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-sm flex-1 line-clamp-1">{cat.name}</span>
                    <svg
                      className={`w-4 h-4 transition-transform rtl:rotate-180 ${isActive ? 'translate-x-0.5 rtl:-translate-x-0.5' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Preview panel */}
        <div
          className="rounded-2xl border p-6 md:p-8 relative overflow-hidden min-h-[440px]"
          style={{
            borderColor: 'var(--color-border)',
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 12%, var(--color-background)) 0%, var(--color-background) 100%)',
          }}
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-primary)' }}>
                {t('theme.section.category_sidebar.featured_in')}
              </div>
              <h3 className="text-2xl font-bold" style={{ color: 'var(--color-foreground)' }}>
                {displayed.find((c) => c.slug === active)?.name || t('theme.section.category_sidebar.view_all')}
              </h3>
            </div>
            <Link
              to={`/categories/${active}`}
              className="text-sm font-semibold inline-flex items-center gap-1"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('theme.section.category_sidebar.browse')}
              <span aria-hidden className="rtl:rotate-180 inline-block">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {previewProducts.slice(0, 4).map((p) => (
              <Link
                key={p._id}
                to={`/products/${p.slug}`}
                className="group block rounded-xl border overflow-hidden transition-all hover:-translate-y-0.5"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={p.images?.[0] || 'https://placehold.co/300x300?text=Product'}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold line-clamp-1 mb-1" style={{ color: 'var(--color-foreground)' }}>
                    {p.name}
                  </div>
                  <PriceDisplay price={p.price} compareAtPrice={p.compareAtPrice} size="sm" />
                </div>
              </Link>
            ))}
            {previewProducts.length === 0 &&
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl border animate-pulse"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
                  }}
                />
              ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategorySidebarSection;
