import { useState, useEffect, useCallback } from 'react';
import { wishlistApi } from '../api/client';

/**
 * Wishlist hook — exposes the customer's saved items plus a single
 * `toggle` action for "favourite this product" buttons.
 *
 * The backend `toggle` endpoint is idempotent: it adds if absent,
 * removes if present, and returns the new state. We don't optimistically
 * update because the wishlist is a small per-user list — the round-trip
 * is fast and the cost of a stale optimistic UI is more confusing than
 * a 200ms wait.
 */
export function useWishlist() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res: any = await wishlistApi.get();
      // Backend returns { success, data: { wishlist: { products: [...] } } }.
      // Tolerate a few older/alternative shapes for safety.
      const list =
        res?.data?.wishlist?.products ||
        res?.responseObject?.wishlist?.products ||
        res?.data?.items ||
        res?.data?.products ||
        res?.responseObject?.items ||
        res?.responseObject?.products ||
        [];
      setItems(Array.isArray(list) ? list : []);
    } catch (err: any) {
      // Guests get a 401 — show an empty wishlist, not an error.
      if (err?.message?.includes('401') || err?.message?.toLowerCase().includes('unauth')) {
        setItems([]);
      } else {
        setError(err?.message || 'Failed to load wishlist');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Toggle a product in/out of the wishlist. Returns the new "is in
   * wishlist" boolean so a heart-icon button can flip its state.
   */
  const toggle = useCallback(async (productId: string) => {
    const res: any = await wishlistApi.toggle(productId);
    await refresh();
    // Backend returns { added: true|false } in either wrapper.
    return !!(res?.data?.added ?? res?.responseObject?.added);
  }, [refresh]);

  /**
   * Cheap membership check for theme components. Looks at the local
   * cache, no network call.
   */
  const includes = useCallback(
    (productId: string) =>
      items.some((it) => {
        const id = typeof it === 'string' ? it : it?._id || it?.product?._id || it?.productId;
        return String(id) === String(productId);
      }),
    [items]
  );

  return { items, loading, error, refresh, toggle, includes };
}
