/**
 * CategoryIcons — photo-led category showcase.
 *
 * Each category is a tall image tile: the real category photo fills the
 * top (object-cover, 4:5), a soft navy gradient anchors the bottom edge,
 * and the name sits on a clean label row underneath with a green arrow
 * chip. Header row carries an eyebrow, heading and a "View all" link.
 *
 * Responsive: a horizontal snap-rail of fixed-width tiles on phones,
 * the merchant's `columns` grid from md up. All spacing uses logical
 * properties so it mirrors correctly in RTL.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import type { SectionComponentProps } from '@matjar/theme-shared/components/sections';

// Desktop column count → literal Tailwind class (JIT needs the full string).
const MD_COLS: Record<number, string> = {
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
  7: 'md:grid-cols-7',
  8: 'md:grid-cols-8',
};

// Tighter grids get a tighter type scale so the label row never crowds.
const LABEL_TEXT: Record<number, string> = {
  4: 'md:text-base',
  5: 'md:text-[15px]',
  6: 'md:text-sm',
  7: 'md:text-sm',
  8: 'md:text-[13px]',
};

export const CategoryIconsSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const { categories, loading } = useCategories();

  const cols = Math.max(4, Math.min(8, Number(s.columns) || 6));
  const max = Math.max(4, Math.min(12, Number(s.max_categories) || 6));
  const list = categories.slice(0, max);

  const eyebrow = s.eyebrow || t('theme.section.category_icons.eyebrow', { defaultValue: 'Shop by department' });
  const heading = s.heading || t('theme.section.category_icons.heading', { defaultValue: 'Browse categories' });
  const viewAllText = s.view_all_text || t('theme.section.category_icons.view_all', { defaultValue: 'View all' });
  const showViewAll = s.show_view_all !== false;

  if (list.length === 0 && !loading) return null;

  const railClass = `flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory md:mx-0 md:px-0 md:pb-0 md:grid md:gap-5 md:overflow-visible ${MD_COLS[cols] || 'md:grid-cols-6'}`;

  return (
    <section className="py-14 md:py-16" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4">
        {/* ── Header row ────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4 mb-7 md:mb-9">
          <div className="min-w-0">
            <div
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] mb-2"
              style={{ color: 'var(--color-primary)' }}
            >
              <span className="h-px w-6 shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} aria-hidden />
              {eyebrow}
            </div>
            <h2
              className="text-2xl md:text-3xl font-black tracking-tight leading-tight"
              style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-family-heading)' }}
            >
              {heading}
            </h2>
          </div>
          {showViewAll && (
            <Link
              to="/products"
              className="group shrink-0 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors hover:text-[color:var(--color-primary)]"
              style={{ color: 'var(--color-foreground)' }}
            >
              {viewAllText}
              <span
                data-cat-chip
                className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover:text-white"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                  color: 'var(--color-primary)',
                }}
              >
                <svg className="w-3.5 h-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
          )}
        </div>

        {/* ── Tiles ─────────────────────────────────────────────── */}
        <div className={railClass}>
          {list.length > 0
            ? list.map((cat, idx) => (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  className="group flex w-[156px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl md:w-auto"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-background)',
                    boxShadow: '0 1px 2px color-mix(in srgb, var(--color-foreground) 6%, transparent)',
                  }}
                >
                  {/* Photo */}
                  <div
                    className="relative aspect-[4/5] w-full overflow-hidden"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 5%, var(--color-background))' }}
                  >
                    {cat.image ? (
                      <img
                        src={cat.image}
                        alt=""
                        loading={idx < cols ? 'eager' : 'lazy'}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          background:
                            'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 22%, var(--color-background)), color-mix(in srgb, var(--color-foreground) 8%, var(--color-background)))',
                        }}
                      >
                        <span
                          className="text-5xl font-black leading-none select-none"
                          style={{ color: 'color-mix(in srgb, var(--color-primary) 70%, var(--color-foreground))' }}
                          aria-hidden
                        >
                          {(cat.name || '?').trim().charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {/* Navy anchor at the photo's foot so the label reads as one piece */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
                      style={{ background: 'linear-gradient(to top, rgba(15,23,42,0.35), transparent)' }}
                    />
                    {/* Green accent bar grows on hover */}
                    <span
                      aria-hidden
                      className="absolute bottom-0 start-0 h-1 w-0 transition-all duration-300 group-hover:w-full"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    />
                    {typeof cat.productCount === 'number' && cat.productCount > 0 && (
                      <span
                        className="absolute top-2.5 start-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur"
                        style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}
                      >
                        {t('theme.section.category_icons.items_count', { count: cat.productCount, defaultValue: '{{count}} items' })}
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex items-center justify-between gap-2 px-3.5 py-3">
                    <span
                      className={`min-w-0 text-sm font-semibold leading-snug break-words transition-colors group-hover:text-[color:var(--color-primary)] ${LABEL_TEXT[cols] || 'md:text-sm'}`}
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      {cat.name}
                    </span>
                    <span
                      data-cat-chip
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 group-hover:text-white"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                        color: 'var(--color-primary)',
                      }}
                      aria-hidden
                    >
                      <svg className="w-3.5 h-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </div>
                </Link>
              ))
            : Array.from({ length: Math.min(max, cols) }).map((_, i) => (
                <div
                  key={i}
                  className="w-[156px] shrink-0 snap-start overflow-hidden rounded-2xl border md:w-auto"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="aspect-[4/5] animate-pulse" style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 6%, transparent)' }} />
                  <div className="px-3.5 py-3">
                    <div className="h-3.5 w-2/3 rounded animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
                  </div>
                </div>
              ))}
        </div>
      </div>
      {/* Hover fill for the arrow chips — CSS so color-mix bg can swap cleanly */}
      <style>{`
        .group:hover [data-cat-chip] { background-color: var(--color-primary) !important; }
      `}</style>
    </section>
  );
};

export default CategoryIconsSection;
