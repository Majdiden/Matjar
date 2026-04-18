import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts, useCategories } from '@shared/hooks/useProducts';
import { ProductCard } from '@shared/components/commerce/ProductCard';
import { Breadcrumbs } from '@shared/components/navigation/Breadcrumbs';
import { Pagination } from '@shared/components/navigation/Pagination';
import { GridListToggle } from '@shared/components/discovery/GridListToggle';
import { QuickView } from '@shared/components/discovery/QuickView';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { Drawer } from '@shared/components/primitives/Drawer';
import { useViewport } from '@shared/hooks/useViewport';
import type { Product } from '@shared/types/commerce';

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile } = useViewport();

  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';

  const { products, pagination, loading } = useProducts({
    page, sort, search, limit: 12,
    ...(category && { category }),
  });
  const { categories } = useCategories();

  const [searchInput, setSearchInput] = useState(search);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  const activeCategory = categories.find(c => c._id === category);

  // Filter sidebar content
  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-3">Categories</h3>
        <div className="space-y-1">
          <button
            onClick={() => updateParam('category', '')}
            className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition ${!category ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            All Products
          </button>
          {categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => updateParam('category', cat._id)}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition ${category === cat._id ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
            >
              {cat.name}
              {cat.productCount !== undefined && (
                <span className="text-gray-400 ml-1">({cat.productCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">Sort By</h3>
        <select
          value={sort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="popular">Most Popular</option>
          <option value="rating">Top Rated</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          ...(activeCategory ? [{ label: activeCategory.name }] : []),
        ]}
        className="mb-6"
      />

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <FilterContent />
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile filter button */}
              <button
                onClick={() => setFilterOpen(true)}
                className="lg:hidden flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
              </button>

              <h1 className="text-xl font-bold">
                {activeCategory?.name || 'All Products'}
              </h1>
              {pagination && (
                <span className="text-sm text-gray-500">({pagination.total} items)</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Sort (desktop) */}
              <select
                value={sort}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="hidden md:block px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="popular">Most Popular</option>
              </select>

              <GridListToggle view={view} onChange={setView} />
            </div>
          </div>

          {/* Search bar */}
          <form
            className="mb-6"
            onSubmit={(e) => { e.preventDefault(); updateParam('search', searchInput); }}
          >
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </form>

          {/* Products */}
          {loading ? (
            <Skeleton.ProductGrid count={8} columns={view === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'} />
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">&#128269;</div>
              <p className="text-gray-500 text-lg mb-2">No products found</p>
              {search && (
                <button
                  onClick={() => { setSearchInput(''); updateParam('search', ''); }}
                  className="text-sm underline"
                  style={{ color: 'var(--color-primary, #2563eb)' }}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={
                view === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6'
                  : 'space-y-3'
              }>
                {products.map((product: any) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    layout={view}
                    onQuickView={setQuickViewProduct}
                  >
                    <ProductCard.Image showBadge showQuickView={view === 'grid'} hoverSwap={view === 'grid'} />
                    <ProductCard.Body>
                      <ProductCard.Title lines={view === 'list' ? 2 : 1} />
                      <ProductCard.Rating />
                      <div className="flex items-center justify-between mt-2">
                        <ProductCard.Price showCompareAt />
                        <ProductCard.Actions />
                      </div>
                    </ProductCard.Body>
                  </ProductCard>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center mt-10">
                  <Pagination
                    currentPage={page}
                    totalPages={pagination.totalPages}
                    onPageChange={(p) => updateParam('page', String(p))}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <Drawer isOpen={filterOpen} onClose={() => setFilterOpen(false)} side="left" width="max-w-xs">
        <Drawer.Header onClose={() => setFilterOpen(false)}>Filters</Drawer.Header>
        <Drawer.Body>
          <FilterContent />
        </Drawer.Body>
      </Drawer>

      {/* Quick View */}
      <QuickView
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

export default Products;
