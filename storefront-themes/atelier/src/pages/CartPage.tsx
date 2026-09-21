import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useFeaturedProducts } from '@matjar/theme-shared/hooks/useProducts';
import { FreeShippingBar, LineItem, NOTE_KEY } from '../components/chrome/MiniCart';
import AtelierProductCard from '../components/AtelierProductCard';

/** Two-column cart: line items on the start side, a grey summary card on the end side. */
const CartPage: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { cart, loading } = useCart();
  const { formatPrice } = useStore();
  const { products } = useFeaturedProducts(4);
  const [note, setNote] = useState(() => { try { return localStorage.getItem(NOTE_KEY) || ''; } catch { return ''; } });
  const items = cart?.items || [];
  const saveNote = (v: string) => { setNote(v); try { localStorage.setItem(NOTE_KEY, v); } catch { /* ignore */ } };

  return (
    <div>
      <div className="bg-[#1c1c1c] px-4 py-14 text-center text-white">
        <h1 className="font-display text-[36px] font-medium uppercase sm:text-[44px]">{t('theme.cart.page_title')}</h1>
        <nav aria-label="Breadcrumb" className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80"><Link to="/" className="at-link-hover-light">{t('theme.layout.nav.home')}</Link><span className="mx-2">•</span><span>{t('theme.cart.page_title')}</span></nav>
      </div>
      <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6">
        {!loading && items.length === 0 ? (
          <div className="mx-auto max-w-lg py-16 text-center">
            <h2 className="font-display text-3xl">{t('theme.cart.empty_title')}</h2>
            <p className="mt-3 text-[15px] text-[#4a4a4a]">{t('theme.cart.empty_body')}</p>
            <Link to="/products" className="at-btn at-btn-dark mt-8">{t('theme.cart.continue')}</Link>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
            <div>
              <div className="grid grid-cols-[1fr_auto] rounded-[6px] bg-[#f2f2f2] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#4a4a4a]"><span>{t('theme.cart.col_product')}</span><span>{t('theme.cart.col_total')}</span></div>
              <div className="divide-y divide-[#eaeaea]">{items.map((it: any) => <LineItem key={it.id} item={it} />)}</div>
              <div className="mt-6 flex flex-wrap gap-3"><Link to="/products" className="at-btn at-btn-outline">{t('theme.cart.continue')}</Link></div>
            </div>
            <aside className="h-fit rounded-[var(--atelier-radius-card)] border border-[#eaeaea] bg-[#f2f2f2] p-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4a4a4a]">{t('theme.cart.summary')}</p>
              <div className="mt-4 flex items-baseline justify-between"><span className="text-[14px] font-bold">{t('theme.cart.subtotal')}</span><span className="text-[22px] font-extrabold">{formatPrice(cart?.subtotal || 0)}</span></div>
              {!!cart?.savings && cart.savings > 0 && <p className="mt-1 text-[12px] font-bold text-[#2e8b57]">{t('theme.cart.savings', { amount: formatPrice(cart.savings) })}</p>}
              <p className="mt-2 text-[11px] font-medium text-[#6b6b6b]">{t('theme.cart.shipping_hint')}</p>
              <FreeShippingBar subtotal={cart?.subtotal || 0} className="mt-5" />
              <label className="mt-6 block text-[12px] font-bold">{t('theme.cart.note_title')}
                <textarea value={note} onChange={(e) => saveNote(e.target.value)} rows={3} placeholder={t('theme.cart.note_placeholder')} className="mt-2 w-full rounded-[10px] border border-[#e3e0d3] bg-white p-3 text-[13px] font-normal text-[#162950] placeholder:text-[10px] placeholder:text-[#767676]" />
              </label>
              <Link to="/checkout" className="at-btn at-btn-dark mt-6 w-full">{t('theme.cart.checkout')}</Link>
            </aside>
          </div>
        )}
        {products.length > 0 && (
          <section className="mt-20"><p className="at-eyebrow pb-4">{t('theme.added.related')}</p><div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">{products.map((p: any) => <AtelierProductCard key={p._id} product={p} />)}</div></section>
        )}
      </div>
    </div>
  );
};

export default CartPage;
