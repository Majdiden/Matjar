import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@shared/contexts/CartContext';
import { useStore } from '@shared/contexts/StoreContext';

const CartPage: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { cart, updateItem, removeItem, clearCart, loading } = useCart();
  const { formatPrice } = useStore();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center text-mute">
        {t('theme.cart.loading')}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
        <svg className="w-16 h-16 text-line mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" /></svg>
        <h2 className="text-3xl mb-3 text-ink" style={{ fontFamily: 'var(--font-family-heading)' }}>{t('theme.cart.empty_title')}</h2>
        <p className="text-mute mb-8">{t('theme.cart.empty_subtitle')}</p>
        <Link
          to="/products"
          className="inline-block px-8 py-3.5 bg-white text-black text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-neutral-200 transition"
        >
          {t('theme.cart.start_shopping')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl text-ink" style={{ fontFamily: 'var(--font-family-heading)' }}>{t('theme.cart.title')}</h1>
        <button onClick={clearCart} className="text-[11px] tracking-[0.15em] uppercase text-mute hover:text-red-400 transition">
          {t('theme.cart.clear')}
        </button>
      </div>

      <div className="space-y-4 mb-10">
        {cart.items.map((item) => (
          <div key={item.id} className="flex gap-4 p-4 border border-line">
            <Link to={item.product ? `/products/${item.product.slug}` : '#'}>
              <img
                src={item.product?.images?.[0] || 'https://placehold.co/120x120/e9e5de/888?text=No+Image'}
                alt={item.product?.name}
                className="w-24 h-24 object-cover bg-tile"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                to={item.product ? `/products/${item.product.slug}` : '#'}
                className="text-[13px] tracking-[0.15em] uppercase font-medium text-ink hover:text-gold transition"
              >
                {item.product?.name}
              </Link>
              <p className="text-sm text-mute mt-1">{formatPrice(item.price)} {t('theme.cart.each')}</p>
              {item.variant && <p className="text-xs text-mute">{item.variant.name}</p>}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center border border-line">
                  <button
                    onClick={() => updateItem(item.productId, Math.max(0, item.quantity - 1), item.variant?.id)}
                    className="px-3 py-1 text-ink hover:bg-ink hover:text-black text-sm transition"
                  >
                    -
                  </button>
                  <span className="px-3 py-1 border-x border-line text-sm text-ink">{item.quantity}</span>
                  <button
                    onClick={() => updateItem(item.productId, item.quantity + 1, item.variant?.id)}
                    className="px-3 py-1 text-ink hover:bg-ink hover:text-black text-sm transition"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeItem(item.productId, item.variant?.id)}
                  className="text-[11px] tracking-[0.15em] uppercase text-mute hover:text-red-400 transition"
                >
                  {t('theme.cart.remove')}
                </button>
              </div>
            </div>
            <div className="text-end">
              <p className="text-ink">{formatPrice(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="border border-line p-6">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between">
            <span className="text-mute">{t('theme.cart.subtotal', { count: cart.itemCount })}</span>
            <span className="text-ink">{formatPrice(cart.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-mute">
            <span>{t('theme.cart.shipping')}</span>
            <span>{t('theme.cart.shipping_calc')}</span>
          </div>
          <div className="flex justify-between text-sm text-mute">
            <span>{t('theme.cart.tax')}</span>
            <span>{t('theme.cart.tax_calc')}</span>
          </div>
        </div>
        <div className="border-t border-line pt-4 flex justify-between text-lg text-ink">
          <span>{t('theme.cart.total')}</span>
          <span>{formatPrice(cart.total)}</span>
        </div>
        <Link
          to="/checkout"
          className="block text-center w-full mt-6 py-3.5 bg-white text-black text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-neutral-200 transition"
        >
          {t('theme.cart.checkout')}
        </Link>
        <Link
          to="/products"
          className="block text-center mt-4 text-[11px] tracking-[0.15em] uppercase text-mute hover:text-ink transition"
        >
          {t('theme.cart.continue_shopping')}
        </Link>
      </div>
    </div>
  );
};

export default CartPage;
