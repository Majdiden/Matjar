import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { checkoutApi } from '@matjar/theme-shared/api/client';
import { useDiscount } from '@matjar/theme-shared/hooks/useDiscount';
import { useAtelierUI } from '../../contexts/AtelierUI';
import { useOverlayA11y } from '../../lib/motion';

export const NOTE_KEY = 'atelier.cart.note';
export const DISCOUNT_KEY = 'atelier.cart.discount';

/** "Spend X more for free shipping" bar with a truck marker. */
export const FreeShippingBar: React.FC<{ subtotal: number; className?: string }> = ({ subtotal, className = '' }) => {
  const { t } = useTranslation(['theme']);
  const { formatPrice } = useStore();
  const threshold = Number(useThemeSetting<number>('free_shipping_threshold') ?? 0);
  if (!threshold || threshold <= 0) return null;
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, (subtotal / threshold) * 100);
  return (
    <div className={className}>
      <p className="text-[12px] font-extrabold tracking-[0.25px]">
        {remaining > 0 ? t('theme.cart.free_shipping_remaining', { amount: formatPrice(remaining) }) : t('theme.cart.free_shipping_unlocked')}
      </p>
      <div className="relative mt-3 h-2 rounded-full bg-[#e5e5e5]">
        <div className="h-full rounded-full bg-[color:var(--atelier-success)] transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
        <span className="absolute -top-2.5 flex h-7 w-7 -translate-x-1/2 rtl:translate-x-1/2 items-center justify-center rounded-full border-2 border-[color:var(--atelier-success)] bg-white text-[color:var(--atelier-success)] transition-[inset-inline-start] duration-500 ease-linear" style={{ insetInlineStart: `${pct}%` }} aria-hidden>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
        </span>
      </div>
    </div>
  );
};

export const LineItem: React.FC<{ item: any; compact?: boolean }> = ({ item, compact }) => {
  const { t } = useTranslation(['theme']);
  const { formatPrice } = useStore();
  const { updateItem, removeItem } = useCart();
  const [busy, setBusy] = useState(false);
  const img = item.product?.images?.[0];
  const opts = item.variant?.options?.map((o: any) => o.value).join(' / ') || item.variant?.name;
  const set = async (q: number) => { setBusy(true); try { await updateItem(item.productId, q, item.variant?.id); } finally { setBusy(false); } };
  return (
    <div className="flex gap-4 py-4">
      <Link to={item.product ? `/products/${item.product.slug}` : '/cart'} className="block h-24 w-20 shrink-0 overflow-hidden rounded-[4px] bg-[color:var(--color-accent)]">
        {img && <img src={img} alt="" className="h-full w-full object-cover" />}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{item.product?.name || t('theme.cart.unavailable')}</p>
        {opts && <p className="text-[11px] font-bold uppercase text-[#6b6b6b]">{opts}</p>}
        <p className="mt-1 text-[13px] font-extrabold">{formatPrice(item.price)}</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="inline-flex h-9 items-center rounded-full border border-[#e0e0e0]">
            <button type="button" disabled={busy || item.quantity <= 1} onClick={() => set(item.quantity - 1)} className="h-full w-9 text-lg text-[#6b6b6b] hover:text-[#1c1c1c] disabled:text-[#c8c8c8]" aria-label={t('theme.cart.decrease')}>−</button>
            <span className="w-8 text-center text-[13px] font-bold">{item.quantity}</span>
            <button type="button" disabled={busy} onClick={() => set(item.quantity + 1)} className="h-full w-9 text-lg text-[#6b6b6b] hover:text-[#1c1c1c]" aria-label={t('theme.cart.increase')}>+</button>
          </div>
          {!compact && <span className="text-[13px] font-extrabold">{formatPrice(item.lineTotal)}</span>}
          <button type="button" onClick={() => removeItem(item.productId, item.variant?.id)} className="ms-auto text-[#6b6b6b] transition-colors hover:text-[color:var(--atelier-sale)]" aria-label={t('theme.cart.remove')}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

type Panel = 'note' | 'shipping' | 'discount' | null;

/** End-side drawer with note / shipping-estimate / discount sub-panels on its edge. */
const MiniCart: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { overlay, close } = useAtelierUI();
  const { cart } = useCart();
  const { formatPrice } = useStore();
  const isOpen = overlay === 'minicart';
  const ref = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [terms, setTerms] = useState(false);
  const [note, setNote] = useState(() => { try { return localStorage.getItem(NOTE_KEY) || ''; } catch { return ''; } });
  const [noteSaved, setNoteSaved] = useState(false);
  const [country, setCountry] = useState('SD');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [rates, setRates] = useState<{ name: string; price: number }[] | null>(null);
  const [ratesBusy, setRatesBusy] = useState(false);
  const [code, setCode] = useState(() => { try { return localStorage.getItem(DISCOUNT_KEY) || ''; } catch { return ''; } });
  const discount = useDiscount();

  useOverlayA11y(isOpen, close, ref);
  useEffect(() => { if (!isOpen) setPanel(null); }, [isOpen]);

  const saveNote = () => { try { localStorage.setItem(NOTE_KEY, note); } catch { /* ignore */ } setNoteSaved(true); setTimeout(() => setNoteSaved(false), 1500); };
  const estimate = async () => {
    setRatesBusy(true); setRates(null);
    try {
      const res: any = await checkoutApi.quote({ shippingAddress: { country, state, postalCode: zip } });
      const q = res?.data || res?.responseObject || res;
      const opts = q?.shippingOptions || q?.shippingMethods || (q?.shipping != null ? [{ name: t('theme.cart.shipping'), price: q.shipping }] : []);
      setRates(Array.isArray(opts) ? opts.map((o: any) => ({ name: o.name || o.label || t('theme.cart.shipping'), price: Number(o.price ?? o.cost ?? 0) })) : []);
    } catch { setRates([]); }
    finally { setRatesBusy(false); }
  };
  const applyCode = async () => {
    const ok = await discount.validate(code);
    if (ok) { try { localStorage.setItem(DISCOUNT_KEY, code.trim()); } catch { /* ignore */ } }
  };

  const items = cart?.items || [];
  const tabs: { id: Exclude<Panel, null>; label: string; icon: React.ReactNode }[] = [
    { id: 'note', label: t('theme.cart.note_title'), icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h12l4 4v12H4zM8 12h8M8 16h5" /></svg> },
    { id: 'shipping', label: t('theme.cart.shipping_title'), icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg> },
    { id: 'discount', label: t('theme.cart.discount_title'), icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12l9-9h9v9l-9 9zM16 8h.01" /></svg> },
  ];

  return (
    <>
      <div className={`at-backdrop ${isOpen ? 'is-open' : ''}`} onClick={close} aria-hidden />
      <div ref={ref} className={`at-panel at-panel-end flex flex-col ${isOpen ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label={t('theme.cart.title')} tabIndex={-1}>
        {/* Edge tabs */}
        <div className="absolute top-24 end-full hidden sm:flex flex-col gap-2 pe-2">
          {tabs.map((tb) => (
            <button key={tb.id} type="button" title={tb.label} aria-label={tb.label} aria-pressed={panel === tb.id} onClick={() => setPanel((p) => (p === tb.id ? null : tb.id))}
              className={`group/tab relative flex h-11 w-11 items-center justify-center rounded-full shadow-[0_2px_10px_#0000001a] transition-colors duration-300 ${panel === tb.id ? 'bg-[color:var(--atelier-bronze-ink)] text-white' : 'bg-white text-[#1c1c1c] hover:bg-[#1c1c1c] hover:text-white'}`}>
              {tb.icon}
              <span className="pointer-events-none absolute end-full top-1/2 me-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#1c1c1c] px-3 py-1 text-[11px] font-bold text-white opacity-0 transition-opacity duration-200 group-hover/tab:opacity-100">{tb.label}</span>
            </button>
          ))}
        </div>
        {/* Sub-panel sliding out beside the drawer */}
        <div className={`absolute top-0 end-full h-full w-[320px] max-w-[80vw] bg-[#f2f2f2] p-6 transition-[transform,opacity] duration-300 ease-linear ${panel ? 'translate-x-0 opacity-100' : 'translate-x-6 rtl:-translate-x-6 opacity-0 pointer-events-none'} hidden sm:block`} aria-hidden={!panel}>
          {panel === 'note' && (
            <div>
              <p className="at-eyebrow pb-3">{t('theme.cart.note_title')}</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} placeholder={t('theme.cart.note_placeholder')} className="w-full rounded-[10px] border border-[#e3e0d3] bg-white p-3 text-[13px] text-[#162950] placeholder:text-[#767676]" />
              <button type="button" onClick={saveNote} className="at-btn at-btn-dark mt-3 w-full">{noteSaved ? t('theme.cart.saved') : t('theme.cart.save')}</button>
            </div>
          )}
          {panel === 'shipping' && (
            <div>
              <p className="at-eyebrow pb-3">{t('theme.cart.shipping_title')}</p>
              <label className="block text-[11px] font-bold uppercase text-[#6b6b6b]">{t('theme.cart.country')}</label>
              <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} className="mt-1 w-full rounded-[10px] border border-[#e3e0d3] bg-white p-2.5 text-[13px] text-[#162950]" />
              <label className="mt-3 block text-[11px] font-bold uppercase text-[#6b6b6b]">{t('theme.cart.state')}</label>
              <input value={state} onChange={(e) => setState(e.target.value)} className="mt-1 w-full rounded-[10px] border border-[#e3e0d3] bg-white p-2.5 text-[13px] text-[#162950]" />
              <label className="mt-3 block text-[11px] font-bold uppercase text-[#6b6b6b]">{t('theme.cart.zip')}</label>
              <input value={zip} onChange={(e) => setZip(e.target.value)} className="mt-1 w-full rounded-[10px] border border-[#e3e0d3] bg-white p-2.5 text-[13px] text-[#162950]" />
              <button type="button" onClick={estimate} disabled={ratesBusy} className="at-btn at-btn-dark mt-4 w-full">{ratesBusy ? <span className="at-spinner" /> : t('theme.cart.calculate')}</button>
              {rates && (
                <ul className="mt-3 space-y-1 text-[13px]">
                  {rates.length === 0 && <li className="text-[#6b6b6b]">{t('theme.cart.no_rates')}</li>}
                  {rates.map((r) => <li key={r.name} className="flex justify-between"><span>{r.name}</span><b>{r.price === 0 ? t('theme.cart.free') : formatPrice(r.price)}</b></li>)}
                </ul>
              )}
            </div>
          )}
          {panel === 'discount' && (
            <div>
              <p className="at-eyebrow pb-3">{t('theme.cart.discount_title')}</p>
              <p className="text-[12px] text-[#6b6b6b]">{t('theme.cart.discount_help')}</p>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('theme.cart.discount_placeholder')} className="mt-3 w-full rounded-[10px] border border-[#e3e0d3] bg-white p-2.5 text-[13px] uppercase text-[#162950] placeholder:normal-case placeholder:text-[#767676]" />
              <button type="button" onClick={applyCode} disabled={discount.validating} className="at-btn at-btn-dark mt-3 w-full">{discount.validating ? <span className="at-spinner" /> : t('theme.cart.save')}</button>
              {discount.error && <p className="mt-2 text-[12px] font-semibold text-[color:var(--atelier-sale)]">{discount.error}</p>}
              {discount.result && !discount.error && <p className="mt-2 text-[12px] font-semibold text-[color:var(--atelier-success)]">{t('theme.cart.discount_applied')}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-b border-[#eaeaea] px-6 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-wider">{t('theme.cart.title')} <span className="ms-2 rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal">{t('theme.cart.items', { count: cart?.itemCount || 0 })}</span></h2>
          <button type="button" onClick={close} className="at-flip-close inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1c1c] text-white transition-colors duration-300 hover:bg-[color:var(--atelier-bronze-ink)]" aria-label={t('theme.layout.close')}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto at-scrollbar px-6">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display text-2xl">{t('theme.cart.empty_title')}</p>
              <p className="mt-2 text-sm text-[#6b6b6b]">{t('theme.cart.empty_body')}</p>
              <Link to="/products" onClick={close} className="at-btn at-btn-dark mt-6">{t('theme.cart.continue')}</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#eaeaea]">{items.map((it: any) => <LineItem key={it.id} item={it} compact />)}</div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[#eaeaea] px-6 py-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-extrabold uppercase tracking-wider">{t('theme.cart.total')}</span>
              <span className="text-[22px] font-extrabold">{formatPrice(cart?.total || 0)}</span>
            </div>
            <FreeShippingBar subtotal={cart?.subtotal || 0} className="mt-4" />
            <div className="mt-5 grid gap-2">
              <Link to="/cart" onClick={close} className="at-btn at-btn-outline w-full">{t('theme.cart.view_cart')}</Link>
              <Link to={terms ? '/checkout' : '#'} onClick={(e) => { if (!terms) e.preventDefault(); else close(); }} aria-disabled={!terms} className={`at-btn w-full ${terms ? 'at-btn-dark' : 'pointer-events-none bg-[#e5e5e5] text-[#4a4a4a]'}`}>{t('theme.cart.checkout')}</Link>
              <label className="mt-1 flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="h-4 w-4 accent-[#1c1c1c]" />
                <span>{t('theme.cart.terms_prefix')} <Link to="/policies/terms" onClick={close} className="underline at-link-hover">{t('theme.cart.terms_link')}</Link></span>
              </label>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MiniCart;
