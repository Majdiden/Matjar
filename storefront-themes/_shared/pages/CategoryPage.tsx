import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCategory, useCategories } from '../hooks/useProducts';
import { ProductCard } from '../components/commerce/ProductCard';
import { Skeleton } from '../components/primitives/Skeleton';
import { QuickView } from '../components/discovery/QuickView';
import { useThemeCard } from '../theme/ThemeCardProvider';
import type { Product } from '../types/commerce';

// Shared CategoryPage — theme-agnostic, driven by CSS vars (--color-primary,
// --color-secondary, --font-family-heading). Themes can override visually by
// keeping their own `src/pages/CategoryPage.tsx`; if they want the shared
// layout but with their own card, they can pass `renderCard`.

interface CategoryPageProps {
  className?: string;
  columns?: number;
  /** Render a custom product card — keeps shared layout, swaps the tile */
  renderCard?: (product: Product, onQuickView: (p: Product) => void) => React.ReactNode;
  /** Hide the sidebar (useful for narrow themes) */
  hideSidebar?: boolean;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
];

const CategoryPage: React.FC<CategoryPageProps> = ({
  className = '',
  columns = 3,
  renderCard: propRenderCard,
  hideSidebar = false,
}) => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quick, setQuick] = useState<Product | null>(null);
  const themeCard = useThemeCard();
  const renderCard =
    propRenderCard ||
    (themeCard ? ((p: Product, onQV: (p: Product) => void) => themeCard(p, onQV)) : undefined);

  const sort = searchParams.get('sort') || 'newest';
  const { category, products, loading } = useCategory(slug!, { sort, limit: 24 });
  const { categories: allCategories } = useCategories();

  const setSort = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', v);
    setSearchParams(next);
  };

  const gridCols =
    columns === 2 ? 'grid-cols-1 sm:grid-cols-2'
    : columns === 4 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
    : 'grid-cols-2 md:grid-cols-3';

  return (
    <div className={className}>
      {/* Banner */}
      <div
        className="py-14 border-b"
        style={{ backgroundColor: 'var(--color-secondary, #111)', color: 'var(--color-on-secondary, #fff)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="text-xs opacity-70 mb-3 flex items-center gap-2">
            <Link to="/" className="hover:opacity-100 hover:underline">Home</Link>
            <span>/</span>
            <Link to="/products" className="hover:opacity-100 hover:underline">Shop</Link>
            <span>/</span>
            <span className="opacity-100">{category?.name || slug}</span>
          </nav>
          <h1
            className="text-4xl md:text-5xl font-bold leading-tight"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {category?.name || slug}
          </h1>
          {category?.description && (
            <p className="mt-3 text-sm opacity-75 max-w-2xl">{category.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className={`grid grid-cols-1 gap-8 ${hideSidebar ? '' : 'lg:grid-cols-[260px_1fr]'}`}>
          {!hideSidebar && (
            <aside>
              <div className="rounded-lg border border-gray-200 bg-white">
                <h3
                  className="text-xs uppercase tracking-wider font-semibold px-5 py-3 border-b border-gray-200"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Categories
                </h3>
                <ul className="p-4 space-y-2 text-sm">
                  <li>
                    <Link to="/products" className="block px-2 py-1 rounded hover:bg-gray-100">
                      All Products
                    </Link>
                  </li>
                  {allCategories.slice(0, 14).map((cat) => (
                    <li key={cat._id}>
                      <Link
                        to={`/categories/${cat.slug}`}
                        className={`block px-2 py-1 rounded hover:bg-gray-100 ${
                          cat.slug === slug ? 'font-semibold' : ''
                        }`}
                        style={cat.slug === slug ? { color: 'var(--color-primary)' } : undefined}
                      >
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}

          <div>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-200">
              <span className="text-sm text-gray-600">
                {loading ? 'Loading…' : `${products.length} products`}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as any]: 'var(--color-primary)' }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className={`grid gap-5 ${gridCols}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                No products in this category yet.
              </div>
            ) : (
              <div className={`grid gap-5 ${gridCols}`}>
                {products.map((p: Product) =>
                  renderCard ? (
                    <React.Fragment key={p._id}>
                      {renderCard(p, setQuick)}
                    </React.Fragment>
                  ) : (
                    <ProductCard key={p._id} product={p} onQuickView={setQuick} />
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <QuickView product={quick} isOpen={!!quick} onClose={() => setQuick(null)} />
    </div>
  );
};

export default CategoryPage;
