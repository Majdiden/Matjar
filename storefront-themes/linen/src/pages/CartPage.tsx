import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { I } from '../lib/icons';

const PLACEHOLDER = 'https://placehold.co/240x240/ecdec1/0f0f0f?text=%20';

const CartPage: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { cart, updateItem, removeItem, loading } = useCart();
  const { formatPrice } = useStore();
  const threshold = Number(useThemeSetting<number>('free_shipping_threshold')) || 0;

  const empty = !cart || cart.items.length === 0;
  const subtotal = cart?.subtotal ?? 0;
  const remaining = threshold > 0 ? Math.max(0, threshold - subtotal) : 0;
  const progress = threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 100;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 md:py-16">
      <div className="mb-10 text-center">
        <p className="linen-eyebrow text-clay"><Link to="/" className="hover:text-ink">{t('theme.nav.home')}</Link> <span className="mx-2">•</span> {t('theme.cart.title')}</p>
        <h1 className="font-heading mt-3 text-4xl text-ink">{t('theme.cart.title')}</h1>
      </div>

      {empty ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <I.bag className="mx-auto h-10 w-10 text-dune" />
          <h2 className="font-heading mt-6 text-2xl text-ink">{t('theme.cart.empty_title')}</h2>
          <p className="mt-2 text-dune">{t('theme.cart.empty_body')}</p>
          <Link to="/products" className="linen-btn linen-btn-solid mt-8">{t('theme.cart.continue')}</Link>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <div>
            <div className="linen-eyebrow hidden grid-cols-[minmax(0,1fr)_120px_120px] border-b border-line pb-3 text-dune sm:grid">
              <span>{t('theme.cart.product')}</span><span className="text-center">{t('theme.cart.quantity')}</span><span className="text-end">{t('theme.cart.total')}</span>
            </div>
            <ul className="divide-y divide-line">
              {cart!.items.map((item: any) => (
                <li key={`${item.productId}-${item.variant?.id || ''}`} className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 py-6 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:items-center">
                  <div className="flex gap-4 sm:col-span-1 sm:contents">
                    <Link to={item.product ? `/products/${item.product.slug}` : '#'} className="block h-[88px] w-[88px] shrink-0 overflow-hidden bg-sand sm:hidden">
                      <img src={item.product?.images?.[0] || PLACEHOLDER} alt="" className="h-full w-full object-cover" />
                    </Link>
                  </div>
                  <div className="flex items-start gap-4">
                    <Link to={item.product ? `/products/${item.product.slug}` : '#'} className="hidden h-24 w-24 shrink-0 overflow-hidden bg-sand sm:block">
                      <img src={item.product?.images?.[0] || PLACEHOLDER} alt="" className="h-full w-full object-cover" />
                    </Link>
                    <div className="min-w-0">
                      <Link to={item.product ? `/products/${item.product.slug}` : '#'} className="font-heading block text-lg leading-snug text-ink hover:text-clay">{item.product?.name}</Link>
                      {item.variant?.name && <p className="mt-0.5 text-sm text-dune">{item.variant.name}</p>}
                      <p className="mt-1 text-sm text-dune">{formatPrice(item.price)}</p>
                      <button type="button" onClick={() => removeItem(item.productId, item.variant?.id)} className="mt-2 text-sm text-dune underline-offset-4 hover:text-[color:var(--color-error)] hover:underline">{t('theme.cart.remove')}</button>
                    </div>
                  </div>
                  <div className="col-start-2 flex items-center sm:col-start-auto sm:justify-center">
                    <div className="flex h-11 items-center border border-line">
                      <button type="button" disabled={loading} onClick={() => updateItem(item.productId, Math.max(0, item.quantity - 1), item.variant?.id)} className="grid h-full w-10 place-items-center text-ink hover:bg-sand" aria-label={t('theme.product_detail.decrease')}><I.minus className="h-4 w-4" /></button>
                      <span className="w-10 text-center text-ink">{item.quantity}</span>
                      <button type="button" disabled={loading} onClick={() => updateItem(item.productId, item.quantity + 1, item.variant?.id)} className="grid h-full w-10 place-items-center text-ink hover:bg-sand" aria-label={t('theme.product_detail.increase')}><I.plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <p className="col-start-2 font-bold text-ink sm:col-start-auto sm:text-end">{formatPrice(item.price * item.quantity)}</p>
                </li>
              ))}
            </ul>
            <Link to="/products" className="linen-eyebrow mt-6 inline-flex items-center gap-2 text-ink hover:text-clay"><I.chevronLeft className="h-4 w-4 rtl:-scale-x-100" /> {t('theme.cart.continue')}</Link>
          </div>

          <aside className="h-fit bg-tint p-6 sm:p-8">
            <h2 className="font-heading text-2xl text-ink">{t('theme.cart.summary')}</h2>
            {threshold > 0 && (
              <div className="mt-5">
                <p className="text-sm text-ink">{remaining > 0 ? t('theme.cart.free_shipping_remaining', { amount: formatPrice(remaining) }) : t('theme.cart.free_shipping_unlocked')}</p>
                <div className="mt-2 h-[3px] w-full bg-line"><div className="h-full bg-bronze transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
            <dl className="mt-6 space-y-3 text-[0.95rem]">
              <div className="flex justify-between"><dt className="text-dune">{t('theme.cart.subtotal', { count: cart!.itemCount })}</dt><dd className="text-ink">{formatPrice(subtotal)}</dd></div>
              {cart!.discount > 0 && <div className="flex justify-between"><dt className="text-dune">{t('theme.cart.discount')}</dt><dd className="text-[color:var(--color-success)]">−{formatPrice(cart!.discount)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-3 text-lg"><dt className="font-bold text-ink">{t('theme.cart.total')}</dt><dd className="font-bold text-ink">{formatPrice(cart!.total)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-dune">{t('theme.cart.taxes_note')}</p>
            <Link to="/checkout" className="linen-btn linen-btn-dark mt-6 h-14 w-full">{t('theme.cart.checkout')}</Link>
          </aside>
        </div>
      )}
    </div>
  );
};

export default CartPage;
