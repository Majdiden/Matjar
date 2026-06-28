import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import { useStore } from '../contexts/StoreContext';
import { THUMB_PLACEHOLDER } from '../utils/placeholder';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CART_PLACEHOLDER = THUMB_PLACEHOLDER;

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('cart');
  const { cart, updateItem, removeItem, loading } = useCart();
  const { formatPrice } = useStore();

  // Mount/animate lifecycle: keep the drawer in the DOM through its exit
  // transition so it slides out instead of popping. `shown` drives the
  // open transform; it flips on the frame after mount so the browser has a
  // closed frame to animate FROM.
  const [mounted, setMounted] = React.useState(isOpen);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const id = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Lock background scroll + close on Escape while open.
  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const itemCount = cart?.itemCount ?? 0;
  const hasItems = !!cart && cart.items.length > 0;
  // Qty/round controls share one premium, comfortably tappable spec.
  const stepperBtn =
    'grid place-items-center w-9 h-9 rounded-[var(--radius-sm,6px)] border border-[var(--color-border,#e5e7eb)] text-base leading-none ' +
    'transition-colors duration-[var(--duration-fast,150ms)] hover:bg-black/[0.04] active:scale-95 disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t('drawer.title_empty')}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={[
          'absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity ease-[var(--ease-standard,cubic-bezier(0.4,0,0.2,1))] duration-[var(--duration-base,250ms)]',
          shown ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />

      {/* Drawer panel */}
      <div
        className={[
          'absolute end-0 top-0 h-full w-full max-w-md bg-[var(--color-background,#fff)] shadow-[var(--shadow-xl)] flex flex-col',
          'transition-transform ease-[var(--ease-emphasized,cubic-bezier(0.2,0,0,1))] duration-[var(--duration-base,250ms)] will-change-transform',
          shown ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-[var(--color-border,#e5e7eb)] shrink-0">
          <h2 className="text-lg font-bold text-[var(--color-foreground,#111)]" style={{ fontFamily: 'var(--font-family-heading)' }}>
            {itemCount ? t('drawer.title', { count: itemCount }) : t('drawer.title_empty')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('drawer.close_aria')}
            className="grid place-items-center w-10 h-10 rounded-full -me-2 text-[var(--color-foreground,#111)] hover:bg-black/[0.05] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading && !hasItems ? (
            <div className="space-y-4 pt-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-20 h-20 rounded-[var(--radius-sm,6px)] bg-black/[0.06]" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3.5 w-3/4 rounded bg-black/[0.06]" />
                    <div className="h-3 w-1/3 rounded bg-black/[0.06]" />
                    <div className="h-8 w-2/3 rounded bg-black/[0.06] mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasItems ? (
            <div className="flex flex-col items-center justify-center text-center h-full py-12">
              <div className="grid place-items-center w-16 h-16 rounded-full bg-black/[0.04] mb-4">
                <svg className="w-8 h-8 text-[var(--color-muted,#9ca3af)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </div>
              <p className="text-[var(--color-foreground,#111)] font-medium">{t('drawer.empty.title')}</p>
              <button
                onClick={onClose}
                className="mt-5 inline-flex items-center justify-center px-5 h-11 rounded-[var(--radius,12px)] text-white text-sm font-semibold hover:brightness-110 active:scale-95 transition"
                style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
              >
                {t('drawer.continue_shopping')}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border,#e5e7eb)]">
              {cart!.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-4 first:pt-1">
                  <Link to={`/products/${item.product?.slug ?? ''}`} onClick={onClose} className="shrink-0">
                    <img
                      src={item.product?.images?.[0] || CART_PLACEHOLDER}
                      alt={item.product?.name ?? ''}
                      onError={(e) => { const el = e.currentTarget; if (el.src !== CART_PLACEHOLDER) el.src = CART_PLACEHOLDER; }}
                      className="w-20 h-20 object-cover rounded-[var(--radius-sm,6px)] bg-black/[0.03] border border-[var(--color-border,#e5e7eb)]"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/products/${item.product?.slug ?? ''}`} onClick={onClose} className="text-sm font-medium text-[var(--color-foreground,#111)] line-clamp-2 hover:text-[var(--color-primary,#2563eb)] transition-colors">
                        {item.product?.name}
                      </Link>
                      <button
                        onClick={() => removeItem(item.productId, item.variant?.id)}
                        aria-label={t('item.remove')}
                        className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-[var(--color-muted,#9ca3af)] hover:text-[var(--color-error,#ef4444)] hover:bg-[var(--color-error,#ef4444)]/10 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {item.variant && (
                      <p className="text-xs text-[var(--color-muted,#9ca3af)] mt-0.5 truncate">{item.variant.name}</p>
                    )}
                    {(item as any).isPreorder && (
                      <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--color-accent, #d97706)' }}>
                        {(item as any).preorderExpectedShipDate
                          ? t('item.preorder_ships_by', {
                              date: new Date((item as any).preorderExpectedShipDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                            })
                          : t('item.preorder_label')}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2.5">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => updateItem(item.productId, Math.max(0, item.quantity - 1), item.variant?.id)}
                          aria-label={t('item.quantity_aria', { name: item.product?.name ?? '' })}
                          className={stepperBtn}
                        >
                          −
                        </button>
                        <span className="text-sm font-medium w-7 text-center tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateItem(item.productId, item.quantity + 1, item.variant?.id)}
                          aria-label={t('item.quantity_aria', { name: item.product?.name ?? '' })}
                          className={stepperBtn}
                        >
                          +
                        </button>
                      </div>
                      <p className="text-sm font-bold text-[var(--color-foreground,#111)] whitespace-nowrap">
                        {formatPrice(item.lineTotal)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {hasItems && (
          <div className="border-t border-[var(--color-border,#e5e7eb)] p-5 space-y-3 shrink-0 bg-[var(--color-background,#fff)]">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[var(--color-muted,#6b7280)]">{t('drawer.subtotal')}</span>
              <span className="text-lg font-bold text-[var(--color-foreground,#111)]">{formatPrice(cart!.subtotal)}</span>
            </div>
            <p className="text-xs text-[var(--color-muted,#9ca3af)]">{t('drawer.shipping_note')}</p>
            <Link
              to="/checkout"
              onClick={onClose}
              className="flex items-center justify-center w-full h-12 rounded-[var(--radius,12px)] text-white font-semibold shadow-[var(--shadow-sm)] hover:brightness-110 hover:shadow-[var(--shadow-md)] active:scale-[0.99] transition"
              style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
            >
              {t('drawer.checkout')}
            </Link>
            <button
              onClick={onClose}
              className="w-full text-center text-sm text-[var(--color-muted,#6b7280)] hover:text-[var(--color-foreground,#111)] transition-colors"
            >
              {t('drawer.continue_shopping')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
