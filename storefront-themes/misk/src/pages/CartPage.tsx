import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { I } from '../lib/icons';

const PLACEHOLDER = 'https://placehold.co/240x240/f4efe7/14110e?text=%20';

const CartPage: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { cart, updateItem, removeItem, loading } = useCart();
  const { formatPrice } = useStore();

  // No free-shipping bar: checkout has no free-shipping threshold, so it
  // could promise free delivery that the order would not get.
  const empty = !cart || cart.items.length === 0;
  const subtotal = cart?.subtotal ?? 0;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 md:py-16">
      <div className="mb-10 text-center">
        <nav className="misk-eyebrow text-gold-ink" aria-label="breadcrumb">
          <Link to="/" className="hover:text-ink">{t('theme.nav.home')}</Link>
          <span className="mx-2" aria-hidden>·</span>
          <span>{t('theme.cart.title')}</span>
        </nav>
        <h1 className="font-display mt-3 text-4xl text-ink">{t('theme.cart.title')}</h1>
      </div>

      {empty ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <I.bag className="mx-auto h-10 w-10 text-muted" />
          <h2 className="font-display mt-6 text-2xl text-ink">{t('theme.cart.empty_title')}</h2>
          <p className="mt-2 text-muted">{t('theme.cart.empty_body')}</p>
          <Link to="/products" className="misk-btn misk-btn-solid mt-8">{t('theme.cart.continue')}</Link>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <div>
            <div className="misk-eyebrow hidden grid-cols-[minmax(0,1fr)_140px_120px] border-b border-line pb-3 text-muted sm:grid">
              <span>{t('theme.cart.product')}</span>
              <span className="text-center">{t('theme.cart.quantity')}</span>
              <span className="text-end">{t('theme.cart.total')}</span>
            </div>

            <ul className="divide-y divide-line">
              {cart!.items.map((item: any) => {
                const href = item.product ? `/products/${item.product.slug}` : '#';
                return (
                  <li key={`${item.productId}-${item.variant?.id || ''}`} className="grid gap-4 py-6 sm:grid-cols-[minmax(0,1fr)_140px_120px] sm:items-center">
                    <div className="flex items-start gap-4">
                      <Link to={href} className="block h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm,6px)] bg-sand">
                        <img src={item.product?.images?.[0] || PLACEHOLDER} alt="" className="h-full w-full object-cover" />
                      </Link>
                      <div className="min-w-0">
                        <Link to={href} className="font-display block text-lg leading-snug text-ink hover:text-gold-ink">{item.product?.name}</Link>
                        {item.variant?.name && <p className="mt-0.5 text-sm text-muted">{item.variant.name}</p>}
                        <p className="misk-num mt-1 text-sm text-muted">{formatPrice(item.price)}</p>
                        <button type="button" onClick={() => removeItem(item.productId, item.variant?.id)} className="mt-2 min-h-[44px] text-sm text-muted underline-offset-4 hover:text-[color:var(--color-error)] hover:underline">
                          {t('theme.cart.remove')}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center sm:justify-center">
                      <div className="flex h-11 items-center rounded-full border border-line">
                        <button type="button" disabled={loading} onClick={() => updateItem(item.productId, Math.max(0, item.quantity - 1), item.variant?.id)} className="grid h-full w-11 place-items-center rounded-full text-ink hover:bg-sand" aria-label={t('theme.product.decrease')}>
                          <I.minus className="h-4 w-4" />
                        </button>
                        <span className="misk-num w-10 text-center text-ink">{item.quantity}</span>
                        <button type="button" disabled={loading} onClick={() => updateItem(item.productId, item.quantity + 1, item.variant?.id)} className="grid h-full w-11 place-items-center rounded-full text-ink hover:bg-sand" aria-label={t('theme.product.increase')}>
                          <I.plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <p className="misk-num font-bold text-ink sm:text-end">{formatPrice(item.price * item.quantity)}</p>
                  </li>
                );
              })}
            </ul>

            <Link to="/products" className="misk-eyebrow mt-6 inline-flex min-h-[44px] items-center gap-2 text-ink hover:text-gold-ink">
              <I.chevronLeft className="h-4 w-4 rtl:-scale-x-100" /> {t('theme.cart.continue')}
            </Link>
          </div>

          <aside className="h-fit rounded-[var(--radius-lg,18px)] bg-sand p-6 sm:p-8">
            <h2 className="font-display text-2xl text-ink">{t('theme.cart.summary')}</h2>


            <dl className="misk-num mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t('theme.cart.subtotal', { count: cart!.itemCount })}</dt>
                <dd className="text-ink">{formatPrice(subtotal)}</dd>
              </div>
              {cart!.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">{t('theme.cart.discount')}</dt>
                  <dd className="text-[color:var(--color-success)]">−{formatPrice(cart!.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-3 text-lg">
                <dt className="font-bold text-ink">{t('theme.cart.total')}</dt>
                <dd className="font-bold text-ink">{formatPrice(cart!.total)}</dd>
              </div>
            </dl>

            <p className="mt-2 text-xs text-muted">{t('theme.cart.taxes_note')}</p>
            <Link to="/checkout" className="misk-btn misk-btn-solid mt-6 h-14 w-full">{t('theme.cart.checkout')}</Link>
          </aside>
        </div>
      )}
    </div>
  );
};

export default CartPage;
