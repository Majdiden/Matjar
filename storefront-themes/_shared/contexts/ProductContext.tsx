import React, { createContext, useContext } from 'react';

/**
 * Current-product context for the PDP.
 *
 * The product-detail page provides the resolved product (and the active
 * variant, if any) here so that MERCHANT-COMPOSED product-template sections
 * — rendered generically through the SectionRenderer — can read *this*
 * product's real data (description, specifications, reviews, related items)
 * instead of hardcoded placeholder copy.
 *
 * Sections read it via `useProductContext()`. Outside a PDP (e.g. a product
 * section accidentally placed on the homepage) the hook returns `null`, so
 * every consumer MUST guard and render nothing when there is no product.
 */
export interface ProductContextValue {
  product: any | null;
  activeVariant?: any | null;
}

const ProductContext = createContext<ProductContextValue | null>(null);

export const ProductProvider: React.FC<{
  product: any | null;
  activeVariant?: any | null;
  children: React.ReactNode;
}> = ({ product, activeVariant = null, children }) => (
  <ProductContext.Provider value={{ product, activeVariant }}>
    {children}
  </ProductContext.Provider>
);

/** Returns the current PDP product context, or null when outside a PDP. */
export function useProductContext(): ProductContextValue | null {
  return useContext(ProductContext);
}
