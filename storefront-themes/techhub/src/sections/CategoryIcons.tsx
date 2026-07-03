/**
 * CategoryIcons — TONMART-style row of circular category tiles.
 * Each tile is a pale round card with the category image (or an
 * SVG fallback) and the category name underneath.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import type { SectionComponentProps } from '@matjar/theme-shared/components/sections';

export const CategoryIconsSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { categories } = useCategories();

  const cols = Math.max(4, Math.min(8, Number(s.columns) || 6));
  const max = Math.max(4, Math.min(12, Number(s.max_categories) || 6));
  const list = categories.slice(0, max);

  if (list.length === 0) return null;

  return (
    <section className="py-14" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {list.map((cat) => (
            <Link
              key={cat._id}
              to={`/categories/${cat.slug}`}
              className="group flex flex-col items-center gap-3 p-6 rounded-lg transition-all hover:-translate-y-1"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-foreground) 4%, transparent)',
              }}
            >
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: 'var(--color-background)' }}
              >
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="h-10 w-10 object-contain"
                  />
                ) : (
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </div>
              <span
                className="text-xs font-semibold text-center line-clamp-1 transition-colors group-hover:text-[color:var(--color-primary)]"
                style={{ color: 'var(--color-foreground)' }}
              >
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryIconsSection;
