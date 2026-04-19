import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@shared/contexts/CartContext';
import { useStore } from '@shared/contexts/StoreContext';

const CartPage: React.FC = () => {
  const { t } = useTranslation('theme');
  const { cart, updateItem, removeItem, clearCart, loading } = useCart();
  const { formatPrice } = useStore();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center text-gray-500">
        {t('theme.cart.loading')}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
        <h2 className="text-2xl font-bold mb-2">{t('theme.cart.empty_heading')}</h2>
        <p className="text-gray-500 mb-6">{t('theme.cart.empty_body')}</p>
        <Link
          to="/products"
          className="inline-block px-6 py-3 rounded-lg text-white font-medium"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {t('theme.cart.start_shopping')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">{t('theme.cart.page_title')}</h1>
        <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-700">
          {t('theme.cart.clear_cart')}
        </button>
      </div>

      <div className="space-y-4 mb-8">
        {cart.items.map((item) => (
          <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
            <Link to={item.product ? `/products/${item.product.slug}` : '#'}>
              <img
                src={item.product?.images?.[0] || 'https://placehold.co/120x120?text=No+Image'}
                alt={item.product?.name}
                className="w-24 h-24 object-cover rounded"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                to={item.product ? `/products/${item.product.slug}` : '#'}
                className="font-medium hover:underline"
              >
                {item.product?.name}
              </Link>
              <p className="text-sm text-gray-500 mt-1">{formatPrice(item.price)} {t('theme.cart.each_price')}</p>
              {item.variant && <p className="text-xs text-gray-400">{item.variant.name}</p>}
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center border rounded">
                  <button
                    onClick={() => updateItem(item.productId, Math.max(0, item.quantity - 1), item.variant?.id)}
                    className="px-3 py-1 hover:bg-gray-50 text-sm"
                  >
                    -
                  </button>
                  <span className="px-3 py-1 border-x text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateItem(item.productId, item.quantity + 1, item.variant?.id)}
                    className="px-3 py-1 hover:bg-gray-50 text-sm"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeItem(item.productId, item.variant?.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  {t('theme.cart.remove')}
                </button>
              </div>
            </div>
            <div className="text-end">
              <p className="font-bold">{formatPrice(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="border rounded-lg p-6">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between">
            <span className="text-gray-500">{t('theme.cart.subtotal', { count: cart.itemCount })}</span>
            <span className="font-bold">{formatPrice(cart.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>{t('theme.cart.shipping')}</span>
            <span>{t('theme.cart.calculated_at_checkout')}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>{t('theme.cart.tax')}</span>
            <span>{t('theme.cart.calculated_at_checkout')}</span>
          </div>
        </div>
        <div className="border-t pt-4 flex justify-between text-lg font-bold">
          <span>{t('theme.cart.total')}</span>
          <span>{formatPrice(cart.total)}</span>
        </div>
        <Link to="/checkout" className="block text-center w-full mt-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition"style={{ backgroundColor: 'var(--color-primary)' }}
        >{t('theme.cart.proceed_to_checkout')}</Link>
        <Link
          to="/products"
          className="block text-center mt-3 text-sm hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          {t('theme.cart.continue_shopping')}
        </Link>
      </div>
    </div>
  );
};

export default CartPage;
