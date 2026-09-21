import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';

/**
 * Theme-level UI state: which overlay is open (only one at a time, like the
 * original's sibling-closing behaviour) and the "added to cart" modal payload.
 */
export type OverlayId = 'search' | 'minicart' | 'menu' | 'account' | null;

interface AddedPayload { productId: string; variantId?: string; name: string; image?: string; quantity: number }

interface AtelierUIValue {
  overlay: OverlayId;
  open: (id: Exclude<OverlayId, null>) => void;
  close: () => void;
  toggle: (id: Exclude<OverlayId, null>) => void;
  added: AddedPayload | null;
  /** Adds to cart and opens the confirmation modal (cards + PDP use this). */
  addAndConfirm: (p: { productId: string; variantId?: string; name: string; image?: string; quantity?: number }) => Promise<void>;
  dismissAdded: () => void;
}

const Ctx = createContext<AtelierUIValue | null>(null);

export const AtelierUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [overlay, setOverlay] = useState<OverlayId>(null);
  const [added, setAdded] = useState<AddedPayload | null>(null);
  const { addItem } = useCart();

  const open = useCallback((id: Exclude<OverlayId, null>) => setOverlay(id), []);
  const close = useCallback(() => setOverlay(null), []);
  const toggle = useCallback((id: Exclude<OverlayId, null>) => setOverlay((cur) => (cur === id ? null : id)), []);
  const addAndConfirm = useCallback(async (p: { productId: string; variantId?: string; name: string; image?: string; quantity?: number }) => {
    await addItem(p.productId, p.quantity ?? 1, p.variantId);
    setOverlay(null);
    setAdded({ productId: p.productId, variantId: p.variantId, name: p.name, image: p.image, quantity: p.quantity ?? 1 });
  }, [addItem]);
  const dismissAdded = useCallback(() => setAdded(null), []);

  const value = useMemo(() => ({ overlay, open, close, toggle, added, addAndConfirm, dismissAdded }), [overlay, open, close, toggle, added, addAndConfirm, dismissAdded]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useAtelierUI(): AtelierUIValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAtelierUI must be used inside AtelierUIProvider');
  return v;
}
