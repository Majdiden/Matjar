import React from 'react';
import type { Product } from '../types/commerce';
import { ThemeSlotsProvider, useThemeSlot } from './ThemeSlotsProvider';

// Thin shim over the general <ThemeSlotsProvider>: registers the theme's
// ProductCard under the well-known `productCard` slot. Kept as its own export
// because every theme already imports it — do not remove.

export const THEME_SLOT_PRODUCT_CARD = 'productCard';

export type ThemeCardRenderer = (
  product: Product | any,
  onQuickView?: (p: Product | any) => void,
) => React.ReactNode;

export function ThemeCardProvider({
  renderCard,
  children,
}: {
  renderCard: ThemeCardRenderer;
  children: React.ReactNode;
}) {
  return (
    <ThemeSlotsProvider slots={{ [THEME_SLOT_PRODUCT_CARD]: renderCard }}>
      {children}
    </ThemeSlotsProvider>
  );
}

/** Returns the theme's card renderer, or null when no theme card is registered. */
export function useThemeCard(): ThemeCardRenderer | null {
  return useThemeSlot<ThemeCardRenderer>(THEME_SLOT_PRODUCT_CARD);
}
