import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCategory, useCategories } from '@shared/hooks/useProducts';
import GlowingProductCard from '../components/GlowingProductCard';
import { QuickView } from '@shared/components/discovery/QuickView';
import { Skeleton } from '@shared/components/primitives/Skeleton';

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
    <div className="bg-white">
      {/* Title banner */}
      <div className="text-center py-16 border-b border-neutral-100">
        <div className="text-[11px] tracking-[0.3em] uppercase text-neutral-500 mb-4">
          <Link to="/" className="hover:text-black">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/products" className="hover:text-black">Shop</Link>
          <span className="mx-2">/</span>
          <span className="text-black">{category?.name || slug}</span>
        </div>
        <h1
          className="font-display text-5xl md:text-6xl text-black"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {category?.name || slug}
        </h1>
        {category?.description && (
          <p className="mt-3 text-sm text-neutral-500 max-w-md mx-auto">{category.description}</p>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
          {/* Sidebar — sibling categories */}
          <aside>
            <h3 className="text-[11px] tracking-[0.22em] uppercase font-semibold text-black mb-5 pb-3 border-b border-neutral-200">
              Collections
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/products" className="text-neutral-600 hover:text-black">
                  All Products
                </Link>
              </li>
              {allCategories.slice(0, 12).map((cat) => (
                <li key={cat._id}>
                  <Link
                    to={`/categories/${cat.slug}`}
                    className={`${cat.slug === slug ? 'text-black font-semibold' : 'text-neutral-600 hover:text-black'}`}
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-6 mb-8 border-b border-neutral-100">
              <span className="text-sm text-neutral-600">
                {loading ? 'Loading…' : `${products.length} products`}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-sm border-b border-neutral-300 bg-transparent py-1 pr-6 focus:outline-none focus:border-black"
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24 text-neutral-500">No products in this category yet.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-12">
                {products.map((p) => (
                  <GlowingProductCard key={p._id} product={p} onQuickView={setQuick} />
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
