import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cartApi, isPreviewMode, notifyPreviewDisabled } from '../api/client';

// Theme preview shows ephemeral demo products that don't exist in the DB, so
// any cart write would 404 on the backend. This empty cart keeps the drawer
// and badges in a sane state without ever calling the cart API.
const PREVIEW_EMPTY_CART: Cart = {
  id: 'preview',
  items: [],
  itemCount: 0,
  subtotal: 0,
  total: 0,
  savings: 0,
};

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  lineTotal: number;
  product: {
    id: string;
    name: string;
    slug: string;
    images: string[];
    price: number;
    compareAtPrice?: number;
    stock: number;
  } | null;
  variant?: {
    id: string;
    name: string;
    sku?: string;
    options?: { name: string; value: string }[];
  } | null;
}

export interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  total: number;
  discount?: any;
  savings: number;
}

interface CartContextType {
  cart: Cart | null;
  loading: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (productId: string, quantity?: number, variantId?: string) => Promise<void>;
  updateItem: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  removeItem: (productId: string, variantId?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation(['common']);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((v) => !v), []);

  // Single guard covering every theme's add-to-cart / quantity controls: in
  // preview mode the cart is purely local and read-only — no API calls, so
  // nothing is ever written to the DB. Returns true when the action was blocked.
  const blockedInPreview = useCallback((): boolean => {
    if (!isPreviewMode()) return false;
    notifyPreviewDisabled(
      t('common:preview.purchasing_disabled', 'Preview mode — purchasing is disabled')
    );
    return true;
  }, [t]);

  const refresh = useCallback(async () => {
    if (isPreviewMode()) {
      setCart(PREVIEW_EMPTY_CART);
      setLoading(false);
      return;
    }
    try {
      const res = await cartApi.get();
      setCart(res.data?.cart || null);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addItem = async (productId: string, quantity = 1, variantId?: string) => {
    if (blockedInPreview()) return;
    await cartApi.addItem(productId, quantity, variantId);
    await refresh();
    // Auto-open the drawer so the customer immediately sees the item land.
    setIsOpen(true);
  };

  const updateItem = async (productId: string, quantity: number, variantId?: string) => {
    if (blockedInPreview()) return;
    await cartApi.updateItem(productId, quantity, variantId);
    await refresh();
  };

  const removeItem = async (productId: string, variantId?: string) => {
    if (blockedInPreview()) return;
    await cartApi.removeItem(productId, variantId);
    await refresh();
  };

  const clearCartFn = async () => {
    if (blockedInPreview()) return;
    await cartApi.clear();
    await refresh();
  };

  return (
    <CartContext.Provider value={{ cart, loading, isOpen, openCart, closeCart, toggleCart, addItem, updateItem, removeItem, clearCart: clearCartFn, refresh }}>
      {children}
    </CartContext.Provider>
  );
};
