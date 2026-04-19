import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import { useStore } from '../contexts/StoreContext';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('cart');
  const { cart, updateItem, removeItem, loading } = useCart();
  const { formatPrice } = useStore();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed end-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">
            {cart?.itemCount
              ? t('drawer.title', { count: cart.itemCount })
              : t('drawer.title_empty')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('drawer.close_aria')}
            className="text-2xl leading-none hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-gray-500 py-8">{t('drawer.loading')}</p>
          ) : !cart || cart.items.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              <p className="text-gray-500">{t('drawer.empty.title')}</p>
              <button
                onClick={onClose}
                className="mt-4 text-sm underline hover:no-underline"
                style={{ color: 'var(--color-primary, #667eea)' }}
              >
                {t('drawer.continue_shopping')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex gap-3 border-b pb-4">
                  {item.product?.images?.[0] && (
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product?.name}</p>
                    <p className="text-sm text-gray-500">{formatPrice(item.price)}</p>
                    {item.variant && (
                      <p className="text-xs text-gray-400">{item.variant.name}</p>
                    )}
                    {(item as any).isPreorder && (
                      <p className="text-[11px] font-medium text-amber-600 mt-0.5">
                        {(item as any).preorderExpectedShipDate
                          ? t('item.preorder_ships_by', {
                              date: new Date((item as any).preorderExpectedShipDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                            })
                          : t('item.preorder_label')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateItem(item.productId, Math.max(0, item.quantity - 1), item.variant?.id)}
                        aria-label={t('item.quantity_aria', { name: item.product?.name ?? '' })}
                        className="w-7 h-7 border rounded flex items-center justify-center text-sm hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateItem(item.productId, item.quantity + 1, item.variant?.id)}
                        className="w-7 h-7 border rounded flex items-center justify-center text-sm hover:bg-gray-50"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.productId, item.variant?.id)}
                        className="ms-auto text-xs text-red-500 hover:text-red-700"
                      >
                        {t('item.remove')}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-bold whitespace-nowrap">
                    {formatPrice(item.lineTotal)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart && cart.items.length > 0 && (
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('drawer.subtotal')}</span>
              <span className="font-bold">{formatPrice(cart.subtotal)}</span>
            </div>
            <p className="text-xs text-gray-400">{t('drawer.shipping_note')}</p>
            <Link
              to="/checkout"
              onClick={onClose}
              className="block w-full text-center py-3 rounded-lg text-white font-medium hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--color-primary, #667eea)' }}
            >
              {t('drawer.checkout')}
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;
