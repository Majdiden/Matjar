import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useStore } from '../../contexts/StoreContext';
import { Drawer } from '../primitives/Drawer';
import type { Product } from '../../types/commerce';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';
import { THUMB_PLACEHOLDER } from '../../utils/placeholder';

export const SLOT_KEY = 'productCompare';

const COMPARE_PLACEHOLDER = THUMB_PLACEHOLDER;

interface ProductCompareProps {
  product: Product;
  className?: string;
}

// ─── Compare Context ─────────────────────────────────────────────

interface CompareContextValue {
  items: Product[];
  add: (product: Product) => void;
  remove: (productId: string) => void;
  clear: () => void;
  isComparing: (productId: string) => boolean;
  count: number;
  maxItems: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function useCompare() {
  const { t } = useTranslation(['common']);
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used within CompareProvider');
  return ctx;
}

const MAX_COMPARE_ITEMS = 4;

export function CompareProvider({ children, maxItems = MAX_COMPARE_ITEMS }: { children: ReactNode; maxItems?: number }) {
  const [items, setItems] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('matjar_compare');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isOpen, setIsOpen] = useState(false);

  const persist = (next: Product[]) => {
    setItems(next);
    localStorage.setItem('matjar_compare', JSON.stringify(next));
  };

  const add = useCallback((product: Product) => {
    setItems(prev => {
      if (prev.length >= maxItems) return prev;
      if (prev.some(p => p._id === product._id)) return prev;
      const next = [...prev, product];
      localStorage.setItem('matjar_compare', JSON.stringify(next));
      return next;
    });
  }, [maxItems]);

  const remove = useCallback((productId: string) => {
    setItems(prev => {
      const next = prev.filter(p => p._id !== productId);
      localStorage.setItem('matjar_compare', JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => persist([]), []);
  const isComparing = useCallback((id: string) => items.some(p => p._id === id), [items]);

  return (
    <CompareContext.Provider value={{
      items, add, remove, clear, isComparing,
      count: items.length, maxItems,
      isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false),
    }}>
      {children}
      <ProductCompareDrawer />
    </CompareContext.Provider>
  );
}

// ─── Compare Drawer ──────────────────────────────────────────────

function ProductCompareDrawer() {
  const { t } = useTranslation(['product', 'common']);
  const { items, remove, clear, isOpen, close } = useCompare();
  const { formatPrice } = useStore();

  if (items.length === 0 && !isOpen) return null;

  // Floating bar when items exist but drawer is closed
  if (!isOpen && items.length > 0) {
    return (
      <CompareFloatingBar />
    );
  }

  const cellPad = 'p-3 align-middle';
  const rowLabel = 'p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted,#6b7280)] whitespace-nowrap';

  return (
    <Drawer isOpen={isOpen} onClose={close} side="bottom" width="max-w-full">
      <Drawer.Header onClose={close}>
        <span style={{ fontFamily: 'var(--font-family-heading)' }}>{t('product:compare.title', { count: items.length })}</span>
      </Drawer.Header>
      <Drawer.Body>
        {items.length === 0 ? (
          <p className="text-center text-[var(--color-muted,#6b7280)] py-10">{t('product:compare.empty')}</p>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[560px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-start p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted,#6b7280)] w-28" />
                  {items.map(p => (
                    <td key={p._id} className="p-3 text-center align-top">
                      <div className="relative inline-block">
                        <img
                          src={p.images?.[0] || COMPARE_PLACEHOLDER}
                          alt={p.name}
                          onError={(e) => { const el = e.currentTarget; if (el.src !== COMPARE_PLACEHOLDER) el.src = COMPARE_PLACEHOLDER; }}
                          className="w-24 h-24 object-cover rounded-[var(--radius,12px)] mx-auto border border-[var(--color-border,#e5e7eb)] bg-black/[0.03]"
                        />
                        <button
                          onClick={() => remove(p._id)}
                          aria-label={t('common:aria.remove')}
                          className="absolute -top-2 -end-2 grid place-items-center w-6 h-6 rounded-full text-white shadow-[var(--shadow-sm)] hover:scale-110 active:scale-95 transition"
                          style={{ backgroundColor: 'var(--color-error, #ef4444)' }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <Link to={`/products/${p.slug}`} onClick={close} className="block text-sm font-semibold mt-2 hover:text-[var(--color-primary,#2563eb)] line-clamp-2 max-w-[160px] mx-auto transition-colors">
                        {p.name}
                      </Link>
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--color-border,#e5e7eb)]">
                  <td className={rowLabel}>{t('product:compare.row.price')}</td>
                  {items.map(p => (
                    <td key={p._id} className={cn(cellPad, 'text-center font-bold text-[var(--color-foreground,#111)]')}>
                      {formatPrice(p.price)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-[var(--color-border,#e5e7eb)]">
                  <td className={rowLabel}>{t('product:compare.row.rating')}</td>
                  {items.map(p => (
                    <td key={p._id} className={cn(cellPad, 'text-center')}>
                      {p.rating ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium">
                          <span style={{ color: 'var(--color-accent, #f59e0b)' }}>★</span>
                          {p.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted,#9ca3af)]">{t('product:compare.na')}</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-[var(--color-border,#e5e7eb)]">
                  <td className={rowLabel}>{t('product:compare.row.availability')}</td>
                  {items.map(p => (
                    <td key={p._id} className={cn(cellPad, 'text-center text-sm font-semibold')}>
                      {p.stock > 0 ? (
                        <span style={{ color: 'var(--color-success, #16a34a)' }}>{t('product:in_stock')}</span>
                      ) : (
                        <span style={{ color: 'var(--color-error, #dc2626)' }}>{t('product:out_of_stock')}</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Drawer.Body>
      <Drawer.Footer>
        <button onClick={clear} className="text-sm font-medium hover:underline" style={{ color: 'var(--color-error, #dc2626)' }}>
          {t('product:compare.clear_all')}
        </button>
      </Drawer.Footer>
    </Drawer>
  );
}

// ─── Floating Bar ────────────────────────────────────────────────

function CompareFloatingBar() {
  const { t } = useTranslation(['product', 'common']);
  const { items, open, clear } = useCompare();

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2 z-40 mx-auto w-auto sm:w-max max-w-[640px]">
      <div className="flex items-center gap-3 sm:gap-4 bg-[var(--color-background,#fff)] border border-[var(--color-border,#e5e7eb)] shadow-[var(--shadow-xl)] rounded-[var(--radius-pill,9999px)] px-3 sm:px-5 py-2.5">
        <div className="flex -space-x-2 shrink-0">
          {items.map(p => (
            <img
              key={p._id}
              src={p.images?.[0] || COMPARE_PLACEHOLDER}
              alt={p.name}
              onError={(e) => { const el = e.currentTarget; if (el.src !== COMPARE_PLACEHOLDER) el.src = COMPARE_PLACEHOLDER; }}
              className="w-9 h-9 rounded-full border-2 border-[var(--color-background,#fff)] object-cover bg-black/[0.03]"
            />
          ))}
        </div>
        <span className="text-sm font-medium text-[var(--color-foreground,#111)] truncate hidden xs:inline sm:inline">
          {t('product:compare.items_to_compare', { count: items.length })}
        </span>
        <button
          onClick={open}
          className="ms-auto shrink-0 text-white text-sm font-semibold px-4 sm:px-5 h-10 rounded-[var(--radius-pill,9999px)] hover:brightness-110 active:scale-95 transition"
          style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
        >
          {t('product:compare.add')}
        </button>
        <button
          onClick={clear}
          aria-label={t('common:action.close')}
          className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-[var(--color-muted,#9ca3af)] hover:text-[var(--color-foreground,#111)] hover:bg-black/[0.05] transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Compare Toggle Button (for product cards) ──────────────────

export function ProductCompare(props: ProductCompareProps) {
  const Override = useThemeSlot<React.ComponentType<ProductCompareProps>>(SLOT_KEY);
  const { t } = useTranslation('product');
  const { product, className } = props;
  const { add, remove, isComparing, count, maxItems } = useCompare();
  const comparing = isComparing(product._id);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    comparing ? remove(product._id) : add(product);
  };

  // Theme override comes after hooks so hook order stays stable.
  if (Override) return <Override {...props} />;

  return (
    <button
      onClick={handleToggle}
      disabled={!comparing && count >= maxItems}
      aria-pressed={comparing}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-[var(--radius-sm,6px)] border transition-colors duration-[var(--duration-fast,150ms)]',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        comparing
          ? 'text-white border-transparent'
          : 'text-[var(--color-muted,#6b7280)] border-[var(--color-border,#e5e7eb)] hover:border-[var(--color-primary,#2563eb)] hover:text-[var(--color-foreground,#111)]',
        className
      )}
      style={comparing ? { backgroundColor: 'var(--color-primary, #2563eb)' } : undefined}
    >
      {comparing ? t('compare.remove', 'Comparing') : t('compare.add', 'Compare')}
    </button>
  );
}
