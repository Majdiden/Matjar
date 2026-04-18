import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProducts, useCategories, useFeaturedProducts } from '@shared/hooks/useProducts';
import BeauxeProductCard from '../components/BeauxeProductCard';
import { QuickView } from '@shared/components/discovery/QuickView';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { useStore } from '@shared/contexts/StoreContext';

/**
 * Beauxe Products page — pink sidebar filters + rounded grid.
 *
 *   ─ Cream title banner with breadcrumb and serif h1
 *   ─ Body: left sidebar (categories / price / availability / BEST SELLER
 *     module) + right product grid
 */

const NAVY = 'var(--color-primary)';
const PINK = 'var(--color-secondary)';
const BLUSH = 'var(--color-muted)';

const FilterCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-3xl p-6 mb-6 border border-pink-100">
    <h3 className="text-[11px] tracking-[0.22em] uppercase font-bold mb-5 pb-3 border-b border-pink-100" style={{ color: NAVY }}>
      {title}
    </h3>
    {children}
  </div>
);

const BestSellerModule: React.FC = () => {
  const { products, loading } = useFeaturedProducts(3);
  const { formatPrice } = useStore();
  if (loading) return <Skeleton className="h-64 rounded-3xl" />;
  return (
    <FilterCard title="Best Sellers">
      <div className="space-y-4">
        {products.slice(0, 3).map((p: any) => (
          <Link key={p._id} to={`/products/${p.slug}`} className="flex gap-3 group">
            <div
              className="w-16 h-16 rounded-2xl overflow-hidden shrink-0"
            >
              <img
                src={p.images?.[0] || 'https://placehold.co/120x120/f8e4e4/fff?text=P'}
                alt={p.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex mb-1">
                {[1,2,3,4,5].map((i) => (
                  <svg key={i} className="w-3 h-3" fill={PINK} viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <div className="text-[12px] font-semibold line-clamp-1 group-hover:text-[var(--color-primary)]" style={{ color: NAVY }}>
                {p.name}
              </div>
              <div className="text-[13px] font-bold mt-0.5" style={{ color: NAVY }}>
                {formatPrice(p.price)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </FilterCard>
  );
};

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [quick, setQuick] = useState<any>(null);

  const selectedCategory = searchParams.get('category') || '';
  const availability = searchParams.get('availability') || '';
  const priceMin = Number(searchParams.get('min') || 0);
  const priceMax = Number(searchParams.get('max') || 0);
  const sort = searchParams.get('sort') || 'newest';

  const setParam = (k: string, v: string | number) => {
    const next = new URLSearchParams(searchParams);
    if (!v) next.delete(k);
    else next.set(k, String(v));
    setSearchParams(next);
  };

  const params = useMemo(() => {
    const p: Record<string, string | number> = { sort, limit: 24 };
    if (selectedCategory) p.category = selectedCategory;
    if (availability) p.availability = availability;
    if (priceMin) p.minPrice = priceMin;
    if (priceMax) p.maxPrice = priceMax;
    return p;
  }, [selectedCategory, availability, priceMin, priceMax, sort]);

  const { products, loading } = useProducts(params);
  const { categories } = useCategories();

  return (
    <div style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Title banner */}
      <div className="text-center py-16" style={{ backgroundColor: BLUSH }}>
        <div className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{ color: NAVY, opacity: 0.7 }}>
          <Link to="/" className="hover:opacity-100">Home</Link>
          <span className="mx-2">/</span>
          <span>Shop</span>
        </div>
        <h1
          className="font-serif text-5xl md:text-6xl"
          style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}
        >
          All Products
        </h1>
        <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: NAVY, opacity: 0.7 }}>
          Discover clean, conscious beauty crafted with love
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar */}
          <aside>
            <FilterCard title="Categories">
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button
                    onClick={() => setParam('category', '')}
                    className={`text-left transition ${selectedCategory === '' ? 'font-bold' : 'opacity-75 hover:opacity-100'}`}
                    style={{ color: NAVY }}
                  >
                    All Products
                  </button>
                </li>
                {categories.slice(0, 10).map((cat) => (
                  <li key={cat._id}>
                    <button
                      onClick={() => setParam('category', cat.slug)}
                      className={`text-left transition ${selectedCategory === cat.slug ? 'font-bold' : 'opacity-75 hover:opacity-100'}`}
                      style={{ color: NAVY }}
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </FilterCard>

            <FilterCard title="Availability">
              <div className="space-y-3 text-sm" style={{ color: NAVY }}>
                {[
                  { value: '', label: 'All' },
                  { value: 'in-stock', label: 'In stock' },
                  { value: 'out-of-stock', label: 'Out of stock' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="availability"
                      checked={availability === opt.value}
                      onChange={() => setParam('availability', opt.value)}
                      className="accent-[color:var(--color-secondary)]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </FilterCard>

            <FilterCard title="Price">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setParam('min', Number(e.target.value))}
                  placeholder="Min"
                  className="w-full border-b border-pink-200 py-2 text-sm focus:outline-none focus:border-[color:var(--color-secondary)] bg-transparent"
                />
                <span className="opacity-40">—</span>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setParam('max', Number(e.target.value))}
                  placeholder="Max"
                  className="w-full border-b border-pink-200 py-2 text-sm focus:outline-none focus:border-[color:var(--color-secondary)] bg-transparent"
                />
              </div>
            </FilterCard>

            <BestSellerModule />
          </aside>

          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-5 mb-8 border-b border-pink-100">
              <span className="text-sm opacity-75" style={{ color: NAVY }}>
                {loading ? 'Loading…' : `Showing ${products.length} products`}
              </span>
              <select
                value={sort}
                onChange={(e) => setParam('sort', e.target.value)}
                className="text-sm border border-pink-200 bg-white rounded-full px-5 py-2 pr-8 focus:outline-none focus:border-[color:var(--color-secondary)]"
                style={{ color: NAVY }}
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
                  <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24 opacity-60" style={{ color: NAVY }}>
                No products found. Try different filters.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {products.map((p) => (
                  <BeauxeProductCard key={p._id} product={p} onQuickView={setQuick} />
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

export default Products;
