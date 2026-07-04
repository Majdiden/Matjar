import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import type { StoreSummary, MyStoresResponse } from '../types';

/**
 * Loads the stores the signed-in email can access (for the in-app store
 * switcher) once the user is authenticated. On the single app host the active
 * tenant rides the JWT, so this list is how the merchant hops between their
 * stores without leaving the host.
 */
export function useMyStores() {
  const { isAuthenticated } = useAuth();
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.auth.myStores()) as MyStoresResponse;
      setStores(res.responseObject?.stores ?? []);
    } catch {
      /* ignore — switcher just stays empty; the session is unaffected */
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const currentStore = stores.find((s) => s.current) ?? null;
  return { stores, currentStore, loading, loaded, refetch: load };
}
