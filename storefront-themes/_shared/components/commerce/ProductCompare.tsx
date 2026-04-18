import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useStore } from '../../contexts/StoreContext';
import { Drawer } from '../primitives/Drawer';
import type { Product } from '../../types/commerce';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'productCompare';

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
  const { items, remove, clear, isOpen, close } = useCompare();
  const { formatPrice } = useStore();

  if (items.length === 0 && !isOpen) return null;

  // Floating bar when items exist but drawer is closed
  if (!isOpen && items.length > 0) {
    return (
      <CompareFloatingBar />
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={close} side="bottom" width="max-w-full">
      <Drawer.Header onClose={close}>
        Compare Products ({items.length})
      </Drawer.Header>
      <Drawer.Body>
        {items.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Add products to compare</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="text-left p-2 text-sm font-medium text-gray-500 w-32">Product</th>
                  {items.map(p => (
                    <td key={p._id} className="p-2 text-center">
                      <div className="relative inline-block">
                        <img
                          src={p.images?.[0] || 'https://placehold.co/100x100'}
                          alt={p.name}
                          className="w-20 h-20 object-cover rounded-lg mx-auto"
                        />
                        <button
                          onClick={() => remove(p._id)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                          aria-label="Remove"
                        >
                          &times;
                        </button>
                      </div>
                      <Link to={`/products/${p.slug}`} className="block text-sm font-medium mt-1 hover:underline truncate max-w-[150px] mx-auto">
                        {p.name}
                      </Link>
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-2 text-sm font-medium text-gray-500">Price</td>
                  {items.map(p => (
                    <td key={p._id} className="p-2 text-center font-bold">
                      {formatPrice(p.price)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-2 text-sm font-medium text-gray-500">Rating</td>
                  {items.map(p => (
                    <td key={p._id} className="p-2 text-center">
                      {p.rating ? (
                        <span>{'★'.repeat(Math.round(p.rating))} {p.rating.toFixed(1)}</span>
                      ) : 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-2 text-sm font-medium text-gray-500">Availability</td>
                  {items.map(p => (
                    <td key={p._id} className="p-2 text-center">
                      {p.stock > 0 ? (
                        <span className="text-green-600 font-medium">In Stock</span>
                      ) : (
                        <span className="text-red-500 font-medium">Out of Stock</span>
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
        <button onClick={clear} className="text-sm text-red-600 hover:underline">Clear All</button>
      </Drawer.Footer>
    </Drawer>
  );
}

// ─── Floating Bar ────────────────────────────────────────────────

function CompareFloatingBar() {
  const { items, open, clear } = useCompare();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-gray-800 shadow-xl rounded-full px-6 py-3 flex items-center gap-4 border">
      <div className="flex -space-x-2">
        {items.map(p => (
          <img
            key={p._id}
            src={p.images?.[0] || 'https://placehold.co/32x32'}
            alt={p.name}
            className="w-8 h-8 rounded-full border-2 border-white object-cover"
          />
        ))}
      </div>
      <span className="text-sm font-medium">{items.length} items to compare</span>
      <button
        onClick={open}
        className="bg-gray-900 text-white text-sm px-4 py-1.5 rounded-full font-medium hover:bg-gray-800 transition"
      >
        Compare
      </button>
      <button onClick={clear} className="text-gray-400 hover:text-gray-600 text-sm">&times;</button>
    </div>
  );
}

// ─── Compare Toggle Button (for product cards) ──────────────────

export function ProductCompare(props: ProductCompareProps) {
  const Override = useThemeSlot<React.ComponentType<ProductCompareProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { product, className } = props;
  const { add, remove, isComparing, count, maxItems } = useCompare();
  const comparing = isComparing(product._id);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    comparing ? remove(product._id) : add(product);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={!comparing && count >= maxItems}
      className={cn(
        'text-xs px-2 py-1 rounded border transition',
        comparing
          ? 'border-blue-500 bg-blue-50 text-blue-600'
          : 'border-gray-200 hover:border-gray-300 text-gray-600',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        className
      )}
    >
      {comparing ? 'Comparing' : 'Compare'}
    </button>
  );
}
