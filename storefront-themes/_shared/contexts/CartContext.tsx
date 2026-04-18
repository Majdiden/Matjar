import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { cartApi } from '../api/client';

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
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((v) => !v), []);

  const refresh = useCallback(async () => {
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
    await cartApi.addItem(productId, quantity, variantId);
    await refresh();
    // Auto-open the drawer so the customer immediately sees the item land.
    setIsOpen(true);
  };

  const updateItem = async (productId: string, quantity: number, variantId?: string) => {
    await cartApi.updateItem(productId, quantity, variantId);
    await refresh();
  };

  const removeItem = async (productId: string, variantId?: string) => {
    await cartApi.removeItem(productId, variantId);
    await refresh();
  };

  const clearCartFn = async () => {
    await cartApi.clear();
    await refresh();
  };

  return (
    <CartContext.Provider value={{ cart, loading, isOpen, openCart, closeCart, toggleCart, addItem, updateItem, removeItem, clearCart: clearCartFn, refresh }}>
      {children}
    </CartContext.Provider>
  );
};
