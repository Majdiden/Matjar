import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../hooks/useWishlist';
import { useCart } from '../contexts/CartContext';
import { useThemeCard } from '../theme/ThemeCardProvider';
import { useTranslation } from 'react-i18next';

/**
 * Standalone wishlist page, mounted at /wishlist in every theme.
 *
 * Styling uses neutral utility classes plus CSS custom properties
 * (`--color-primary`, `--color-surface`, `--color-text`) so each theme's
 * design tokens cascade in. Layouts/headers are untouched per task spec.
 */
interface WishlistProps {
  /** Render a theme-specific product card. Falls back to the built-in tile. */
  renderCard?: (product: any, onRemove: () => void) => React.ReactNode;
}

const Wishlist: React.FC<WishlistProps> = ({ renderCard: propRenderCard }) => {
  const themeCard = useThemeCard();
  const { t } = useTranslation(['account']);
  // Route-level prop wins over the theme-wide provider; both fall back to the
  // built-in tile rendered lower in this file.
  const renderCard =
    propRenderCard || (themeCard ? ((p: any, _onRemove: () => void) => themeCard(p)) : undefined);
  const { items, loading, error, toggle } = useWishlist();
  const { addItem } = useCart();
  const [busy, setBusy] = useState<string | null>(null);

  // Guests keep a local wishlist; signed-in customers keep a server one.
  // We no longer gate the page behind login — instead we show a gentle
  // "sign in to keep these" banner for guests who have items.
  const isLoggedIn =
    typeof localStorage !== 'undefined' && !!localStorage.getItem('customer_token');

  const handleRemove = async (productId: string) => {
    setBusy(productId);
    try {
      // The hook's toggle handles both guest (localStorage) and server modes
      // and updates the shared store, so no manual refresh is needed.
      await toggle(productId);
    } finally {
      setBusy(null);
    }
  };

  const handleAddToCart = async (productId: string) => {
    setBusy(productId);
    try {
      await addItem(productId, 1);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl md:text-3xl font-semibold mb-6" style={{ color: 'var(--color-text, #111)' }}>
        {t('wishlist.title')}
      </h1>

      {!isLoggedIn && !loading && items.length > 0 && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"
          style={{ borderColor: 'var(--color-border, #e5e7eb)', background: 'var(--color-surface, #fff)' }}
        >
          <span style={{ color: 'var(--color-text-muted, #6b7280)' }}>
            {t('wishlist.login_prompt')}
          </span>
          <Link
            to="/login?return=/wishlist"
            className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--color-primary, #111)' }}
          >
            {t('wishlist.login_action')}
          </Link>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border, #e5e7eb)' }}>
              <div className="aspect-square bg-gray-100 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="text-sm text-red-600 py-6">{error}</div>
      )}

      {!loading && !error && items.length === 0 && (
        <div
          className="text-center py-16 border border-dashed rounded-2xl"
          style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
        >
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted, #6b7280)' }}>
            {t('wishlist.empty.description')}
          </p>
          <Link
            to="/products"
            className="inline-block px-5 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--color-primary, #111)' }}
          >
            {t('wishlist.browse_products')}
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((it: any) => {
            const product = it.product || it;
            const productId = product._id || it.productId || it._id;
            if (renderCard) {
              return (
                <div key={productId} className="relative">
                  <button
                    type="button"
                    onClick={() => handleRemove(productId)}
                    disabled={busy === productId}
                    aria-label={t('wishlist.remove')}
                    className="absolute top-2 end-2 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-gray-600 hover:text-red-600 shadow-sm disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  {renderCard(product, () => handleRemove(productId))}
                </div>
              );
            }
            const image =
              product.images?.[0]?.url ||
              product.images?.[0] ||
              product.image ||
              product.thumbnail;
            const price = product.price;
            const slug = product.slug || productId;

            return (
              <div
                key={productId}
                className="relative rounded-xl overflow-hidden border flex flex-col"
                style={{
                  borderColor: 'var(--color-border, #e5e7eb)',
                  background: 'var(--color-surface, #fff)',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleRemove(productId)}
                  disabled={busy === productId}
                  aria-label={t('wishlist.remove')}
                  className="absolute top-2 end-2 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-gray-600 hover:text-red-600 shadow-sm disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                <Link to={`/products/${slug}`} className="block aspect-square bg-gray-50">
                  {image ? (
                    <img src={image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      {t('wishlist.no_image')}
                    </div>
                  )}
                </Link>

                <div className="p-3 flex-1 flex flex-col gap-2">
                  <Link
                    to={`/products/${slug}`}
                    className="text-sm font-medium line-clamp-2 hover:underline"
                    style={{ color: 'var(--color-text, #111)' }}
                  >
                    {product.name}
                  </Link>
                  {price != null && (
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-primary, #111)' }}>
                      ${Number(price).toFixed(2)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddToCart(productId)}
                    disabled={busy === productId}
                    className="mt-auto w-full text-sm font-medium py-2 rounded-lg text-white disabled:opacity-60"
                    style={{ background: 'var(--color-primary, #111)' }}
                  >
                    {busy === productId ? t('wishlist.adding_to_cart') : t('wishlist.move_to_cart')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
