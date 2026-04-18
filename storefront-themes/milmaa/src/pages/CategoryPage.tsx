import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCategory, useCategories } from '@shared/hooks/useProducts';
import MilmaaProductCard from '../components/MilmaaProductCard';
import { QuickView } from '@shared/components/discovery/QuickView';
import { Skeleton } from '@shared/components/primitives/Skeleton';

const DARK_TEAL = 'var(--color-foreground)';
const PINK = 'var(--color-accent)';
const CREAM = 'var(--color-background)';
const MUTED = 'var(--color-muted)';
const HEADING_FONT = 'var(--font-family-heading)';

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quick, setQuick] = useState<any>(null);

  const sort = searchParams.get('sort') || 'newest';
  const { category, products, loading } = useCategory(slug!, { sort, limit: 24 });
  const { categories: allCategories } = useCategories();

  const setSort = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', v);
    setSearchParams(next);
  };

  return (
    <div style={{ backgroundColor: CREAM }}>
      {/* Title banner */}
      <div className="relative overflow-hidden py-20" style={{ backgroundColor: MUTED }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-60" style={{ backgroundColor: PINK }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="text-[11px] tracking-[0.3em] uppercase mb-3 font-bold opacity-70" style={{ color: DARK_TEAL }}>
            <Link to="/" className="hover:opacity-100">HOME</Link>
            <span className="mx-2">/</span>
            <Link to="/products" className="hover:opacity-100">SHOP</Link>
            <span className="mx-2">/</span>
            <span>{category?.name || slug}</span>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
            {category?.name || slug}
          </h1>
          {category?.description && (
            <p className="mt-4 text-base max-w-md mx-auto opacity-75" style={{ color: DARK_TEAL }}>{category.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          <aside>
            <div className="bg-white rounded-[28px] p-6">
              <h3 className="font-serif text-lg font-bold mb-4 pb-3 border-b border-current/10" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
                Collections
              </h3>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/products" className="opacity-70 hover:opacity-100" style={{ color: DARK_TEAL }}>
                    All Products
                  </Link>
                </li>
                {allCategories.slice(0, 12).map((cat) => (
                  <li key={cat._id}>
                    <Link
                      to={`/categories/${cat.slug}`}
                      className={`transition ${cat.slug === slug ? 'font-bold' : 'opacity-70 hover:opacity-100'}`}
                      style={{ color: DARK_TEAL }}
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div>
            <div className="flex items-center justify-between pb-5 mb-8 border-b-2 border-current/10">
              <span className="text-sm opacity-70" style={{ color: DARK_TEAL }}>
                {loading ? 'Loading…' : `${products.length} products`}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-sm bg-white rounded-full px-5 py-2.5 pr-8 focus:outline-none font-medium"
                style={{ color: DARK_TEAL }}
              >
                <option value="newest">Sort: Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-[32px]" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24 opacity-60" style={{ color: DARK_TEAL }}>
                No products in this category yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {products.map((p) => (
                  <MilmaaProductCard key={p._id} product={p} onQuickView={setQuick} />
                ))}
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
