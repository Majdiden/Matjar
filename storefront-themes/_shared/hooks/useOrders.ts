import { useState, useEffect, useCallback } from 'react';
import { ordersApi } from '../api/client';

/**
 * Fetches the signed-in customer's order history. The hook owns the
 * loading + error state so theme pages can render the list directly
 * without re-implementing fetch wiring.
 *
 * Note: requires a customer token (set by the auth context). When the
 * customer is logged out the hook resolves with an empty list rather
 * than throwing — themes can show a "sign in to see orders" empty
 * state by checking the auth context separately.
 */
export function useMyOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res: any = await ordersApi.myOrders();
      // Backend wraps the list in { responseObject: { orders } } or
      // { data: { orders } } depending on the endpoint version — accept
      // both shapes so themes don't break when the response format moves.
      const list =
        res?.responseObject?.orders ||
        res?.data?.orders ||
        res?.responseObject ||
        res?.data ||
        [];
      setOrders(Array.isArray(list) ? list : []);
    } catch (err: any) {
      // Logged-out customers get a 401 — surface as empty, not error.
      if (err?.message?.includes('401') || err?.message?.toLowerCase().includes('unauth')) {
        setOrders([]);
      } else {
        setError(err?.message || 'Failed to load orders');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { orders, loading, error, refresh };
}

/**
 * Fetches a single order by id. Used by the order details page in the
 * customer account area.
 */
export function useOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res: any = await ordersApi.get(orderId);
      setOrder(res?.responseObject?.order || res?.responseObject || res?.data || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Cancel the order. Returns true on success so the caller can show a
   * toast / refresh the page. The backend rejects cancellation past
   * Processing — the error message bubbles up unchanged.
   */
  const cancel = useCallback(async () => {
    if (!orderId) return false;
    await ordersApi.cancel(orderId);
    await refresh();
    return true;
  }, [orderId, refresh]);

  return { order, loading, error, refresh, cancel };
}
