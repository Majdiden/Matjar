import React from 'react';
import { Link } from 'react-router-dom';
import { useCollections } from '../hooks/useCollections';

interface CollectionsIndexProps {
  className?: string;
  accentColor?: string;
  columns?: number;
}

const CollectionsIndex: React.FC<CollectionsIndexProps> = ({
  className = '',
  accentColor,
  columns = 3,
}) => {
  const { collections, loading, error } = useCollections();

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 py-10 ${className}`}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text, #111)' }}>
          Collections
        </h1>
        <p className="text-gray-500 text-sm">
          Curated groups of products for every occasion.
        </p>
      </div>

      {loading ? (
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-${columns} gap-6`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/3] bg-gray-200 rounded-lg mb-3" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-gray-500">{error}</div>
      ) : collections.length === 0 ? (
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold mb-2">No collections yet</h2>
          <p className="text-gray-500 mb-6">Check back soon — collections are on the way.</p>
          <Link
            to="/products"
            className="inline-block px-6 py-3 rounded-lg text-white font-medium transition hover:opacity-90"
            style={{ backgroundColor: accentColor || 'var(--color-primary, #2563eb)' }}
          >
            Browse All Products
          </Link>
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-${columns} gap-6`}>
          {collections.map((c: any) => {
            const img = c.image || c.imageUrl || 'https://placehold.co/600x450?text=Collection';
            return (
              <Link
                key={c._id || c.handle}
                to={`/collections/${c.handle}`}
                className="group block rounded-lg overflow-hidden border hover:shadow-lg transition"
                style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                  <img
                    src={img}
                    alt={c.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text, #111)' }}>
                    {c.name}
                  </h3>
                  {typeof c.productCount === 'number' && (
                    <p className="text-xs text-gray-500 mt-1">
                      {c.productCount} {c.productCount === 1 ? 'product' : 'products'}
                    </p>
                  )}
                  {c.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.description}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CollectionsIndex;
