import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useFeaturedProducts } from '@matjar/theme-shared/hooks/useProducts';
import { useAtelierUI } from '../../contexts/AtelierUI';
import { useOverlayA11y } from '../../lib/motion';
import { FreeShippingBar, LineItem } from './MiniCart';
import AtelierProductCard from '../AtelierProductCard';

/** Centred confirmation after add-to-cart: the added line, totals, free-shipping bar and a "you may also like" rail. */
const AddedModal: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { added, dismissAdded } = useAtelierUI();
  const { cart } = useCart();
  const { formatPrice } = useStore();
  const { products } = useFeaturedProducts(4);
  const ref = useRef<HTMLDivElement>(null);
  const [terms, setTerms] = useState(false);
  const open = !!added;
  useOverlayA11y(open, dismissAdded, ref);
  const line = added ? (cart?.items || []).find((it: any) => it.productId === added.productId && (!added.variantId || it.variant?.id === added.variantId)) : null;
  const related = products.filter((p: any) => p._id !== added?.productId).slice(0, 4);

  return (
    <div className={`fixed inset-0 z-[95] flex items-center justify-center p-4 transition-[opacity,visibility] duration-300 ease-linear ${open ? 'visible opacity-100' : 'invisible opacity-0'}`} aria-hidden={!open}>
      <div className="absolute inset-0 bg-black/50" onClick={dismissAdded} />
      <div ref={ref} role={open ? 'dialog' : undefined} aria-modal={open ? 'true' : undefined} aria-label={t('theme.added.title')} tabIndex={-1}
        className={`relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto at-scrollbar rounded-[var(--atelier-radius-card)] bg-white shadow-2xl transition-transform duration-300 ease-linear ${open ? 'scale-100' : 'scale-95'}`}>
        <div className="flex items-center justify-between border-b border-[#eaeaea] px-6 py-4">
          <div>
            <h2 className="text-[13px] font-extrabold uppercase tracking-wider">{t('theme.added.title')}</h2>
            <p className="text-[11px] font-semibold uppercase text-[#6b6b6b]">{t('theme.added.count', { count: cart?.itemCount || 0 })}</p>
          </div>
          <button type="button" onClick={dismissAdded} className="at-flip-close at-icon-btn h-11 w-11 bg-[#1c1c1c] text-white transition-colors duration-300 hover:bg-[color:var(--atelier-bronze-ink)]" aria-label={t('theme.layout.close')}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="px-6">
          <p className="mt-4 flex items-center gap-2 rounded-[10px] bg-[#e7f4ec] px-4 py-3 text-[13px] font-semibold text-[#1f5a3a]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
            {t('theme.added.success', { name: added?.name || '' })}
          </p>
          {line && <LineItem item={line} />}
          <FreeShippingBar subtotal={cart?.subtotal || 0} className="mt-2" />
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_260px]">
            <div className="hidden md:block" />
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between"><span className="text-[13px] font-extrabold uppercase tracking-wider">{t('theme.cart.total')}</span><span className="text-[20px] font-extrabold">{formatPrice(cart?.total || 0)}</span></div>
              <Link to="/cart" onClick={dismissAdded} className="at-btn at-btn-dark w-full">{t('theme.cart.view_cart')}</Link>
              <button type="button" onClick={dismissAdded} className="at-btn at-btn-outline w-full">{t('theme.added.continue')}</button>
              <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="h-4 w-4 accent-[#1c1c1c]" /><span>{t('theme.cart.terms_prefix')} <Link to="/policies/terms" onClick={dismissAdded} className="underline">{t('theme.cart.terms_link')}</Link></span></label>
              <Link to={terms ? '/checkout' : '#'} onClick={(e) => { if (!terms) e.preventDefault(); else dismissAdded(); }} aria-disabled={!terms} className={`at-btn w-full ${terms ? 'at-btn-dark' : 'pointer-events-none bg-[#e5e5e5] text-[#4a4a4a]'}`}>{t('theme.added.checkout')}</Link>
            </div>
          </div>
        </div>
        {related.length > 0 && (
          <div className="mt-6 border-t border-[#eaeaea] px-6 pb-6 pt-5">
            <p className="at-eyebrow pb-4">{t('theme.added.related')}</p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {related.map((p: any) => <AtelierProductCard key={p._id} product={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddedModal;
