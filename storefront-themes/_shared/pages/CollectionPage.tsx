import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCollection } from '../hooks/useCollections';
import { ProductCard } from '../components/commerce/ProductCard';
import { Skeleton } from '../components/primitives/Skeleton';
import { useThemeCard } from '../theme/ThemeCardProvider';
import type { Product } from '../types/commerce';

interface CollectionPageProps {
  className?: string;
  accentColor?: string;
  columns?: number;
  onQuickView?: (product: Product) => void;
  renderCard?: (product: Product) => React.ReactNode;
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'name-asc', label: 'Name: A-Z' },
];

const CollectionPage: React.FC<CollectionPageProps> = ({
  className = '',
  accentColor,
  columns = 4,
  onQuickView,
  renderCard: propRenderCard,
}) => {
  const themeCard = useThemeCard();
  const renderCard =
    propRenderCard ||
    (themeCard ? ((p: Product) => themeCard(p, onQuickView)) : undefined);
  const { handle = '' } = useParams();
  const [sort, setSort] = useState('featured');
  const [page, setPage] = useState(1);
  const limit = 24;

  const { collection, products, pagination, loading, error } = useCollection(handle, {
    sort,
    page,
    limit,
  });

  if (!loading && !collection && !error) {
    return (
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center ${className}`}>
        <h1 className="text-2xl font-bold mb-2">Collection not found</h1>
        <p className="text-gray-500 mb-6">The collection you're looking for doesn't exist.</p>
        <Link
          to="/collections"
          className="inline-block px-6 py-3 rounded-lg text-white font-medium transition hover:opacity-90"
          style={{ backgroundColor: accentColor || 'var(--color-primary, #2563eb)' }}
        >
          Browse Collections
        </Link>
      </div>
    );
  }

  const totalPages = pagination?.totalPages || 1;

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 py-8 ${className}`}>
      {loading && !collection ? (
        <div className="animate-pulse mb-8">
          <div className="aspect-[3/1] bg-gray-200 rounded-lg mb-4" />
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      ) : collection ? (
        <div className="mb-8">
          {(collection.image || collection.imageUrl) && (
            <div className="relative aspect-[3/1] rounded-lg overflow-hidden mb-6 bg-gray-100">
              <img
                src={collection.image || collection.imageUrl}
                alt={collection.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text, #111)' }}>
            {collection.name}
          </h1>
          {collection.description && (
            <p className="text-gray-600 max-w-2xl">{collection.description}</p>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          {loading
            ? 'Loading...'
            : `${pagination?.total ?? products.length} ${
                (pagination?.total ?? products.length) === 1 ? 'product' : 'products'
              }`}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="collection-sort" className="text-sm text-gray-600">
            Sort by:
          </label>
          <select
            id="collection-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="border rounded-md px-3 py-1.5 text-sm bg-white"
            style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Skeleton.ProductGrid count={8} />
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold mb-2">No products in this collection</h2>
          <p className="text-gray-500 mb-6">Check back soon.</p>
          <Link
            to="/products"
            className="inline-block px-6 py-3 rounded-lg text-white font-medium transition hover:opacity-90"
            style={{ backgroundColor: accentColor || 'var(--color-primary, #2563eb)' }}
          >
            Browse All Products
          </Link>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-2 md:grid-cols-${columns} gap-4 md:gap-6`}>
            {products.map((product: Product) =>
              renderCard ? (
                renderCard(product)
              ) : (
                <ProductCard key={product._id} product={product} onQuickView={onQuickView}>
                  <ProductCard.Image showBadge showQuickView={!!onQuickView} />
                  <ProductCard.Body>
                    <ProductCard.Title />
                    <ProductCard.Rating />
                    <div className="flex items-center justify-between mt-2">
                      <ProductCard.Price showCompareAt />
                      <ProductCard.Actions addToCartText="Add" />
                    </div>
                  </ProductCard.Body>
                </ProductCard>
              )
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 border rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CollectionPage;
